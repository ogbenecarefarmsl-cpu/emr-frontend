import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { visitsAPI, ordersAPI, doctorsAPI, admissionsAPI } from '@/services/api';
import { medicationService } from '@/services/medicationService';
import { prescriptionService } from '@/services/prescriptionService';
import { patientService } from '@/services/patientService';
import { useDoctorDashboard, useDoctorPatients, useAcceptPatient, useUpdateVisit, useCompleteVisit, usePatientVisits, useReferToSpecialist } from '@/hooks/useVisits';
import { useResults } from '@/hooks/useResults';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { useMyBranch } from '@/hooks/useBranch';
import { LIS_LOGO_URL } from '@/lib/branding';

// UI Components
import { Badge } from '@/components/ui/badge';
import { InsuranceStatusBadge } from '@/components/insurance/InsuranceStatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Dashboard components
import { TreatmentPlanBuilder } from '@/pages/shared/TreatmentPlanBuilder';
import { PatientTimeline } from '@/components/doctor/PatientTimeline';
import { DoctorTopBar } from '@/components/doctor/DoctorTopBar';
import { ReportHeader } from '@/components/reports/ReportHeader';
import { MedicationPicker } from '@/components/medications/MedicationPicker';
import {
  buildSmartInstruction,
  buildSmartRegimen,
  computeMedicationQuantity,
  getMedicationBaseUnit,
  getMedicationPrice,
  parseShorthand,
  applyShorthand,
  type MedicationLike,
} from '@/lib/medicationIntelligence';

// Icons
import {
  Loader2, CheckCircle, User, FileText, FlaskConical, Pill,
  ChevronRight, AlertTriangle, Search, Plus, Trash2, Save,
  Send, ClipboardList, UserCheck, BedDouble, Activity,
  AlertCircle, Calendar, Clock, Printer,
  RefreshCw, ShieldCheck, Scissors
} from 'lucide-react';
import { type CreateTreatmentPlanItemInput } from '@/types/treatment-plan';
import { treatmentPlanService } from '@/services/treatmentPlanService';

const TYPE_LABELS: Record<string, string> = { drug: 'Drug', iv: 'IV', lab: 'Test', procedure: 'Procedure', other: 'Other' };

const PLAN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent_to_reception: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

function generatePlanSummary(items: CreateTreatmentPlanItemInput[], notes?: string): string {
  const lines: string[] = [];
  const grouped: Record<string, CreateTreatmentPlanItemInput[]> = {};
  for (const item of items) {
    const key = item.type || 'other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  for (const [type, group] of Object.entries(grouped)) {
    lines.push(`--- ${TYPE_LABELS[type] || type} ---`);
    for (const item of group) {
      const desc = item.description || item.medicationName || item.testName || 'Untitled';
      const dose = item.strengthPerDose ? ` ${item.strengthPerDose}` : '';
      const freq = item.dosesPerDay ? ` ${item.dosesPerDay}x/d` : '';
      const dur = item.durationDays ? ` x${item.durationDays}d` : '';
      const qty = item.quantity ? ` (qty: ${item.quantity})` : '';
      const route = item.route && item.route !== 'oral' ? ` [${item.route}]` : '';
      const cost = item.amount ? ` Le${item.amount}` : '';
      lines.push(`  ${desc}${dose}${freq}${dur}${route}${qty}${cost}`);
    }
    lines.push('');
  }
  if (notes) lines.push(notes);
  return lines.join('\n').trim();
}

// Types
interface Visit {
  _id: string;
  id?: string;
  visitNumber: string;
  patientId: any;
  doctorId?: any;
  status: string;
  visitType: string;
  consultationFee: number;
  chiefComplaint?: string;
  notes?: string;
  temperature?: number;
  bloodPressure?: string;
  heartRate?: number;
  respiratoryRate?: number;
  weight?: number;
  height?: number;
  oxygenSaturation?: number;
  triagePriority?: string;
  triageNotes?: string;
  triagedAt?: string;
  room?: string;
  roomType?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessmentNotes?: string;
  planNotes?: string;
  diagnosis?: string;
  consultationOrderId?: string;
  orders?: { _id: string; orderType: string }[];
  createdAt: string;
  consultationStartedAt?: string;
  soapNoteId?: string;
  soapNoteSigned?: boolean;
}

interface LabResult {
  _id: string;
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  reference_range?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
  status: string;
  resulted_at?: string;
  createdAt: string;
}

interface Test {
  _id: string;
  code: string;
  name: string;
  price: number;
  category?: string;
  sampleType?: string;
  turnaroundTime?: number;
  isPanel?: boolean;
  panelComponents?: Array<{ testCode: string; testName: string }>;
}

interface Medication {
  _id: string;
  medicationCode: string;
  name: string;
  genericName: string;
  dosageForm?: string;
  strength?: string;
  unitPrice?: number;
  stockQuantity?: number;
  unit?: string;
  category?: string;
  isActive?: boolean;
  __cafProduct?: boolean;
  __cafBranchId?: string;
  baseUnit?: string;
  sellMode?: string;
  isCafSourced?: boolean;
  isControlled?: boolean;
  requiresPrescription?: boolean;
  brand?: string;
  sellingPrice?: number;
  price?: number;
  basePrice?: number;
  suggestedRetailPrice?: number;
  quantityAvailable?: number;
  stockAvailable?: number;
  stock?: number;
  calculatedStock?: number;
  availableStock?: number;
  packSizes?: Array<{ name: string; unit: string; quantityPerPack: number; sellingPrice: number }>;
}

const getFlagLabel = (flag?: string) => {
  if (!flag || flag === 'normal') return 'Normal';
  if (flag === 'low') return 'Low';
  if (flag === 'high') return 'High';
  if (flag === 'critical_low') return 'Critical Low';
  if (flag === 'critical_high') return 'Critical High';
  return 'N/A';
};

const patientDisplayName = (visit?: Visit | null) => {
  const patient = visit?.patientId;
  const name = [patient?.firstName, patient?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Unnamed patient';
};

const patientAgeLabel = (patient: any) => {
  if (patient?.age) return `${patient.age} yrs`;
  if (!patient?.dateOfBirth) return 'Age N/A';
  const birthDate = new Date(patient.dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return 'Age N/A';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return `${age} yrs`;
};

const statusLabel = (status?: string) => status?.replace(/_/g, ' ') || 'not set';

const visitStatusTone = (status?: string) => cn(
  status === 'in_consultation' && 'bg-blue-500 text-white',
  status === 'results_ready' && 'bg-green-500 text-white',
  status === 'awaiting_lab' && 'bg-amber-500 text-white',
  status === 'awaiting_pharmacy' && 'bg-purple-500 text-white',
  status === 'awaiting_results' && 'bg-orange-500 text-white',
  status === 'awaiting_dispensing' && 'bg-fuchsia-500 text-white',
  status === 'awaiting_doctor_review' && 'bg-cyan-600 text-white',
  status === 'admitted' && 'bg-blue-600 text-white',
);

const formatClinicalDateTime = (value?: string) => {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getResultRiskTone = (flag?: string) => {
  if (flag === 'critical_high' || flag === 'critical_low') return 'border-red-200 bg-red-50 text-red-700';
  if (flag === 'high' || flag === 'low') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const chartOrderResults = (chart: any): LabResult[] => {
  const orders = Array.isArray(chart?.orders) ? chart.orders : [];

  return orders.flatMap((order: any) => {
    const orderId = order._id || order.id || order.orderNumber || 'order';
    const fromPanels = Object.entries(order.panels || {}).flatMap(([panelCode, panel]: [string, any]) =>
      (panel?.tests || []).filter((test: any) => test?.result).map((test: any, index: number) => ({
        _id: test.result._id || `${orderId}-${test.testCode || panelCode}-${index}`,
        testCode: test.testCode || panelCode || '',
        testName: test.testName || panel?.name || test.testCode || 'Test result',
        value: String(test.result.value ?? ''),
        unit: test.result.unit,
        referenceRange: test.result.referenceRange || test.result.reference_range,
        reference_range: test.result.reference_range || test.result.referenceRange,
        flag: test.result.flag,
        status: test.result.status || order.status || 'completed',
        resulted_at: test.result.resultedAt || test.result.resulted_at || test.result.createdAt || order.updatedAt || order.createdAt,
        createdAt: test.result.createdAt || order.createdAt || new Date().toISOString(),
      } as LabResult))
    );

    const orderTests = order.orderTests || order.order_tests || order.tests || [];
    const fromTests = orderTests.filter((test: any) => test?.result).map((test: any, index: number) => ({
      _id: test.result._id || `${orderId}-${test.testCode || test.code || index}`,
      testCode: test.testCode || test.code || '',
      testName: test.testName || test.name || test.testCode || 'Test result',
      value: String(test.result.value ?? ''),
      unit: test.result.unit,
      referenceRange: test.result.referenceRange || test.result.reference_range,
      reference_range: test.result.reference_range || test.result.referenceRange,
      flag: test.result.flag,
      status: test.result.status || order.status || 'completed',
      resulted_at: test.result.resultedAt || test.result.resulted_at || test.result.createdAt || order.updatedAt || order.createdAt,
      createdAt: test.result.createdAt || order.createdAt || new Date().toISOString(),
    } as LabResult));

    return [...fromPanels, ...fromTests];
  });
};

export default function DoctorDashboard() {
  const { profile, signOut, user, exitDoctorMode } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useRealtimeResults();

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const { data: dashboardData, isLoading, isError: dashboardError, refetch: refetchDashboard } = useDoctorDashboard();
  const acceptPatient = useAcceptPatient();
  const updateVisit = useUpdateVisit();
  const completeVisit = useCompleteVisit();

  // State for active patient panel
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [searchedPatient, setSearchedPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('soap');
  const contextPatient = selectedVisit?.patientId || searchedPatient;

  // Doctor triage override
  const [triageOverride, setTriageOverride] = useState('');
  const [doctorTriageNotes, setDoctorTriageNotes] = useState('');

  // Lab order modal state
  const [labOrderModalOpen, setLabOrderModalOpen] = useState(false);
  const { data: branch } = useMyBranch(labOrderModalOpen);
  const [selectedTests, setSelectedTests] = useState<Test[]>([]);
  const [searchTest, setSearchTest] = useState('');

  // Prescription modal state
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([]);
  const [searchMedication, setSearchMedication] = useState('');
  const [shorthandInputs, setShorthandInputs] = useState<Record<number, string>>({});
  const [shorthandErrors, setShorthandErrors] = useState<Record<number, string>>({});

  // All my patients modal state
  const [allPatientsOpen, setAllPatientsOpen] = useState(false);
  const [allPatientsSearch, setAllPatientsSearch] = useState('');
  const [allPatientsPage, setAllPatientsPage] = useState(1);
  const [allPatientsDaysBack, setAllPatientsDaysBack] = useState<number | undefined>(undefined);
  const doctorPatientsQuery = useDoctorPatients({
    page: allPatientsPage,
    limit: 25,
    search: allPatientsSearch,
    daysBack: allPatientsDaysBack,
    enabled: allPatientsOpen,
  });
  const doctorPatients = doctorPatientsQuery.data?.patients || [];
  const doctorPatientsTotal = doctorPatientsQuery.data?.total || 0;

  // Referral modal state
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralForm, setReferralForm] = useState({
    specialistId: '',
    reason: '',
    notes: '',
  });
  const referToSpecialist = useReferToSpecialist();
  const { data: specialists = [] } = useQuery({
    queryKey: ['doctors', 'specialists'],
    queryFn: () => doctorsAPI.getSpecialists(),
    staleTime: 5 * 60 * 1000,
    enabled: referralOpen,
  });

  // Admission modal state
  const [admitOpen, setAdmitOpen] = useState(false);
  const [admitForm, setAdmitForm] = useState({
    wardType: 'general',
    bedNumber: '',
    admissionReason: '',
    diagnosis: '',
    notes: '',
  });

  // Treatment plan modal state
  const [treatmentPlanOpen, setTreatmentPlanOpen] = useState(false);

  // Edit mode state
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editingPrescription, setEditingPrescription] = useState<any>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  // C1: Unsaved changes tracking
  const [isDirty, setIsDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: 'accept' | 'select' | 'search' | 'tab' | 'dashboard'; value?: any } | null>(null);

  // C2: Allergy override modal
  const [allergyOverrideOpen, setAllergyOverrideOpen] = useState(false);
  const [allergyOverrideInfo, setAllergyOverrideInfo] = useState<{ med: Medication; allergy: string } | null>(null);
  const [allergyOverrideText, setAllergyOverrideText] = useState('');

  // M4: Vitals validation errors
  const [vitalsErrors, setVitalsErrors] = useState<Record<string, string>>({});

  // m8: Lab results sort
  const [labSortField, setLabSortField] = useState<'testName' | 'value' | 'flag' | null>(null);
  const [labSortDir, setLabSortDir] = useState<'asc' | 'desc'>('asc');
  const [reviewedResultIds, setReviewedResultIds] = useState<Set<string>>(new Set());
  const createAdmission = useMutation({
    mutationFn: async () => {
      if (!selectedVisit) return;
      return admissionsAPI.create({
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        doctorId: user?.doctorId || profile?.id,
        wardType: admitForm.wardType,
        bedNumber: admitForm.bedNumber || undefined,
        admissionReason: admitForm.admissionReason,
        diagnosis: admitForm.diagnosis || undefined,
        notes: admitForm.notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Patient admitted');
      setAdmitOpen(false);
      setAdmitForm({ wardType: 'general', bedNumber: '', admissionReason: '', diagnosis: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      setSelectedVisit(null);
    },
    onError: () => toast.error('Failed to admit patient'),
  });

  // SOAP/Vitals form state
  const [vitalsForm, setVitalsForm] = useState({
    temperature: '',
    bloodPressure: '',
    heartRate: '',
    respiratoryRate: '',
    weight: '',
    height: '',
    oxygenSaturation: '',
  });
  const [chiefComplaintForm, setChiefComplaintForm] = useState('');
  const [soapForm, setSoapForm] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    diagnosis: '',
  });

  // Fetch LIS orderables for lab order modal (LIS is source of truth).
  const {
    data: tests = [],
    isLoading: testsLoading,
    isError: testsError,
    error: testsLoadError,
  } = useQuery({
    queryKey: ['orders', 'lis-catalog'],
    queryFn: () => ordersAPI.getLisCatalog(),
    staleTime: 60 * 1000,
    enabled: labOrderModalOpen,
  });

  // Fetch medications for prescription modal
  const { data: medications = [], isLoading: medicationsLoading } = useQuery({
    queryKey: ['medications'],
    queryFn: () => medicationService.findAll(),
    staleTime: 5 * 60 * 1000,
    enabled: prescriptionModalOpen,
  });

  // Fetch patient's previous visits when a patient is selected
  const patientId = selectedVisit?.patientId?._id || selectedVisit?.patientId || searchedPatient?._id || '';
  const { data: patientVisits = [] } = usePatientVisits(patientId);
  const { data: patientOrders = [] } = useQuery({
    queryKey: ['orders', 'patient', patientId],
    queryFn: () => ordersAPI.getAll({ patientId, limit: 100 }),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
  const { data: patientChart, isLoading: chartLoading } = useQuery({
    queryKey: ['patient-chart', patientId],
    queryFn: () => patientService.getChart(patientId),
    enabled: !!patientId,
    staleTime: 60 * 1000,
  });

  // Fetch prescriptions for the selected patient
  const { data: patientPrescriptions = [] } = useQuery({
    queryKey: ['prescriptions', 'patient', patientId],
    queryFn: () => prescriptionService.findByPatient(patientId),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });

  const currentVisitId = selectedVisit?._id || selectedVisit?.id;

  // Treatment plans for the current visit
  const { data: allPlans = [] } = useQuery({
    queryKey: ['treatment-plans', currentVisitId ? 'visit' : 'patient', currentVisitId || patientId],
    queryFn: () => currentVisitId ? treatmentPlanService.getForVisit(currentVisitId) : treatmentPlanService.getForPatient(patientId),
    enabled: !!(currentVisitId || patientId),
    staleTime: 30 * 1000,
  });
  const currentVisitPlans = (Array.isArray(allPlans) ? allPlans : []).filter((p: any) => {
    const planVisitId = typeof p.visitId === 'object' ? p.visitId?._id : p.visitId;
    return planVisitId === currentVisitId;
  });

  // Current visit prescriptions (pending and unpaid)
  const currentVisitPrescriptions = (Array.isArray(patientPrescriptions) ? patientPrescriptions : [])
    .filter((rx: any) => {
      const rxVisitId = typeof rx.visitId === 'object' ? rx.visitId?._id : rx.visitId;
      return rxVisitId === currentVisitId;
    });

  // Fetch lab results for the selected visit - need to find the lab order
  const currentVisitLabOrder = patientOrders.find((order: any) => {
    const orderVisitId = typeof order.visitId === 'object' ? order.visitId?._id : order.visitId;
    const visitId = selectedVisit?._id || selectedVisit?.id;
    return orderVisitId === visitId && (order.orderType || order.order_type) === 'lab';
  });
  const currentVisitOrders = (Array.isArray(patientOrders) ? patientOrders : [])
    .filter((order: any) => {
      const orderVisitId = typeof order.visitId === 'object' ? order.visitId?._id : order.visitId;
      return orderVisitId === currentVisitId;
    });
  const labOrderId = selectedVisit?.orders?.find((o: any) => o.orderType === 'lab')?._id ||
    currentVisitLabOrder?._id ||
    currentVisitLabOrder?.id ||
    selectedVisit?.consultationOrderId;
  const { data: labResults = [] } = useResults(labOrderId);
  const chartReviewLabResults = useMemo(() => chartOrderResults(patientChart), [patientChart]);
  const displayedLabResults = selectedVisit ? labResults : chartReviewLabResults;
  const abnormalLabResults = displayedLabResults.filter((result: LabResult) => result.flag && result.flag !== 'normal');
  const criticalLabResults = displayedLabResults.filter((result: LabResult) => result.flag === 'critical_high' || result.flag === 'critical_low');
  const latestResultAt = displayedLabResults.reduce<string | undefined>((latest, result: LabResult) => {
    const candidate = result.resulted_at || result.createdAt;
    if (!candidate) return latest;
    if (!latest) return candidate;
    return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
  }, undefined);

  // m8: Sorted lab results
  const sortedLabResults = useMemo(() => {
    const flagOrder = { critical_high: 0, critical_low: 1, high: 2, low: 3, normal: 4 };
    const sorted = [...displayedLabResults];
    if (!labSortField) {
      // Default: flagged first, then by test name
      sorted.sort((a, b) => {
        const aFlag = flagOrder[a.flag as keyof typeof flagOrder] ?? 4;
        const bFlag = flagOrder[b.flag as keyof typeof flagOrder] ?? 4;
        if (aFlag !== bFlag) return aFlag - bFlag;
        return (a.testName || '').localeCompare(b.testName || '');
      });
    } else {
      sorted.sort((a, b) => {
        let cmp = 0;
        if (labSortField === 'testName') cmp = (a.testName || '').localeCompare(b.testName || '');
        else if (labSortField === 'value') {
          const numA = parseFloat(String(a.value || '').replace(/[^\d.\-]/g, ''));
          const numB = parseFloat(String(b.value || '').replace(/[^\d.\-]/g, ''));
          if (!isNaN(numA) && !isNaN(numB)) cmp = numA - numB;
          else cmp = (a.value || '').localeCompare(b.value || '');
        }
        else if (labSortField === 'flag') {
          const aVal = flagOrder[a.flag as keyof typeof flagOrder] ?? 4;
          const bVal = flagOrder[b.flag as keyof typeof flagOrder] ?? 4;
          cmp = aVal - bVal;
        }
        return labSortDir === 'asc' ? cmp : -cmp;
      });
    }
    return sorted;
  }, [displayedLabResults, labSortField, labSortDir]);

  const toggleLabSort = (field: 'testName' | 'value' | 'flag') => {
    if (labSortField === field) {
      setLabSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setLabSortField(field);
      setLabSortDir('asc');
    }
  };
  const selectedPatient = contextPatient || {};
  const selectedWalletBalance = Number(selectedPatient.walletBalance || selectedPatient.wallet?.balance || 0);

  // Filter tests based on search
  const lisOrderables = Array.isArray(tests) ? tests : [];
  const filteredTests = useMemo(() => {
    if (!searchTest) return lisOrderables.slice(0, 20);
    return lisOrderables.filter((t: Test) =>
      t.name?.toLowerCase().includes(searchTest.toLowerCase()) ||
      t.code?.toLowerCase().includes(searchTest.toLowerCase())
    ).slice(0, 20);
  }, [lisOrderables, searchTest]);

  // Search medications â€” hits backend /medications/search which includes CAF products
  const { data: searchResults = [] } = useQuery({
    queryKey: ['medications', 'search', searchMedication],
    queryFn: () => medicationService.search(searchMedication),
    enabled: searchMedication.length >= 2,
    staleTime: 30 * 1000,
  });

  // Filter medications based on search â€” use live search results when typing, else show all
  const filteredMedications = useMemo(() => {
    const allMeds = medications || [];
    if (searchMedication.length < 2) return allMeds;
    const searchLower = searchMedication.toLowerCase();
    const localMatches = allMeds.filter((m: Medication) =>
      m.name?.toLowerCase().includes(searchLower) ||
      m.genericName?.toLowerCase().includes(searchLower) ||
      m.medicationCode?.toLowerCase().includes(searchLower)
    );
    const searchIds = new Set((searchResults || []).map((r: any) => r._id || r.medicationCode));
    const extraLocal = localMatches.filter((m: Medication) => !searchIds.has(m._id) && !searchIds.has(m.medicationCode));
    return [...(searchResults || []), ...extraLocal];
  }, [medications, searchMedication, searchResults]);

  // Reset forms when selected visit changes
  useEffect(() => {
    if (selectedVisit) {
      setVitalsForm({
        temperature: selectedVisit.temperature?.toString() || '',
        bloodPressure: selectedVisit.bloodPressure || '',
        heartRate: selectedVisit.heartRate?.toString() || '',
        respiratoryRate: selectedVisit.respiratoryRate?.toString() || '',
        weight: selectedVisit.weight?.toString() || '',
        height: selectedVisit.height?.toString() || '',
        oxygenSaturation: selectedVisit.oxygenSaturation?.toString() || '',
      });
      setChiefComplaintForm(selectedVisit.chiefComplaint || '');
      setSoapForm({
        subjective: selectedVisit.subjectiveNotes || selectedVisit.chiefComplaint || '',
        objective: selectedVisit.objectiveNotes || '',
        assessment: selectedVisit.assessmentNotes || '',
        plan: selectedVisit.planNotes || '',
        diagnosis: selectedVisit.diagnosis || '',
      });
      setTriageOverride(selectedVisit.triageOverride_priority || selectedVisit.triageOverridePriority || '');
      setDoctorTriageNotes(selectedVisit.doctorTriageNotes || '');
      setActiveTab(selectedVisit.status === 'results_ready' ? 'lab-results' : 'soap');
    }
  }, [selectedVisit?._id]);

  // Auto-resize SOAP textareas when data loads or form resets
  useEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('.soap-autosize');
    textareas.forEach((el) => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
  }, [soapForm.subjective, soapForm.objective, soapForm.assessment, soapForm.plan]);

  // Handlers
  const handleSelectSearchPatient = (patient: any) => {
    if (isDirty) {
      setPendingNavigation({ type: 'search', value: patient });
      setDiscardConfirmOpen(true);
      return;
    }
    setSearchedPatient(patient);
    setSelectedVisit(null);
    setActiveTab('timeline');
    toast.info(`Viewing ${[patient?.firstName, patient?.lastName].filter(Boolean).join(' ') || 'patient'} — read-only until triaged`);
  };

  const handleAcceptPatient = async (visit: Visit) => {
    try {
      const acceptedVisit = await acceptPatient.mutateAsync(visit._id || visit.id || '');
      setSelectedVisit((acceptedVisit as Visit) || visit);
      setSearchedPatient(null);
      setActiveTab('soap');
      setIsDirty(false);
      toast.success(`Accepted patient: ${visit.patientId?.firstName} ${visit.patientId?.lastName}`);
    } catch {
      // onError in the hook already shows the error toast
    }
  };

  const buildClinicalDraft = () => ({
    temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
    bloodPressure: vitalsForm.bloodPressure || undefined,
    heartRate: vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : undefined,
    respiratoryRate: vitalsForm.respiratoryRate ? parseInt(vitalsForm.respiratoryRate) : undefined,
    weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : undefined,
    height: vitalsForm.height ? parseFloat(vitalsForm.height) : undefined,
    oxygenSaturation: vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation) : undefined,
    chiefComplaint: chiefComplaintForm.trim() || undefined,
    subjectiveNotes: soapForm.subjective || undefined,
    objectiveNotes: soapForm.objective || undefined,
    assessmentNotes: soapForm.assessment || undefined,
    planNotes: soapForm.plan || undefined,
    diagnosis: soapForm.diagnosis || undefined,
    triageOverridePriority: triageOverride || undefined,
    doctorTriageNotes: doctorTriageNotes.trim() || undefined,
  });

  const handleSaveVitalsAndSOAP = async () => {
    if (!selectedVisit) return;
    if (!canWriteConsultation) {
      toast.error('Consultation fee must be paid before saving clinical notes');
      return;
    }
    if (!validateVitals(vitalsForm)) {
      toast.error('Please fix vitals errors before saving');
      return;
    }

    try {
      await updateVisit.mutateAsync({
        visitId: selectedVisit._id || selectedVisit.id || '',
        data: buildClinicalDraft(),
      });
      queryClient.invalidateQueries({ queryKey: ['patient-chart', selectedVisit.patientId?._id || selectedVisit.patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast.success('Notes saved');
      setIsDirty(false);
    } catch {
      // onError in the hook already shows the error toast
    }
  };

  const handleCompleteVisit = async (): Promise<boolean> => {
    if (!selectedVisit) return false;
    if (!canWriteConsultation) {
      toast.error('Consultation fee must be paid before completing the encounter');
      return false;
    }

    try {
      await completeVisit.mutateAsync({
        visitId: selectedVisit._id || selectedVisit.id || '',
        data: buildClinicalDraft(),
      });
      toast.success('Visit completed');
      setIsDirty(false);
      setSelectedVisit(null);
      return true;
    } catch {
      // onError in the hook already shows the error toast
      return false;
    }
  };

  const handleCompleteAndNext = async () => {
    if (!selectedVisit) return;
    const success = await handleCompleteVisit();
    if (!success) return;
    const nextInQueue = waitingQueue.find((v: Visit) => v.status === 'in_queue');
    if (nextInQueue) {
      await handleAcceptPatient(nextInQueue);
    }
  };

  // Lab order creation
  const createLabOrder = useMutation({
    mutationFn: async () => {
      const patientId = contextPatient?._id;
      if (!patientId || selectedTests.length === 0) return;

      const orderData: any = {
        patientId,
        orderType: 'lab',
        tests: selectedTests.map(t => ({
          testId: t._id,
          testCode: t.code,
          testName: t.name,
          price: t.price,
        })),
        priority: 'routine',
      };
      if (selectedVisit) {
        orderData.visitId = selectedVisit._id || selectedVisit.id;
      }

      return await ordersAPI.create(orderData);
    },
    onSuccess: () => {
      toast.success('Order created. Patient should pay at reception.');
      setLabOrderModalOpen(false);
      setSelectedTests([]);
      setEditingOrder(null);
      if (selectedVisit) {
        setSelectedVisit(prev => prev ? { ...prev, status: 'awaiting_lab' } : prev);
      }
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient-chart'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create lab order';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Prescription creation
  const createPrescription = useMutation({
    mutationFn: async () => {
      const patientId = contextPatient?._id;
      if (!patientId || prescriptionItems.length === 0) return;

      const payload: any = {
        patientId,
        items: prescriptionItems.map(({ unitPrice, sellMode, packSizes, baseUnit, smartInstruction, computedQuantity, quantityTouched, isControlled, requiresPrescription, ...item }) => ({
          ...item,
          quantity: Math.max(1, Number(item.quantity || computedQuantity || computeMedicationQuantity(item, { baseUnit }) || 1)),
          // The frontend no longer sends dosage/frequency/duration (legacy) — backend
          // auto-generates them from strengthPerDose / dosesPerDay / durationDays
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        totalAmount: 0,
      };
      if (selectedVisit) {
        payload.visitId = selectedVisit._id || selectedVisit.id;
      }

      return await prescriptionService.create(payload);
    },
    onSuccess: () => {
      toast.success('Prescription created. Patient should pay at reception.');
      setPrescriptionModalOpen(false);
      setPrescriptionItems([]);
      setEditingPrescription(null);
      if (selectedVisit) {
        setSelectedVisit(prev => prev ? { ...prev, status: 'awaiting_pharmacy' } : prev);
      }
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['patient-chart'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create prescription';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Lab order update mutation
  const updateLabOrder = useMutation({
    mutationFn: async () => {
      if (!editingOrder || selectedTests.length === 0) return;
      return await ordersAPI.update(editingOrder._id || editingOrder.id, {
        tests: selectedTests.map(t => ({
          testId: t._id,
          testCode: t.code,
          testName: t.name,
          price: t.price,
        })),
        priority: editingOrder.priority,
      });
    },
    onSuccess: () => {
      toast.success('Order updated');
      setLabOrderModalOpen(false);
      setSelectedTests([]);
      setEditingOrder(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update lab order';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Prescription update mutation
  const updatePrescription = useMutation({
    mutationFn: async () => {
      if (!editingPrescription || prescriptionItems.length === 0) return;
      return await prescriptionService.update(editingPrescription._id, {
        items: prescriptionItems.map(({ unitPrice, sellMode, packSizes, baseUnit, smartInstruction, computedQuantity, quantityTouched, isControlled, requiresPrescription, ...item }) => ({
          ...item,
          quantity: Math.max(1, Number(item.quantity || computedQuantity || computeMedicationQuantity(item, { baseUnit }) || 1)),
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        totalAmount: 0,
      });
    },
    onSuccess: () => {
      toast.success('Prescription updated');
      setPrescriptionModalOpen(false);
      setPrescriptionItems([]);
      setEditingPrescription(null);
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update prescription';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const addTestToOrder = (test: Test) => {
    if (!selectedTests.find(t => (t._id || t.code) === (test._id || test.code))) {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const removeTestFromOrder = (testId: string) => {
    setSelectedTests(selectedTests.filter(t => (t._id || t.code) !== testId));
  };

  const buildPrescriptionItem = (med: MedicationLike, pharmacistNote = '') => {
    const regimen = buildSmartRegimen(med);
    const instructions = '';
    const computedQuantity = computeMedicationQuantity(regimen, med);
    return {
      medicationId: med._id,
      medicationName: med.name,
      strengthPerDose: regimen.strengthPerDose,
      dosesPerDay: regimen.dosesPerDay,
      durationDays: regimen.durationDays,
      dosage: '',
      frequency: '',
      duration: '',
      quantity: computedQuantity,
      computedQuantity,
      quantityTouched: false,
      route: regimen.route,
      unitPrice: getMedicationPrice(med),
      sellMode: (med as any).sellMode,
      packSizes: med.packSizes,
      baseUnit: getMedicationBaseUnit(med),
      isControlled: med.isControlled,
      requiresPrescription: med.requiresPrescription,
      instructions,
      smartInstruction: instructions,
      pharmacistNote,
    };
  };

  const addMedicationToPrescription = (med: Medication) => {
    const allergies: string[] = contextPatient?.allergies || [];
    const medText = `${med.name} ${med.genericName || ''}`.toLowerCase();
    const matchedAllergy = allergies.find((a) => {
      const allergen = a.toLowerCase().trim();
      if (!allergen) return false;
      if (medText.includes(allergen)) return true;
      const allergyRoots: Record<string, string[]> = {
        'penicillin': ['amoxicillin', 'ampicillin', 'penicillin', 'augmentin'],
        'sulfa': ['sulfamethoxazole', 'trimethoprim', 'bactrim', 'sulfa'],
        'aspirin': ['aspirin', 'acetylsalicylic', 'asa'],
        'nsaid': ['ibuprofen', 'diclofenac', 'naproxen', 'ketoprofen', 'nsaid'],
        'ace inhibitor': ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
        'beta blocker': ['atenolol', 'metoprolol', 'propranolol', 'carvedilol'],
      };
      for (const [root, related] of Object.entries(allergyRoots)) {
        if (allergen.includes(root) && related.some((r) => medText.includes(r))) return true;
      }
      return false;
    });
    if (matchedAllergy) {
      // C2: Show styled allergy override modal instead of window.confirm
      setAllergyOverrideInfo({ med, allergy: matchedAllergy });
      setAllergyOverrideText('');
      setAllergyOverrideOpen(true);
      return; // Modal callback will handle adding
    }
    setPrescriptionItems([
      ...prescriptionItems,
      {
        ...buildPrescriptionItem(med),
      },
    ]);
  };

  const updatePrescriptionItem = (index: number, field: string, value: any) => {
    const updated = [...prescriptionItems];
    const previous = { ...updated[index] };
    updated[index] = { ...updated[index], [field]: value };
    if (['strengthPerDose', 'dosesPerDay', 'durationDays', 'route'].includes(field)) {
      const nextComputedQuantity = computeMedicationQuantity(updated[index], { baseUnit: updated[index].baseUnit });
      updated[index].computedQuantity = nextComputedQuantity;
      if (!previous.quantityTouched || Number(previous.quantity || 0) === Number(previous.computedQuantity || 0)) {
        updated[index].quantity = nextComputedQuantity;
        updated[index].quantityTouched = false;
      }
      const nextInstruction = buildSmartInstruction({
        strengthPerDose: updated[index].strengthPerDose,
        dosesPerDay: Number(updated[index].dosesPerDay || 1),
        durationDays: Number(updated[index].durationDays || 1),
        route: updated[index].route,
      });
      if (!previous.instructions || previous.instructions === previous.smartInstruction) {
        updated[index].instructions = nextInstruction;
      }
      updated[index].smartInstruction = nextInstruction;
    }
    if (field === 'quantity') {
      updated[index].quantity = Math.max(0, Number(value) || 0);
      updated[index].quantityTouched = Number(value) !== Number(updated[index].computedQuantity || 0);
    }
    setPrescriptionItems(updated);
  };

  const hasPrescriptionInstruction = (item: any) =>
    typeof item.instructions === 'string' && item.instructions.trim().length > 0;

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
    setShorthandInputs((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleShorthandChange = (index: number, value: string) => {
    setShorthandInputs((prev) => ({ ...prev, [index]: value }));
    const parsed = parseShorthand(value);
    if (parsed) {
      setShorthandErrors((prev) => { const next = { ...prev }; delete next[index]; return next; });
      setPrescriptionItems((prev) => {
        const updated = [...prev];
        updated[index] = applyShorthand(updated[index], parsed);
        return updated;
      });
    } else if (value.trim()) {
      setShorthandErrors((prev) => ({ ...prev, [index]: 'Could not parse shorthand. Try: BD 5/7, TDS 14d, 500mg OD 7days' }));
    } else {
      setShorthandErrors((prev) => { const next = { ...prev }; delete next[index]; return next; });
    }
  };

  // C2: Called after allergy override modal confirms
  const addMedicationAfterAllergyCheck = useCallback((med: Medication) => {
    setPrescriptionItems([
      ...prescriptionItems,
      {
        ...buildPrescriptionItem(med, `Allergy override approved: ${allergyOverrideText.trim()}`),
      },
    ]);
  }, [prescriptionItems, allergyOverrideText]);

  // Edit helpers
  const startEditOrder = (order: any) => {
    const orderTests = (order.order_tests || order.tests || []).map((t: any) => ({
      _id: t.testId || t.test_id || t._id,
      code: t.testCode || t.test_code,
      name: t.testName || t.test_name,
      price: t.price || 0,
      isPanel: !!t.panelCode,
    }));
    setSelectedTests(orderTests);
    setEditingOrder(order);
    setLabOrderModalOpen(true);
  };

  const startEditPrescription = (rx: any) => {
    const items = (rx.items || []).map((item: any) => ({
      medicationId: item.medicationId?._id || item.medicationId,
      medicationName: item.medicationName,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity,
      computedQuantity: item.quantity,
      quantityTouched: false,
      route: item.route || 'oral',
      unitPrice: item.unitPrice ?? 0,
      instructions: item.instructions || '',
      pharmacistNote: item.pharmacistNote || '',
      strengthPerDose: item.strengthPerDose,
      dosesPerDay: item.dosesPerDay,
      durationDays: item.durationDays,
      isControlled: item.isControlled,
      requiresPrescription: item.requiresPrescription,
      baseUnit: item.baseUnit,
    }));
    setPrescriptionItems(items);
    setEditingPrescription(rx);
    setPrescriptionModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setEditingPrescription(null);
    setSelectedTests([]);
    setPrescriptionItems([]);
    setShorthandInputs({});
    setShorthandErrors({});
    setLabOrderModalOpen(false);
    setPrescriptionModalOpen(false);
  };

  // Stats from dashboard data
  const stats = dashboardData?.todayStats || { seen: 0, waiting: 0, completed: 0 };
  const waitingQueue = dashboardData?.waitingQueue || [];
  const activePatients = dashboardData?.activePatients || [];
  const awaitingLabPayment = dashboardData?.awaitingLabPayment || [];
  const awaitingResults = dashboardData?.awaitingResults || [];
  const awaitingPharmacy = dashboardData?.awaitingPharmacy || [];
  const awaitingDispensing = dashboardData?.awaitingDispensing || [];
  const resultsReady = dashboardData?.resultsReady || [];
  const incomingReferrals = dashboardData?.incomingReferrals || [];
  const admittedPatients = dashboardData?.admittedPatients || [];
  const openEncounterCount = activePatients.length;

  // Global search across all visit queues — replaced by DoctorTopBar patient search

  // Pending lab payment/processing must not freeze clinical documentation.
  // Doctors can keep SOAP and vitals current while the encounter remains open;
  // completion is governed separately by canCloseEncounter below.
  const canContinueClinicalWork = !!selectedVisit && [
    'in_consultation',
    'awaiting_lab',
    'awaiting_results',
    'results_ready',
    'awaiting_doctor_review',
  ].includes(selectedVisit.status);
  const isReadOnly = !canContinueClinicalWork || selectedVisit?.soapNoteSigned === true;
  const canWriteConsultation = canContinueClinicalWork && selectedVisit?.soapNoteSigned !== true && selectedVisit?.consultationPaid === true;
  const consultationPaymentBlocksWriting = canContinueClinicalWork && selectedVisit?.consultationPaid === false;
  const isChartReviewMode = !selectedVisit && !!searchedPatient;
  const canCloseEncounter = !!selectedVisit && !['awaiting_lab', 'awaiting_results', 'awaiting_pharmacy', 'awaiting_dispensing'].includes(selectedVisit.status);
  const closureBlockers = useMemo(() => {
    if (!selectedVisit) return [];
    const blockers: string[] = [];
    const status = selectedVisit.status;
    if (status === 'awaiting_lab') blockers.push('Order payment is still pending.');
    if (status === 'awaiting_results') blockers.push('Test processing is still in progress.');
    if (status === 'awaiting_pharmacy') blockers.push('Pharmacy order payment is still pending.');
    if (status === 'awaiting_dispensing') blockers.push('Pharmacy dispensing is still pending.');

    const activeClinicalOrders = currentVisitOrders.filter((order: any) => {
      const type = order.orderType || order.order_type;
      return type === 'lab' || type === 'pharmacy';
    });
    const hasUnpaidClinical = activeClinicalOrders.some((order: any) => (order.paymentStatus || order.payment_status) !== 'paid');
    const hasUnreleasedLab = activeClinicalOrders.some((order: any) => (order.orderType || order.order_type) === 'lab' && (order.status || '') !== 'completed');
    const hasUndispensedPharmacy = activeClinicalOrders.some((order: any) => (order.orderType || order.order_type) === 'pharmacy' && (order.status || '') !== 'completed');

    if (hasUnpaidClinical) blockers.push('One or more clinical orders are not fully paid.');
    if (hasUnreleasedLab) blockers.push('One or more lab orders are not completed/released yet.');
    if (hasUndispensedPharmacy) blockers.push('One or more pharmacy orders are not dispensed yet.');
    return Array.from(new Set(blockers));
  }, [selectedVisit?._id, selectedVisit?.status, currentVisitOrders]);
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleExitDoctorMode = async () => {
    const { error } = await exitDoctorMode();
    if (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to exit doctor mode');
      return;
    }
    toast.success('Exited doctor mode');
    navigate('/admin');
  };

  // C1: Guard navigation when dirty
  const guardNavigation = useCallback((action: () => void, navType: 'accept' | 'select' | 'search' | 'tab' | 'dashboard', navValue?: any) => {
    if (isDirty) {
      setPendingNavigation({ type: navType, value: navValue });
      setDiscardConfirmOpen(true);
    } else {
      action();
    }
  }, [isDirty]);

  const confirmDiscardAndProceed = useCallback(() => {
    setIsDirty(false);
    setDiscardConfirmOpen(false);
    if (!pendingNavigation) return;
    if (pendingNavigation.type === 'accept' && pendingNavigation.value) {
      handleAcceptPatient(pendingNavigation.value);
    } else if (pendingNavigation.type === 'select' && pendingNavigation.value) {
      setSearchedPatient(null);
      setSelectedVisit(pendingNavigation.value.visit);
      setActiveTab(pendingNavigation.value.tab);
    } else if (pendingNavigation.type === 'search' && pendingNavigation.value) {
      setSearchedPatient(pendingNavigation.value);
      setSelectedVisit(null);
      setActiveTab('timeline');
    } else if (pendingNavigation.type === 'tab' && pendingNavigation.value) {
      setActiveTab(pendingNavigation.value);
    } else if (pendingNavigation.type === 'dashboard') {
      setSelectedVisit(null);
      setSearchedPatient(null);
      setActiveTab('soap');
    }
    setPendingNavigation(null);
  }, [pendingNavigation]);

  const saveAndProceed = useCallback(async () => {
    await handleSaveVitalsAndSOAP();
    setIsDirty(false);
    setDiscardConfirmOpen(false);
    if (!pendingNavigation) return;
    if (pendingNavigation.type === 'accept' && pendingNavigation.value) {
      handleAcceptPatient(pendingNavigation.value);
    } else if (pendingNavigation.type === 'select' && pendingNavigation.value) {
      setSearchedPatient(null);
      setSelectedVisit(pendingNavigation.value.visit);
      setActiveTab(pendingNavigation.value.tab);
    } else if (pendingNavigation.type === 'search' && pendingNavigation.value) {
      setSearchedPatient(pendingNavigation.value);
      setSelectedVisit(null);
      setActiveTab('timeline');
    } else if (pendingNavigation.type === 'tab' && pendingNavigation.value) {
      setActiveTab(pendingNavigation.value);
    } else if (pendingNavigation.type === 'dashboard') {
      setSelectedVisit(null);
      setSearchedPatient(null);
      setActiveTab('soap');
    }
    setPendingNavigation(null);
  }, [pendingNavigation]);

  const selectVisit = useCallback((visit: Visit, tab = visit.status === 'results_ready' ? 'lab-results' : 'soap') => {
    guardNavigation(
      () => {
        setSearchedPatient(null);
        setSelectedVisit(visit);
        setActiveTab(tab);
      },
      'select',
      { visit, tab },
    );
  }, [guardNavigation]);

  const acceptVisit = useCallback((visit: Visit) => {
    guardNavigation(() => { void handleAcceptPatient(visit); }, 'accept', visit);
  }, [guardNavigation]);

  const openDashboard = useCallback(() => {
    guardNavigation(() => {
      setSelectedVisit(null);
      setSearchedPatient(null);
      setActiveTab('soap');
    }, 'dashboard');
  }, [guardNavigation]);

  const discardChanges = useCallback(() => {
    if (!selectedVisit) return;
    setSoapForm({
      subjective: selectedVisit.subjectiveNotes || selectedVisit.chiefComplaint || '',
      objective: selectedVisit.objectiveNotes || '',
      assessment: selectedVisit.assessmentNotes || '',
      plan: selectedVisit.planNotes || '',
      diagnosis: selectedVisit.diagnosis || '',
    });
    setVitalsForm({
      temperature: selectedVisit.temperature?.toString() || '',
      bloodPressure: selectedVisit.bloodPressure || '',
      heartRate: selectedVisit.heartRate?.toString() || '',
      respiratoryRate: selectedVisit.respiratoryRate?.toString() || '',
      weight: selectedVisit.weight?.toString() || '',
      height: selectedVisit.height?.toString() || '',
      oxygenSaturation: selectedVisit.oxygenSaturation?.toString() || '',
    });
    setChiefComplaintForm(selectedVisit.chiefComplaint || '');
    setTriageOverride(selectedVisit.triageOverride_priority || selectedVisit.triageOverridePriority || '');
    setDoctorTriageNotes(selectedVisit.doctorTriageNotes || '');
    setIsDirty(false);
  }, [selectedVisit]);

  // Keep selectedVisit in sync with the latest dashboard data
  useEffect(() => {
    if (!selectedVisit || isDirty) return;
    const allKnownVisits = [
      ...waitingQueue, ...activePatients, ...resultsReady,
      ...awaitingLabPayment, ...awaitingResults, ...awaitingPharmacy, ...awaitingDispensing,
    ];
    const refreshed = allKnownVisits.find((v) => v._id === selectedVisit._id);
    if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(selectedVisit)) {
      setSelectedVisit(refreshed);
    }
  }, [waitingQueue, activePatients, resultsReady, awaitingLabPayment, awaitingResults, awaitingPharmacy, awaitingDispensing, isDirty]);

  // C1: Track dirty state when forms change
  useEffect(() => {
    if (!selectedVisit) return;
    const origSoap = {
      subjective: selectedVisit.subjectiveNotes || selectedVisit.chiefComplaint || '',
      objective: selectedVisit.objectiveNotes || '',
      assessment: selectedVisit.assessmentNotes || '',
      plan: selectedVisit.planNotes || '',
      diagnosis: selectedVisit.diagnosis || '',
    };
    const origVitals = {
      temperature: selectedVisit.temperature?.toString() || '',
      bloodPressure: selectedVisit.bloodPressure || '',
      heartRate: selectedVisit.heartRate?.toString() || '',
      respiratoryRate: selectedVisit.respiratoryRate?.toString() || '',
      weight: selectedVisit.weight?.toString() || '',
      height: selectedVisit.height?.toString() || '',
      oxygenSaturation: selectedVisit.oxygenSaturation?.toString() || '',
    };
    const origComplaint = selectedVisit.chiefComplaint || '';
    const origTriageOverride = selectedVisit.triageOverride_priority || selectedVisit.triageOverridePriority || '';
    const origDoctorTriageNotes = selectedVisit.doctorTriageNotes || '';
    const current = JSON.stringify({ soap: soapForm, vitals: vitalsForm, complaint: chiefComplaintForm, triageOverride, doctorTriageNotes });
    const original = JSON.stringify({ soap: origSoap, vitals: origVitals, complaint: origComplaint, triageOverride: origTriageOverride, doctorTriageNotes: origDoctorTriageNotes });
    setIsDirty(current !== original);
  }, [soapForm, vitalsForm, chiefComplaintForm, triageOverride, doctorTriageNotes, selectedVisit?._id]);

  // M4: Validate vitals ranges
  const validateVitals = useCallback((form: typeof vitalsForm) => {
    const errors: Record<string, string> = {};
    const temp = parseFloat(form.temperature);
    if (form.temperature && (isNaN(temp) || temp < 30 || temp > 42)) errors.temperature = 'Range: 30-42 C';
    const hr = parseInt(form.heartRate);
    if (form.heartRate && (isNaN(hr) || hr < 20 || hr > 300)) errors.heartRate = 'Range: 20-300 bpm';
    const rr = parseInt(form.respiratoryRate);
    if (form.respiratoryRate && (isNaN(rr) || rr < 5 || rr > 60)) errors.respiratoryRate = 'Range: 5-60 /min';
    const wt = parseFloat(form.weight);
    if (form.weight && (isNaN(wt) || wt < 0.5 || wt > 300)) errors.weight = 'Range: 0.5-300 kg';
    const ht = parseFloat(form.height);
    if (form.height && (isNaN(ht) || ht < 30 || ht > 250)) errors.height = 'Range: 30-250 cm';
    const spo2 = parseInt(form.oxygenSaturation);
    if (form.oxygenSaturation && (isNaN(spo2) || spo2 < 0 || spo2 > 100)) errors.oxygenSaturation = 'Range: 0-100%';
    setVitalsErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  // Validate vitals whenever they change
  useEffect(() => {
    validateVitals(vitalsForm);
  }, [vitalsForm, validateVitals]);

  // M7: Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedVisit) return;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      // Ctrl+S → Save SOAP
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (canContinueClinicalWork) handleSaveVitalsAndSOAP();
        return;
      }
      // Ctrl+Enter → Complete & Next
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canCloseEncounter && !completeVisit.isPending) setConfirmCompleteOpen(true);
        return;
      }
      // Number keys 1-5 switch tabs (only when not in input)
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tabMap: Record<string, string> = { '1': 'soap', '2': 'lab-results', '3': 'timeline' };
        if (tabMap[e.key]) { e.preventDefault(); setActiveTab(tabMap[e.key]); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedVisit, canContinueClinicalWork, canCloseEncounter, completeVisit.isPending]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6" aria-busy="true" aria-label="Loading doctor workbench">
        <div className="mx-auto max-w-7xl space-y-5">
          <Skeleton className="h-14 w-full rounded-xl bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28 rounded-xl bg-slate-200" />)}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <Skeleton className="h-[540px] rounded-xl bg-slate-200" />
            <Skeleton className="h-[540px] rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center rounded-xl border bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mb-4 h-10 w-10 text-amber-600" />
          <h1 className="text-lg font-semibold">Doctor workbench could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">Check your connection, then retry. No clinical information has been changed.</p>
          <Button className="mt-5" onClick={() => refetchDashboard()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Command Bar */}
      <DoctorTopBar
        profile={profile}
        activePatients={activePatients}
        waitingQueue={waitingQueue}
        resultsReady={resultsReady}
        selectedVisitId={selectedVisit?._id}
        onSelectVisit={selectVisit}
        onAcceptVisit={acceptVisit}
        onSelectPatient={handleSelectSearchPatient}
        onAcceptNext={() => { if (waitingQueue.length > 0) acceptVisit(waitingQueue[0]); }}
        onOpenDashboard={openDashboard}
        onOpenResults={() => { if (resultsReady.length > 0) selectVisit(resultsReady[0], 'lab-results'); }}
        onOpenAllPatients={() => { setAllPatientsOpen(true); setAllPatientsPage(1); setAllPatientsSearch(''); setAllPatientsDaysBack(undefined); }}
        onLogout={handleLogout}
        acceptPending={acceptPatient.isPending}
        doctorMode={!!user?.doctorMode}
        onExitDoctorMode={user?.doctorMode ? handleExitDoctorMode : undefined}
      />

      {isDirty && canWriteConsultation && (
        <div className="fixed left-0 right-0 top-[116px] z-50 flex h-11 items-center justify-between border-y border-amber-300 bg-amber-50 px-5 text-xs text-amber-900 shadow-sm md:top-[132px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Unsaved clinical notes — save or discard before switching patients.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-900" onClick={handleSaveVitalsAndSOAP}>Save Draft</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-900" onClick={discardChanges}>Discard Changes</Button>
          </div>
        </div>
      )}

      <div className={cn("flex h-full min-h-0 flex-1", isDirty && canWriteConsultation ? "pt-[160px] md:pt-[176px]" : "pt-[116px] md:pt-[132px]")}>
        {/* Main Workspace */}
        <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f4f7fa] p-3 md:p-4">
              {selectedVisit || searchedPatient ? (
                <div className="flex min-h-0 flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,2.4fr)_minmax(300px,0.85fr)] xl:items-start">
                  {/* Calm Patient Header */}
                  <section className="rounded-md border border-slate-300 bg-white px-4 py-4 shadow-sm md:px-5 xl:col-start-1">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-50">
                          <span className="text-xl font-bold text-teal-800">
                            {contextPatient?.firstName?.[0]}{contextPatient?.lastName?.[0]}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2 flex-wrap">
                            <h2 className="truncate text-2xl font-semibold leading-tight text-slate-950 max-w-[min(100%,420px)]">
                              {[contextPatient?.firstName, contextPatient?.lastName].filter(Boolean).join(' ').trim() || 'Unnamed patient'}
                            </h2>
                            {selectedVisit?.triagePriority && (
                              <Badge variant={selectedVisit.triagePriority.includes('emergency') || selectedVisit.triagePriority.includes('urgent') ? 'destructive' : 'outline'} className="h-5 shrink-0 text-[10px] capitalize">
                                {selectedVisit.triagePriority.replace('esi_', 'ESI ').replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {selectedVisit && isReadOnly && <Badge className="h-5 shrink-0 bg-amber-500 text-[10px] text-white hover:bg-amber-500">View-only</Badge>}
                            <InsuranceStatusBadge
                              insurance={contextPatient?.insurance}
                              coverageType={selectedVisit?.consultationCoverageType}
                              compact
                              className="h-5 shrink-0 text-[10px]"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="font-mono">{contextPatient?.patientId || 'PID N/A'}</span>
                            <span>•</span>
                            <span>{contextPatient?.gender || 'N/A'}</span>
                            <span>•</span>
                            <span>{patientAgeLabel(contextPatient)}</span>
                            {contextPatient?.phone && <><span>•</span><span>{contextPatient.phone}</span></>}
                            {!selectedVisit && searchedPatient && <span className="font-medium text-amber-700">Chart review only - no active visit</span>}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                            {contextPatient?.allergies?.length > 0 ? (
                              <span className="inline-flex max-w-[min(100%,280px)] items-center gap-1.5 font-medium text-red-600">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span className="truncate">Allergies: {contextPatient.allergies.join(', ')}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500">No known drug allergies</span>
                            )}
                            {contextPatient?.bloodGroup && <span className="border-l pl-3 text-slate-700">Blood Group: {contextPatient.bloodGroup}</span>}
                            <span className="border-l pl-3 text-emerald-700">Wallet: Le {selectedWalletBalance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-slate-200 text-xs text-slate-500 sm:grid-cols-3 xl:w-[280px] xl:grid-cols-1 xl:border-l xl:pl-5">
                        <div>
                          <p className="text-[10px]">Visit Type</p>
                          <p className="capitalize text-slate-950">{selectedVisit?.visitType?.replace(/_/g, ' ') || 'Chart review'}</p>
                        </div>
                        <div>
                          <p className="text-[10px]">Visit Date</p>
                          <p className="text-slate-950">{selectedVisit ? formatClinicalDateTime(selectedVisit.consultationStartedAt || selectedVisit.createdAt) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px]">Provider</p>
                          <p className="text-slate-950">{selectedVisit?.doctorId?.fullName || profile?.fullName || user?.fullName || 'Assigned doctor'}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {(selectedVisit?.triageAlert || consultationPaymentBlocksWriting) && (
                    <div className="rounded-lg border border-amber-200 bg-white px-4 py-2 shadow-sm md:px-5 xl:col-start-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {selectedVisit?.triageAlert && (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 font-medium text-red-700">
                            <AlertCircle className="w-3.5 h-3.5" /> {selectedVisit.triageAlert}
                          </span>
                        )}
                        {consultationPaymentBlocksWriting && (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 font-medium text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5" /> Consultation fee unpaid
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid overflow-visible xl:contents">
                    <section className="min-w-0 overflow-visible rounded-md border border-slate-300 bg-white xl:col-start-1">
                      <Tabs value={activeTab} onValueChange={(val) => guardNavigation(() => setActiveTab(val), 'tab', val)} className="flex min-h-0 flex-col">
                        <div className="border-b border-border px-4 md:px-5">
                          <TabsList className="h-11 bg-transparent p-0">
                            <TabsTrigger value="soap" className="rounded-none border-b-2 border-transparent px-0 mr-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">SOAP Notes</TabsTrigger>
                            <TabsTrigger value="lab-results" className="rounded-none border-b-2 border-transparent px-0 mr-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                              Lab Results
                              {displayedLabResults.length > 0 && <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{displayedLabResults.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Timeline</TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="soap" className="m-0 flex-1 overflow-visible p-4 md:p-5">
                          {isChartReviewMode ? (
                            <div className="mx-auto max-w-3xl space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-5 text-sm text-amber-900">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-base font-semibold text-amber-950">Chart review mode</h3>
                                  <p className="mt-1 text-sm">
                                    SOAP notes require an active visit. You can still review this patient's timeline, review lab history, order labs, or prescribe from this chart.
                                  </p>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant="outline" className="bg-white" onClick={() => setActiveTab('timeline')}>
                                      <Clock className="mr-1.5 h-3.5 w-3.5" /> Timeline
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" className="bg-white" onClick={() => setActiveTab('lab-results')}>
                                      <FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Results
                                    </Button>
                                    <Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); }}>
                                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Order Lab
                                    </Button>
                                     <Button type="button" size="sm" variant="secondary" onClick={() => { setEditingPrescription(null); setPrescriptionItems([]); setShorthandInputs({}); setShorthandErrors({}); setPrescriptionModalOpen(true); }}>
                                      <Pill className="mr-1.5 h-3.5 w-3.5" /> Prescribe
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                          <div className="w-full min-w-0 space-y-5 overflow-hidden">
                            <div className="grid gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-3 lg:grid-cols-6 xl:hidden">
                              {[
                                { label: 'BP', value: vitalsForm.bloodPressure || selectedVisit?.bloodPressure || '-', unit: 'mmHg' },
                                { label: 'HR', value: vitalsForm.heartRate || selectedVisit?.heartRate || '-', unit: 'bpm' },
                                { label: 'RR', value: vitalsForm.respiratoryRate || selectedVisit?.respiratoryRate || '-', unit: '/min' },
                                { label: 'Temp', value: vitalsForm.temperature || selectedVisit?.temperature || '-', unit: 'C' },
                                { label: 'SpO2', value: vitalsForm.oxygenSaturation || selectedVisit?.oxygenSaturation || '-', unit: '%' },
                                { label: 'Weight', value: vitalsForm.weight || selectedVisit?.weight || '-', unit: 'kg' },
                              ].map((vital) => (
                                <div key={vital.label} className="rounded-md bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{vital.label}</p>
                                  <p className="mt-0.5 text-base font-semibold text-slate-900">{vital.value}</p>
                                  <p className="text-[10px] text-muted-foreground">{vital.unit}</p>
                                </div>
                              ))}
                            </div>
                            {selectedVisit?.triageNotes && (
                              <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
                                <span className="font-semibold">Triage note:</span> {selectedVisit.triageNotes}
                              </div>
                            )}

                            <div className="space-y-0">
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 py-3 xl:grid-cols-[42px_108px_minmax(0,1fr)] xl:items-start">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">C</div>
                                <div className="space-y-2 xl:contents">
                                  <Label className="pt-2 text-sm font-medium text-slate-950">Chief Complaint</Label>
                                  <Textarea value={chiefComplaintForm} onChange={(e) => setChiefComplaintForm(e.target.value)} onInput={autoResize} placeholder="What brings the patient in today?" rows={2} className="soap-autosize min-h-[56px] break-words border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                </div>
                              </div>
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t py-3 xl:grid-cols-[42px_108px_minmax(0,1fr)] xl:items-start">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">S</div>
                                <div className="space-y-2 xl:contents">
                                  <Label className="pt-2 text-sm font-medium text-slate-950">Subjective</Label>
                                  <Textarea value={soapForm.subjective} onChange={(e) => setSoapForm({ ...soapForm, subjective: e.target.value })} onInput={autoResize} placeholder="Patient history, symptoms, relevant negatives..." rows={3} className="soap-autosize min-h-[76px] break-words border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                </div>
                              </div>
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t py-3 xl:grid-cols-[42px_108px_minmax(0,1fr)] xl:items-start">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">O</div>
                                <div className="space-y-2 xl:contents">
                                  <Label className="pt-2 text-sm font-medium text-slate-950">Objective</Label>
                                  <Textarea value={soapForm.objective} onChange={(e) => setSoapForm({ ...soapForm, objective: e.target.value })} onInput={autoResize} placeholder="Exam findings, observations, reviewed results..." rows={3} className="soap-autosize min-h-[76px] break-words border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                </div>
                              </div>
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t py-3 xl:grid-cols-[42px_108px_minmax(0,1fr)] xl:items-start">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">A</div>
                                <div className="space-y-2 xl:contents">
                                  <Label className="pt-2 text-sm font-medium text-slate-950">Assessment</Label>
                                  <Textarea value={soapForm.assessment} onChange={(e) => setSoapForm({ ...soapForm, assessment: e.target.value })} onInput={autoResize} placeholder="Clinical impression and differential..." rows={3} className="soap-autosize min-h-[76px] break-words border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                </div>
                              </div>
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t py-3 xl:grid-cols-[42px_108px_minmax(0,1fr)] xl:items-center">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-950 text-white"><ClipboardList className="h-4 w-4" /></div>
                                <div className="space-y-2 xl:contents">
                                  <Label className="text-sm font-medium text-slate-950">Diagnosis</Label>
                                  <Input value={soapForm.diagnosis} onChange={(e) => setSoapForm({ ...soapForm, diagnosis: e.target.value })} placeholder="Primary diagnosis" className="h-9 border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                </div>
                              </div>
                              <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t py-3 xl:grid-cols-[42px_108px_minmax(0,1fr)] xl:items-start">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">P</div>
                                <div className="min-w-0 space-y-2 xl:contents">
                                  <div className="flex items-center justify-between gap-2 xl:contents">
                                    <Label className="pt-2 text-sm font-medium text-slate-950">Plan</Label>
                                    <div className="flex shrink-0 gap-1 xl:col-start-3 xl:justify-self-end xl:row-start-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                        onClick={() => setTreatmentPlanOpen(true)}
                                        disabled={isReadOnly || !canWriteConsultation || !contextPatient}
                                      >
                                        <ClipboardList className="w-3 h-3" /> Treatment Plan
                                      </Button>
                                      {currentVisitPlans.length > 0 && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                          onClick={() => {
                                            const allItems = currentVisitPlans.flatMap((p: any) => p.items || []);
                                            const summary = generatePlanSummary(allItems);
                                            setSoapForm(prev => ({ ...prev, plan: summary }));
                                            toast.success('Plan text synced from treatment plans');
                                          }}
                                        >
                                          <RefreshCw className="w-3 h-3" /> Sync
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <Textarea value={soapForm.plan} onChange={(e) => setSoapForm({ ...soapForm, plan: e.target.value })} onInput={autoResize} placeholder="Treatment plan, follow-up, counselling..." rows={3} className="soap-autosize min-h-[76px] break-words border-muted-foreground/20 bg-white text-sm xl:col-start-3" disabled={isReadOnly || !canWriteConsultation} />
                                  {currentVisitPlans.length > 0 && (
                                    <div className="space-y-1.5 xl:col-start-3">
                                      {currentVisitPlans.map((plan: any) => (
                                        <div key={plan._id} className="rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-1.5">
                                          <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <span className="font-medium text-foreground">{plan.planNumber}</span>
                                            <Badge variant="outline" className={cn('h-3.5 px-1 py-0 text-[9px]', PLAN_STATUS_COLORS[plan.status] || 'bg-slate-100 text-slate-600 border-slate-200')}>{plan.status.replace('_', ' ')}</Badge>
                                            {plan.totalAmount > 0 && <span>Le{plan.totalAmount.toLocaleString()}</span>}
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {(plan.items || []).slice(0, 6).map((item: any, idx: number) => {
                                              const Icon = item.type === 'drug' || item.type === 'iv' ? Pill : item.type === 'lab' ? FlaskConical : item.type === 'procedure' ? Scissors : FileText;
                                              return (
                                                <span key={idx} className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700">
                                                  <Icon className="h-2.5 w-2.5 text-slate-500" />
                                                  {(item.description || item.medicationName || item.testName || '').slice(0, 20)}
                                                </span>
                                              );
                                            })}
                                            {(plan.items || []).length > 6 && <span className="text-[10px] text-muted-foreground">+{(plan.items || []).length - 6} more</span>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          )}
                        </TabsContent>

                        <TabsContent value="lab-results" className="m-0 flex-1 overflow-y-auto bg-slate-50/60 p-3 md:p-5">
                          {patientId ? (
                            <div className="mx-auto max-w-6xl space-y-4">
                              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-base font-semibold text-slate-950">Results review</h3>
                                      {criticalLabResults.length > 0 && (
                                        <Badge className="bg-red-600 text-white">{criticalLabResults.length} critical</Badge>
                                      )}
                                      {abnormalLabResults.length > 0 && criticalLabResults.length === 0 && (
                                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{abnormalLabResults.length} abnormal</Badge>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {selectedVisit
                                        ? `Current visit LIS results for ${patientDisplayName(selectedVisit)}.`
                                        : `Patient lab history for ${[contextPatient?.firstName, contextPatient?.lastName].filter(Boolean).join(' ').trim() || 'this patient'}.`}
                                      {' '}Last result: {formatClinicalDateTime(latestResultAt)}.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() => {
                                        if (selectedVisit) queryClient.invalidateQueries({ queryKey: ['results', labOrderId] });
                                        else queryClient.invalidateQueries({ queryKey: ['patient-chart', patientId] });
                                      }}
                                    >
                                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      disabled={sortedLabResults.length === 0 || !labOrderId}
                                      onClick={() => {
                                        if (labOrderId) window.open(`/lab/reports/${labOrderId}`, '_blank');
                                      }}
                                    >
                                      <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                                      disabled={sortedLabResults.length === 0}
                                      onClick={() => {
                                        setReviewedResultIds(new Set(sortedLabResults.map((r: LabResult) => r._id)));
                                        toast.success('Results marked reviewed');
                                      }}
                                    >
                                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Mark reviewed
                                    </Button>
                                  </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                                  {[
                                    { label: 'Total', value: sortedLabResults.length, tone: 'bg-slate-100 text-slate-700' },
                                    { label: 'Critical', value: criticalLabResults.length, tone: 'bg-red-50 text-red-700' },
                                    { label: 'Abnormal', value: abnormalLabResults.length, tone: 'bg-amber-50 text-amber-700' },
                                    { label: 'Reviewed', value: sortedLabResults.filter((r: LabResult) => reviewedResultIds.has(r._id)).length, tone: 'bg-emerald-50 text-emerald-700' },
                                  ].map((item) => (
                                    <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                                      <p className={cn('mt-1 inline-flex min-w-10 rounded-md px-2 py-0.5 text-lg font-bold', item.tone)}>{item.value}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {abnormalLabResults.length > 0 && (
                                <div className="grid gap-3 lg:grid-cols-2">
                                  {abnormalLabResults.slice(0, 2).map((result: LabResult) => (
                                    <div key={result._id} className={cn('rounded-xl border p-3 shadow-sm', getResultRiskTone(result.flag))}>
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-[10px] font-bold uppercase tracking-wide">Needs review</p>
                                          <p className="mt-1 truncate text-sm font-semibold">{result.testName}</p>
                                          <p className="text-xs opacity-80">Ref: {result.referenceRange || result.reference_range || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-lg font-bold">{result.value}{result.unit ? ` ${result.unit}` : ''}</p>
                                          <p className="text-[10px] font-semibold uppercase">{getFlagLabel(result.flag)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {sortedLabResults.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-muted-foreground">
                                  {selectedVisit ? 'No released lab results yet for this visit.' : 'No released lab results found in this patient chart.'}
                                </div>
                              ) : (
                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                  <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_96px_118px] gap-3 border-b bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground max-lg:hidden">
                                    <button type="button" className="text-left" onClick={() => toggleLabSort('testName')}>Test</button>
                                    <button type="button" className="text-left" onClick={() => toggleLabSort('value')}>Value</button>
                                    <span>Reference</span>
                                    <button type="button" className="text-left" onClick={() => toggleLabSort('flag')}>Flag</button>
                                    <span className="text-right">Review</span>
                                  </div>
                                  <div className="divide-y divide-slate-100">
                                    {sortedLabResults.map((result: LabResult) => {
                                      const reviewed = reviewedResultIds.has(result._id);
                                      return (
                                        <div key={result._id} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_96px_118px] lg:items-center">
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <p className="truncate text-sm font-semibold text-slate-950">{result.testName}</p>
                                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{result.testCode}</span>
                                            </div>
                                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                              <Clock className="h-3 w-3" /> {formatClinicalDateTime(result.resulted_at || result.createdAt)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Value</p>
                                            <p className="text-sm font-bold text-slate-950">{result.value}{result.unit ? ` ${result.unit}` : ''}</p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Reference</p>
                                            <p className="text-xs text-muted-foreground">{result.referenceRange || result.reference_range || 'N/A'}</p>
                                          </div>
                                          <div>
                                            <Badge variant="outline" className={cn('border text-[10px]', getResultRiskTone(result.flag))}>{getFlagLabel(result.flag)}</Badge>
                                          </div>
                                          <div className="flex items-center justify-start gap-2 lg:justify-end">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant={reviewed ? 'outline' : 'default'}
                                              className={cn('h-7 px-2 text-xs', !reviewed && 'bg-primary text-primary-foreground hover:bg-primary/90')}
                                              onClick={() => setReviewedResultIds((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(result._id)) next.delete(result._id);
                                                else next.add(result._id);
                                                return next;
                                              })}
                                            >
                                              {reviewed ? 'Reviewed' : 'Review'}
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center text-sm text-muted-foreground">Select a patient to view lab results</div>
                          )}
                        </TabsContent>

                        <TabsContent value="timeline" className="m-0 flex-1 overflow-y-auto">
                          {patientId ? (
                            <PatientTimeline patientId={patientId} patientChart={patientChart} patientVisits={patientVisits} patientOrders={patientOrders} patientPrescriptions={patientPrescriptions} chartLoading={chartLoading} onNavigate={setActiveTab} />
                          ) : (
                            <div className="py-12 text-center text-sm text-muted-foreground">Select a patient to view timeline</div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </section>

                    <aside className="space-y-3 xl:col-start-2 xl:row-start-1 xl:row-span-5">
                      <section className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-950">Vitals Summary</h3>
                          <details className="group text-right">
                            <summary className="cursor-pointer list-none text-[11px] font-medium text-blue-700">Edit</summary>
                            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border bg-slate-50 p-3 text-left">
                              {[
                                { key: 'temperature', label: 'Temperature', placeholder: '36.5', type: 'number' },
                                { key: 'bloodPressure', label: 'Blood pressure', placeholder: '120/80', type: 'text' },
                                { key: 'heartRate', label: 'Heart rate', placeholder: '72', type: 'number' },
                                { key: 'respiratoryRate', label: 'Respiratory rate', placeholder: '16', type: 'number' },
                                { key: 'weight', label: 'Weight', placeholder: '70', type: 'number' },
                                { key: 'oxygenSaturation', label: 'SpO2', placeholder: '98', type: 'number' },
                              ].map((field) => (
                                <div key={field.key}>
                                  <Label className="text-[9px] text-muted-foreground">{field.label}</Label>
                                  <Input type={field.type} value={(vitalsForm as any)[field.key]} onChange={(event) => setVitalsForm({ ...vitalsForm, [field.key]: event.target.value })} placeholder={field.placeholder} className={cn('mt-1 h-7 bg-white text-[11px]', (vitalsErrors as any)[field.key] && 'border-red-400')} disabled={isReadOnly || !canWriteConsultation} />
                                  {(vitalsErrors as any)[field.key] && <p className="mt-0.5 text-[9px] text-red-600">{(vitalsErrors as any)[field.key]}</p>}
                                </div>
                              ))}
                              <div className="col-span-2">
                                <Label className="text-[9px] text-muted-foreground">Priority Override</Label>
                                <Select value={triageOverride || selectedVisit?.triagePriority || ''} onValueChange={setTriageOverride} disabled={isReadOnly || !canWriteConsultation}>
                                  <SelectTrigger className="mt-1 h-7 bg-white text-[11px]"><SelectValue placeholder="Set priority" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="esi_1_emergency">ESI 1 - Emergency</SelectItem>
                                    <SelectItem value="esi_2_urgent">ESI 2 - Urgent</SelectItem>
                                    <SelectItem value="esi_3_urgent">ESI 3 - Urgent</SelectItem>
                                    <SelectItem value="esi_4_less_urgent">ESI 4 - Less Urgent</SelectItem>
                                    <SelectItem value="esi_5_non_urgent">ESI 5 - Non Urgent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </details>
                        </div>
                        <div className="grid grid-cols-3 gap-y-3 sm:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
                          {[
                            { label: 'Temp', value: vitalsForm.temperature || selectedVisit?.temperature || '—', unit: '°C', alert: Number(vitalsForm.temperature || selectedVisit?.temperature || 0) >= 38 },
                            { label: 'BP', value: vitalsForm.bloodPressure || selectedVisit?.bloodPressure || '—', unit: 'mmHg' },
                            { label: 'HR', value: vitalsForm.heartRate || selectedVisit?.heartRate || '—', unit: 'bpm' },
                            { label: 'RR', value: vitalsForm.respiratoryRate || selectedVisit?.respiratoryRate || '—', unit: '/min' },
                            { label: 'SpO₂', value: vitalsForm.oxygenSaturation || selectedVisit?.oxygenSaturation || '—', unit: '%' },
                            { label: 'Wt', value: vitalsForm.weight || selectedVisit?.weight || '—', unit: 'kg' },
                          ].map((vital) => (
                            <div key={vital.label} className="px-1 text-center">
                              <p className="text-[9px] text-slate-500">{vital.label}</p>
                              <p className={cn('mt-1 text-sm font-semibold', vital.alert ? 'text-red-600' : 'text-slate-950')}>{vital.value}</p>
                              <p className="mt-0.5 text-[8px] text-slate-500">{vital.unit}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      {abnormalLabResults[0] ? (
                        <button type="button" onClick={() => setActiveTab('lab-results')} className="w-full rounded-md border border-red-300 bg-red-50 p-4 text-left shadow-sm">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-950">Critical Lab Alert</h3>
                            <span className="text-[11px] font-medium text-blue-700">View Lab Results</span>
                          </div>
                          <div className="flex items-center gap-3 rounded-md border border-red-300 bg-white p-3">
                            <div className="rounded-md bg-red-600 p-2 text-white"><FlaskConical className="h-5 w-5" /></div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-slate-950">{abnormalLabResults[0].testName}</p>
                              <p className="text-[10px] text-slate-500">{formatClinicalDateTime(abnormalLabResults[0].resulted_at || abnormalLabResults[0].createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-red-600">{abnormalLabResults[0].value} {abnormalLabResults[0].unit}</p>
                              <span className="rounded bg-red-600 px-2 py-1 text-[9px] font-semibold text-white">{getFlagLabel(abnormalLabResults[0].flag)}</span>
                            </div>
                          </div>
                        </button>
                      ) : null}

                      <section className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
                        <h3 className="mb-3 text-sm font-semibold text-slate-950">Clinical Actions</h3>
                        <div className="divide-y overflow-hidden rounded-md border border-slate-200">
                          {[
                            { label: 'Order Labs', detail: 'Order laboratory investigations', icon: FlaskConical, tone: 'bg-teal-700', disabled: !contextPatient, onClick: () => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); } },
                            { label: 'Prescribe', detail: 'Create prescription', icon: Pill, tone: 'bg-blue-700', disabled: !contextPatient, onClick: () => { setEditingPrescription(null); setPrescriptionItems([]); setShorthandInputs({}); setShorthandErrors({}); setPrescriptionModalOpen(true); } },
                            { label: 'Treatment Plan', detail: 'Create or update treatment plan', icon: ClipboardList, tone: 'bg-purple-700', disabled: !contextPatient, onClick: () => setTreatmentPlanOpen(true) },
                            { label: 'Refer', detail: 'Refer to specialist or service', icon: Send, tone: 'bg-orange-600', disabled: !selectedVisit, onClick: () => { setReferralOpen(true); setReferralForm({ specialistId: '', reason: '', notes: '' }); } },
                            { label: 'Admit', detail: 'Admit to inpatient', icon: BedDouble, tone: 'bg-blue-900', disabled: !selectedVisit, onClick: () => setAdmitOpen(true) },
                          ].map((action) => {
                            const Icon = action.icon;
                            return (
                              <button key={action.label} type="button" onClick={action.onClick} disabled={action.disabled} className="flex w-full items-center gap-3 bg-white px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                                <span className={cn('rounded p-2 text-white', action.tone)}><Icon className="h-4 w-4" /></span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-semibold text-slate-950">{action.label}</span>
                                  <span className="block truncate text-[9px] text-slate-500">{action.detail}</span>
                                </span>
                                <ChevronRight className="h-4 w-4 text-slate-500" />
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      <section className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-950">Visit & Queue Summary</h3>
                          <button type="button" className="text-[11px] font-medium text-blue-700" onClick={openDashboard}>View Queue</button>
                        </div>
                        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200">
                          {[
                            { label: 'Queue', value: waitingQueue.length, detail: 'Waiting' },
                            { label: 'Results', value: resultsReady.length, detail: 'To review' },
                            { label: 'Urgent', value: waitingQueue.filter((visit: Visit) => visit.triagePriority?.includes('urgent') || visit.triagePriority?.includes('emergency')).length, detail: 'Attention', alert: true },
                            { label: 'Active', value: activePatients.length, detail: 'In consult' },
                          ].map((item) => (
                            <div key={item.label} className="bg-white px-3 py-3 text-center">
                              <p className={cn('text-[10px] font-medium', item.alert ? 'text-red-600' : 'text-slate-500')}>{item.label}</p>
                              <p className={cn('my-1 text-xl font-semibold', item.alert ? 'text-red-600' : 'text-slate-950')}>{item.value}</p>
                              <p className="text-[10px] text-slate-500">{item.detail}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    </aside>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                  {/* Today's Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { if (activePatients.length > 0) selectVisit(activePatients[0]); }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-blue-600" />
                        </div>
                        <Badge variant="secondary" className="text-xs">{openEncounterCount} active</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stats.seen}</p>
                      <p className="text-xs text-muted-foreground mt-1">Patients seen today</p>
                    </div>

                    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { if (waitingQueue.length > 0) acceptVisit(waitingQueue[0]); }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-amber-600" />
                        </div>
                        <Badge variant="secondary" className="text-xs">in queue</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stats.waiting}</p>
                      <p className="text-xs text-muted-foreground mt-1">Patients waiting</p>
                    </div>

                    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { if (resultsReady.length > 0) selectVisit(resultsReady[0], 'lab-results'); }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <FlaskConical className="w-5 h-5 text-green-600" />
                        </div>
                        <Badge variant="secondary" className="text-xs">ready</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{resultsReady.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Lab results ready</p>
                    </div>

                    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-primary" />
                        </div>
                        <Badge variant="secondary" className="text-xs">completed</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                      <p className="text-xs text-muted-foreground mt-1">Visits completed</p>
                    </div>
                  </div>

                  {/* Waiting Queue */}
                  {waitingQueue.length > 0 && (
                    <div className="bg-white border border-border rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          Waiting Queue ({waitingQueue.length})
                        </h3>
                        <Button size="sm" onClick={() => acceptVisit(waitingQueue[0])} disabled={acceptPatient.isPending}>
                          {acceptPatient.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 mr-1.5" />}
                          Accept Next
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {waitingQueue.slice(0, 5).map((visit: Visit) => (
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => acceptVisit(visit)}>
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">
                                  {visit.patientId?.firstName?.[0]}{visit.patientId?.lastName?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{patientDisplayName(visit)}</p>
                                <p className="text-xs text-muted-foreground truncate">{visit.chiefComplaint || 'No complaint'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {visit.triagePriority && (
                                <span className={cn("w-2 h-2 rounded-full", visit.triagePriority.includes('emergency') || visit.triagePriority.includes('urgent') ? "bg-red-500 animate-pulse" : "bg-amber-500")} />
                              )}
                              <Badge variant="outline" className="text-[10px]">{visit.visitNumber}</Badge>
                            </div>
                          </div>
                        ))}
                        {waitingQueue.length > 5 && (
                          <p className="text-xs text-center text-muted-foreground pt-2">+ {waitingQueue.length - 5} more in queue</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Results Ready */}
                  {resultsReady.length > 0 && (
                    <div className="bg-white border border-green-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <FlaskConical className="w-4 h-4 text-green-600" />
                          Lab Results Ready ({resultsReady.length})
                        </h3>
                        <Button size="sm" variant="outline" onClick={() => selectVisit(resultsReady[0], 'lab-results')}>
                          <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                          Review Results
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {resultsReady.slice(0, 3).map((visit: Visit) => (
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50/50 hover:bg-green-100/50 transition-colors cursor-pointer" onClick={() => selectVisit(visit, 'lab-results')}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-green-700">
                                  {visit.patientId?.firstName?.[0]}{visit.patientId?.lastName?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{patientDisplayName(visit)}</p>
                                <p className="text-xs text-muted-foreground truncate">{visit.chiefComplaint || 'Results available'}</p>
                              </div>
                            </div>
                            <Badge className="bg-green-600 text-white text-[10px] shrink-0">Results Ready</Badge>
                          </div>
                        ))}
                        {resultsReady.length > 3 && (
                          <p className="text-xs text-center text-muted-foreground pt-2">+ {resultsReady.length - 3} more results ready</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Active Encounters */}
                  {activePatients.length > 0 && (
                    <div className="bg-white border border-border rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-600" />
                          Active Encounters ({activePatients.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {activePatients.map((visit: Visit) => (
                          <div key={visit._id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 cursor-pointer" onClick={() => selectVisit(visit)}>
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-blue-700">
                                  {visit.patientId?.firstName?.[0]}{visit.patientId?.lastName?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium">{patientDisplayName(visit)}</p>
                                <p className="break-words text-xs text-muted-foreground">{visit.chiefComplaint || 'In consultation'}</p>
                              </div>
                            </div>
                            <Badge className={cn("text-[10px] shrink-0", visitStatusTone(visit.status))}>{statusLabel(visit.status)}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incoming Referrals */}
                  {incomingReferrals.length > 0 && (
                    <div className="bg-white border border-purple-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-purple-600" />
                          Incoming Referrals ({incomingReferrals.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {incomingReferrals.slice(0, 5).map((visit: Visit) => (
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100/50 transition-colors cursor-pointer" onClick={() => selectVisit(visit)}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-purple-700">
                                  {visit.patientId?.firstName?.[0]}{visit.patientId?.lastName?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{patientDisplayName(visit)}</p>
                                <p className="text-xs text-muted-foreground truncate">{visit.chiefComplaint || 'Referred to you'}</p>
                              </div>
                            </div>
                            <Badge className="bg-purple-500 text-white text-[10px] shrink-0">Referral</Badge>
                          </div>
                        ))}
                        {incomingReferrals.length > 5 && (
                          <p className="text-xs text-center text-muted-foreground pt-2">+ {incomingReferrals.length - 5} more referrals</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Admitted Patients */}
                  {admittedPatients.length > 0 && (
                    <div className="bg-white border border-blue-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <BedDouble className="w-4 h-4 text-blue-600" />
                          My Admitted Patients ({admittedPatients.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {admittedPatients.slice(0, 5).map((visit: Visit) => (
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-colors cursor-pointer" onClick={() => selectVisit(visit)}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-blue-700">
                                  {visit.patientId?.firstName?.[0]}{visit.patientId?.lastName?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{patientDisplayName(visit)}</p>
                                <p className="text-xs text-muted-foreground truncate">{visit.chiefComplaint || 'Admitted'}</p>
                              </div>
                            </div>
                            <Badge className="bg-blue-600 text-white text-[10px] shrink-0">Admitted</Badge>
                          </div>
                        ))}
                        {admittedPatients.length > 5 && (
                          <p className="text-xs text-center text-muted-foreground pt-2">+ {admittedPatients.length - 5} more admitted</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empty State - No patients at all */}
                  {waitingQueue.length === 0 && resultsReady.length === 0 && activePatients.length === 0 && incomingReferrals.length === 0 && admittedPatients.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="max-w-md text-center">
                        <User className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                        <h2 className="text-xl font-semibold">All caught up!</h2>
                        <p className="text-sm text-muted-foreground mt-2">No patients waiting. Use the search box to view any patient's chart or check back later.</p>
                        <p className="text-[11px] text-muted-foreground mt-5">
                          <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">1-3</kbd> Switch tabs · <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">Ctrl+S</kbd> Save · <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">Ctrl+Enter</kbd> Complete
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>

          {selectedVisit && (
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 md:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  {isDirty ? <span className="font-medium text-amber-700">Unsaved changes</span> : <span>All changes saved</span>}
                  {selectedVisit?.room && <span className="ml-3">Room: {selectedVisit.room}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleSaveVitalsAndSOAP} disabled={updateVisit.isPending || isReadOnly || !canWriteConsultation}>
                    {updateVisit.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                    Save Draft
                  </Button>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setConfirmCompleteOpen(true)} disabled={completeVisit.isPending || !canCloseEncounter || isReadOnly || !canWriteConsultation}>
                    {completeVisit.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-2 h-3.5 w-3.5" />}
                    Complete & Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* All Modals */}

      {/* Lab Order Modal */}
      <Dialog open={labOrderModalOpen} onOpenChange={(open) => { if (!open) cancelEdit(); setLabOrderModalOpen(open); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="border-b bg-white px-6 pb-4 pt-6">
            <ReportHeader laboratoryInfo={{
              name: 'Harbour Medical Diagnostic',
              logo: LIS_LOGO_URL,
              address: branch?.address || '',
              phone: branch?.phone || '',
              email: branch?.email || '',
              website: branch?.website,
            }} />
            <DialogTitle className="pt-2 text-left text-base">{editingOrder ? 'Edit LIS Test Request' : 'Create LIS Test Request'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 px-6 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Search Tests</Label>
              <Input value={searchTest} onChange={(e) => setSearchTest(e.target.value)} placeholder="Search by test name or code..." className="mt-1" />
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {testsLoading ? (
                  <div className="h-full p-6 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />Loading LIS catalog
                  </div>
                ) : testsError ? (
                  <div className="p-6 text-center text-sm text-red-600">
                    Could not load LIS catalog.
                    <p className="mt-1 text-xs text-muted-foreground">{(testsLoadError as any)?.response?.data?.message || (testsLoadError as any)?.message || 'Check backend LIS connection.'}</p>
                  </div>
                ) : filteredTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No LIS tests or panels found</div>
                ) : (
                  filteredTests.map((test: Test) => (
                    <div key={test._id || test.code} className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 flex items-center justify-between" onClick={() => addTestToOrder(test)}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{test.name}</p>
                          {test.isPanel && <Badge variant="outline" className="text-[10px] h-5">Panel</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{test.code} - Le {test.price?.toLocaleString()}{test.isPanel && test.panelComponents && <span className="ml-1">({test.panelComponents.length} components)</span>}</p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
            <div>
              <Label className="text-sm font-medium">Selected Tests ({selectedTests.length})</Label>
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {selectedTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Click tests to add them</div>
                ) : (
                  <div className="divide-y">
                    {selectedTests.map((test) => (
                      <div key={test._id || test.code} className="p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{test.name}</p>
                            {test.isPanel && <Badge variant="outline" className="text-[10px] h-5">Panel</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">Le {test.price?.toLocaleString()}</p>
                          {test.isPanel && test.panelComponents && test.panelComponents.length > 0 && (
                            <div className="mt-1.5 ml-2 pl-2 border-l-2 border-primary/30">
                              {test.panelComponents.map((comp: any, idx: number) => (
                                <p key={idx} className="text-[11px] text-muted-foreground">• {comp.testName || comp.testCode}</p>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeTestFromOrder(test._id || test.code)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {selectedTests.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Total: Le {selectedTests.reduce((sum, t) => sum + (t.price || 0), 0).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t bg-slate-50 px-6 py-4">
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button onClick={() => editingOrder ? updateLabOrder.mutate() : createLabOrder.mutate()} disabled={(editingOrder ? updateLabOrder.isPending : createLabOrder.isPending) || selectedTests.length === 0}>
              {(editingOrder ? updateLabOrder.isPending : createLabOrder.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {editingOrder ? 'Update Order' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prescription Modal */}
      <Dialog open={prescriptionModalOpen} onOpenChange={(open) => { if (!open) cancelEdit(); setPrescriptionModalOpen(open); }}>
        <DialogContent className="grid h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none bg-slate-50 p-0 sm:h-[94vh] sm:w-[96vw] sm:max-w-none sm:rounded-lg lg:w-[94vw] xl:w-[92vw]">
          <DialogHeader className="border-b bg-white px-4 py-3 pr-12 sm:px-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <DialogTitle className="text-base">{editingPrescription ? 'Edit Prescription' : 'Prescribe Medication'}</DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {patientDisplayName(selectedVisit || ({ patientId: contextPatient } as Visit))} {contextPatient?.patientId ? `- ${contextPatient.patientId}` : ''} - doctor estimate only; reception finalizes packs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {contextPatient?.allergies?.length > 0 ? (
                  <Badge variant="destructive" className="h-7 px-2.5 text-xs">
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Allergy: {contextPatient.allergies.slice(0, 2).join(', ')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-7 border-emerald-200 bg-emerald-50 px-2.5 text-xs text-emerald-700">
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> No allergies recorded
                  </Badge>
                )}
                <Badge variant="outline" className="h-7 bg-white px-2.5 text-xs">{prescriptionItems.length} item{prescriptionItems.length !== 1 ? 's' : ''}</Badge>
              </div>
            </div>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden p-3 sm:p-4">
            {contextPatient?.allergies?.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-800">Allergy alert</p>
                  <p className="text-[11px] text-red-700">Patient allergies: <span className="font-medium">{contextPatient.allergies.join(', ')}</span>. Verify each medication before prescribing.</p>
                </div>
              </div>
            )}
            <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,0.28fr)_minmax(480px,1fr)]">
              <MedicationPicker
                medications={filteredMedications}
                loading={medicationsLoading}
                searchTerm={searchMedication}
                onSearchTermChange={setSearchMedication}
                onSelect={(med) => addMedicationToPrescription(med as Medication)}
                title="Search CAF / local drugs"
                className="min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:min-h-0"
                listClassName="h-[32vh] lg:h-[calc(94vh-13rem)]"
              />
              <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <Label className="text-sm font-semibold text-slate-950">Prescription instructions</Label>
                    <p className="text-[11px] text-muted-foreground">Select a drug, then write exactly how the patient should take it.</p>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-[10px]">Reception prices</Badge>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  {prescriptionItems.length === 0 ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Select a medication from the left to start.
                    </div>
                  ) : (
                    <div className="space-y-2 p-3">
                      {prescriptionItems.map((item, index) => {
                        const duplicateCount = prescriptionItems.filter((c) => c.medicationId === item.medicationId).length;
                        const isDuplicate = duplicateCount > 1;
                        return (
                          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            {/* Header: drug name + badges + remove */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-sm font-semibold text-slate-950">{item.medicationName}</p>
                                  {item.isControlled && <Badge variant="destructive" className="text-[10px]">Controlled</Badge>}
                                  {isDuplicate && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">Duplicate</Badge>}
                                  {(item.route === 'intravenous' || item.route === 'intramuscular') && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">{item.route === 'intravenous' ? 'IV' : 'IM'}</Badge>}
                                  {item.__cafProduct && <Badge variant="outline" className="border-purple-200 bg-purple-50 text-[10px] text-purple-700">CAF</Badge>}
                                  {item.isPrn && <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] text-orange-700">PRN</Badge>}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => removePrescriptionItem(index)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>

                            <div className="mt-3 grid gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                              <Select value={item.route || 'oral'} onValueChange={(v) => updatePrescriptionItem(index, 'route', v)}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="oral">Oral</SelectItem>
                                  <SelectItem value="intravenous">IV</SelectItem>
                                  <SelectItem value="intramuscular">IM</SelectItem>
                                  <SelectItem value="subcutaneous">SC</SelectItem>
                                  <SelectItem value="topical">Topical</SelectItem>
                                  <SelectItem value="ophthalmic">Eye</SelectItem>
                                  <SelectItem value="otic">Ear</SelectItem>
                                  <SelectItem value="nasal">Nasal</SelectItem>
                                  <SelectItem value="inhalation">Inhale</SelectItem>
                                </SelectContent>
                              </Select>
                              <Textarea
                                placeholder="Write instruction, including strength if needed. Example: 500mg BD for 5 days after food"
                                value={item.instructions || ''}
                                onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)}
                                className="min-h-[72px] resize-none text-sm"
                              />
                            </div>

                            {/* Pharmacist note (collapsible) */}
                            <details className="mt-1.5 group">
                              <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-slate-700 select-none">Pharmacist note</summary>
                              <Input placeholder="Internal note for pharmacist" value={item.pharmacistNote || ''} onChange={(e) => updatePrescriptionItem(index, 'pharmacistNote', e.target.value)} className="mt-1 h-7 text-[11px]" />
                            </details>

                            {!hasPrescriptionInstruction(item) && (
                              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] text-red-700">
                                Instruction is required before sending to reception.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                {/* Summary footer inside the right panel */}
                {prescriptionItems.length > 0 && (
                  <div className="border-t bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Reception pricing</p>
                        <p className="text-sm font-semibold text-slate-950">Priced at dispense</p>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        <p>{prescriptionItems.length} medication{prescriptionItems.length !== 1 ? 's' : ''} prescribed</p>
                        <p>Reception finalizes packs at dispense</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t bg-white px-4 py-3 sm:px-5">
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => editingPrescription ? updatePrescription.mutate() : createPrescription.mutate()} disabled={(editingPrescription ? updatePrescription.isPending : createPrescription.isPending) || prescriptionItems.length === 0 || prescriptionItems.some(i => !hasPrescriptionInstruction(i))}>
              {(editingPrescription ? updatePrescription.isPending : createPrescription.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {editingPrescription ? 'Update Prescription' : 'Create Prescription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Referral Modal */}
      <Dialog open={referralOpen} onOpenChange={setReferralOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refer to Specialist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Specialist</Label>
              <Select value={referralForm.specialistId} onValueChange={(v) => setReferralForm({ ...referralForm, specialistId: v })}>
                <SelectTrigger><SelectValue placeholder="Select specialist" /></SelectTrigger>
                <SelectContent>
                  {specialists.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No specialists registered. Add them in Admin - Doctors.</div>
                  ) : (
                    specialists.map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>{s.fullName} - {s.specialty?.replace(/_/g, ' ')}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reason for Referral *</Label><Input value={referralForm.reason} onChange={(e) => setReferralForm({ ...referralForm, reason: e.target.value })} placeholder="e.g., Suspected cardiac arrhythmia" /></div>
            <div><Label>Notes</Label><Textarea value={referralForm.notes} onChange={(e) => setReferralForm({ ...referralForm, notes: e.target.value })} rows={3} placeholder="Relevant history, findings, and recommended next steps..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferralOpen(false)}>Cancel</Button>
            <Button onClick={async () => { if (!selectedVisit) return; try { await referToSpecialist.mutateAsync({ visitId: selectedVisit._id || selectedVisit.id || '', data: referralForm }); toast.success('Patient referred to specialist'); setReferralOpen(false); setReferralForm({ specialistId: '', reason: '', notes: '' }); setSelectedVisit(null); } catch { /* hook onError shows toast */ } }} disabled={referToSpecialist.isPending || !referralForm.specialistId || !referralForm.reason}>
              {referToSpecialist.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}Refer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admit Patient Modal */}
      <Dialog open={admitOpen} onOpenChange={setAdmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ward Type</Label>
                <Select value={admitForm.wardType} onValueChange={(v) => setAdmitForm({ ...admitForm, wardType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="icu">ICU</SelectItem>
                    <SelectItem value="maternity">Maternity</SelectItem>
                    <SelectItem value="pediatric">Pediatric</SelectItem>
                    <SelectItem value="isolation">Isolation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Bed Number</Label><Input value={admitForm.bedNumber} onChange={(e) => setAdmitForm({ ...admitForm, bedNumber: e.target.value })} placeholder="e.g., B-12" /></div>
            </div>
            <div><Label>Admission Reason *</Label><Input value={admitForm.admissionReason} onChange={(e) => setAdmitForm({ ...admitForm, admissionReason: e.target.value })} placeholder="Primary reason for admission" /></div>
            <div><Label>Working Diagnosis</Label><Input value={admitForm.diagnosis} onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })} placeholder="Optional" /></div>
            <div><Label>Notes</Label><Textarea value={admitForm.notes} onChange={(e) => setAdmitForm({ ...admitForm, notes: e.target.value })} rows={3} placeholder="Handoff notes for the nursing team..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitOpen(false)}>Cancel</Button>
            <Button onClick={() => createAdmission.mutate()} disabled={createAdmission.isPending || !admitForm.admissionReason}>
              {createAdmission.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BedDouble className="w-4 h-4 mr-2" />}Admit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Treatment Plan Modal */}
      <Dialog open={treatmentPlanOpen} onOpenChange={setTreatmentPlanOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Treatment Plan</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <TreatmentPlanBuilder
              preselectedVisitId={selectedVisit?._id || selectedVisit?.id}
              preselectedPatientId={!selectedVisit ? contextPatient?._id : undefined}
              preselectedPatientName={!selectedVisit ? [contextPatient?.firstName, contextPatient?.lastName].filter(Boolean).join(' ').trim() : undefined}
              onPlanCreated={(plan) => {
                setTreatmentPlanOpen(false);
                queryClient.invalidateQueries({ queryKey: ['visits'] });
                queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
                if (plan?.items && plan.items.length > 0) {
                  const summary = generatePlanSummary(plan.items, plan.notes);
                  setSoapForm(prev => ({
                    ...prev,
                    plan: prev.plan ? prev.plan + '\n' + summary : summary,
                  }));
                  toast.success('Plan summary added to SOAP notes');
                }
              }}
              inline
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Visit Confirmation */}
      <Dialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete this visit?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will close the encounter for <span className="font-semibold text-foreground">{patientDisplayName(selectedVisit)}</span> and advance to the next waiting patient.
            </p>
            {closureBlockers.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                {closureBlockers.length === 1 ? closureBlockers[0] : `${closureBlockers.length} blocker(s) remain`}
              </div>
            )}
            <p className="text-xs text-muted-foreground">SOAP notes will be signed and locked.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCompleteOpen(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmCompleteOpen(false); handleCompleteAndNext(); }} disabled={completeVisit.isPending || !canCloseEncounter} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {completeVisit.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}Complete & Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All My Patients Modal */}
      <Dialog open={allPatientsOpen} onOpenChange={setAllPatientsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              All My Patients
              <Badge variant="secondary" className="ml-1">{doctorPatientsTotal}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={allPatientsSearch}
                onChange={(e) => { setAllPatientsSearch(e.target.value); setAllPatientsPage(1); }}
                placeholder="Search by name, ID, phone, or email..."
                className="pl-8"
              />
            </div>
            <Select value={allPatientsDaysBack?.toString() || 'all'} onValueChange={(v) => { setAllPatientsDaysBack(v === 'all' ? undefined : parseInt(v, 10)); setAllPatientsPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 min-h-0 -mx-2 px-2">
            {doctorPatientsQuery.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading patients...
              </div>
            ) : doctorPatients.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {allPatientsSearch ? `No patients matching "${allPatientsSearch}"` : 'No patients yet'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {doctorPatients.map((p: any) => {
                  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Unnamed';
                  const isSelected = selectedVisit?.patientId?._id === p._id || selectedVisit?.patientId === p._id;
                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={async () => {
                        try {
                          const visits: any[] = await visitsAPI.getByPatient(p._id);
                          if (visits && visits.length > 0) {
                            const last = visits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                            guardNavigation(() => {
                              setSearchedPatient(null);
                              setSelectedVisit(last);
                              setActiveTab('timeline');
                              setAllPatientsOpen(false);
                            }, 'select', { visit: last, tab: 'timeline' });
                          } else {
                            toast.info(`${fullName} has no visits on file`);
                          }
                        } catch {
                          toast.error('Failed to load patient visits');
                        }
                      }}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{(p.firstName?.[0] || '')}{(p.lastName?.[0] || '')}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold truncate">{fullName}</p>
                            {p.allergies?.length > 0 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-red-50 text-red-700 border-red-200">
                                Allergy
                              </Badge>
                            )}
                            {p.chronicConditions?.length > 0 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                {p.chronicConditions.length} chronic
                              </Badge>
                            )}
                            <InsuranceStatusBadge insurance={p.insurance} compact className="h-4 px-1 py-0 text-[9px]" />
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {p.patientId} · {p.age ? `${p.age}${p.ageUnit || 'y'}` : '—'} · {p.gender || 'N/A'}
                            {p.phone ? ` · ${p.phone}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-[10px] text-muted-foreground">Last visit</p>
                          <p className="text-xs font-medium">{p.lastVisitDate ? new Date(p.lastVisitDate).toLocaleDateString() : 'N/A'}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{p.lastVisitStatus?.replace(/_/g, ' ') || ''}</p>
                        </div>
                      </div>
                      {p.lastChiefComplaint && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 italic truncate">Last: {p.lastChiefComplaint}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          {doctorPatientsTotal > 25 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {(allPatientsPage - 1) * 25 + 1}-{Math.min(allPatientsPage * 25, doctorPatientsTotal)} of {doctorPatientsTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={allPatientsPage === 1} onClick={() => setAllPatientsPage(p => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={allPatientsPage * 25 >= doctorPatientsTotal} onClick={() => setAllPatientsPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* C1: Discard Changes Confirmation */}
      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Unsaved Changes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have unsaved changes to SOAP notes or vitals. What would you like to do?
          </p>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setDiscardConfirmOpen(false); setPendingNavigation(null); }}>Stay</Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={confirmDiscardAndProceed}>Discard & Switch</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={saveAndProceed} disabled={updateVisit.isPending}>
              {updateVisit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save & Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C2: Allergy Override Confirmation */}
      <Dialog open={allergyOverrideOpen} onOpenChange={(open) => { setAllergyOverrideOpen(open); if (!open) { setAllergyOverrideInfo(null); setAllergyOverrideText(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Allergy Alert
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-red-300 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                Patient is allergic to <span className="font-bold">{allergyOverrideInfo?.allergy}</span>.
              </p>
              <p className="text-sm text-red-700 mt-1">
                <span className="font-semibold">{allergyOverrideInfo?.med?.name}</span> may contain or relate to this allergen.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Type <span className="font-mono font-bold">PROCEED</span> to override this alert and prescribe anyway.</p>
            <Input
              value={allergyOverrideText}
              onChange={(e) => setAllergyOverrideText(e.target.value)}
              placeholder="Type PROCEED to override"
              className={cn("font-mono", allergyOverrideText === 'PROCEED' ? "border-green-500" : allergyOverrideText.length > 0 && "border-red-400")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAllergyOverrideOpen(false); setAllergyOverrideInfo(null); setAllergyOverrideText(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={allergyOverrideText !== 'PROCEED' || !allergyOverrideInfo}
              onClick={() => {
                if (allergyOverrideInfo) {
                  addMedicationAfterAllergyCheck(allergyOverrideInfo.med);
                }
                setAllergyOverrideOpen(false);
                setAllergyOverrideInfo(null);
                setAllergyOverrideText('');
              }}
            >
              Override & Prescribe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
