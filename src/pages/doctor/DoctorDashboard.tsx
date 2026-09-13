import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { visitsAPI, ordersAPI, doctorsAPI, admissionsAPI } from '@/services/api';
import { prescriptionService } from '@/services/prescriptionService';
import {
  useDoctorDashboard,
  useDoctorPatients,
  useAcceptPatient,
  useUpdateVisit,
  useCompleteVisit,
  usePatientVisits,
  useReferToSpecialist
} from '@/hooks/useVisits';
import { useResults } from '@/hooks/useResults';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { useMyBranch } from '@/hooks/useBranch';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

// Dashboard & Extracted Components
import { TreatmentPlanBuilder } from '@/pages/shared/TreatmentPlanBuilder';
import { PatientTimeline } from '@/components/doctor/PatientTimeline';
import { DoctorTopBar } from '@/components/doctor/DoctorTopBar';
import { ClinicalRibbon } from '@/components/doctor/ClinicalRibbon';
import { QuickActionBar } from '@/components/doctor/QuickActionBar';
import { VisitContextDrawer } from '@/components/doctor/VisitContextDrawer';
import { DoctorQueueHub } from '@/components/doctor/DoctorQueueHub';

// Extracted Modals
import { DoctorLabOrderModal, TestItem } from '@/components/doctor/modals/DoctorLabOrderModal';
import { DoctorRdtOrderModal } from '@/components/doctor/modals/DoctorRdtOrderModal';
import { DoctorPrescriptionModal, PrescriptionModalItem } from '@/components/doctor/modals/DoctorPrescriptionModal';
import { DoctorReferralModal } from '@/components/doctor/modals/DoctorReferralModal';
import { DoctorAdmissionModal } from '@/components/doctor/modals/DoctorAdmissionModal';
import { DoctorAllPatientsModal } from '@/components/doctor/modals/DoctorAllPatientsModal';

import {
  buildSmartInstruction,
  buildSmartRegimen,
  computeMedicationQuantity,
  getMedicationBaseUnit,
  getMedicationPrice,
  type MedicationLike,
} from '@/lib/medicationIntelligence';

// Icons
import {
  Loader2, CheckCircle, AlertTriangle, RefreshCw,
  FileText, FlaskConical, Pill, Scissors, ClipboardList, Save
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
  triageAlert?: string;
  triagedAt?: string;
  room?: string;
  roomType?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessmentNotes?: string;
  planNotes?: string;
  diagnosis?: string;
  consultationOrderId?: string;
  consultationPaid?: boolean;
  consultationCoverageType?: string;
  insurance?: any;
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

  const { data: dashboardData, isLoading, isError: dashboardError, refetch: refetchDashboard } = useDoctorDashboard();
  const acceptPatient = useAcceptPatient();
  const updateVisit = useUpdateVisit();
  const completeVisit = useCompleteVisit();
  const referToSpecialist = useReferToSpecialist();

  // Active state
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [searchedPatient, setSearchedPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState('soap');
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const contextPatient = selectedVisit?.patientId || searchedPatient;
  const currentVisitId = selectedVisit?._id || selectedVisit?.id;

  // Form states
  const [triageOverride, setTriageOverride] = useState('');
  const [doctorTriageNotes, setDoctorTriageNotes] = useState('');
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

  // Modal states
  const [labOrderModalOpen, setLabOrderModalOpen] = useState(false);
  const { data: branch } = useMyBranch(labOrderModalOpen);
  const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
  const [editingOrder, setEditingOrder] = useState<any>(null);

  const [rdtModalOpen, setRdtModalOpen] = useState(false);
  const [selectedRdts, setSelectedRdts] = useState<{ malaria: boolean; typhoid: boolean }>({ malaria: false, typhoid: false });

  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionModalItem[]>([]);
  const [editingPrescription, setEditingPrescription] = useState<any>(null);

  const [referralOpen, setReferralOpen] = useState(false);
  const [referralForm, setReferralForm] = useState({ specialistId: '', reason: '', notes: '' });

  const [admitOpen, setAdmitOpen] = useState(false);
  const [admitForm, setAdmitForm] = useState({
    wardType: 'general',
    bedNumber: '',
    admissionReason: '',
    diagnosis: '',
    notes: '',
  });

  const [treatmentPlanOpen, setTreatmentPlanOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  const [allPatientsOpen, setAllPatientsOpen] = useState(false);
  const [allPatientsSearch, setAllPatientsSearch] = useState('');
  const [allPatientsPage, setAllPatientsPage] = useState(1);
  const [allPatientsDaysBack, setAllPatientsDaysBack] = useState<number | undefined>(undefined);

  // Dirty tracking & navigation guards
  const [isDirty, setIsDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: 'accept' | 'select' | 'search' | 'tab' | 'dashboard'; value?: any } | null>(null);

  // Allergy override dialog
  const [allergyOverrideOpen, setAllergyOverrideOpen] = useState(false);
  const [allergyOverrideInfo, setAllergyOverrideInfo] = useState<{ med: any; allergy: string } | null>(null);
  const [allergyOverrideText, setAllergyOverrideText] = useState('');

  // Vitals errors & lab sorting
  const [vitalsErrors, setVitalsErrors] = useState<Record<string, string>>({});
  const [labSortField, setLabSortField] = useState<'testName' | 'value' | 'flag' | null>(null);
  const [labSortDir, setLabSortDir] = useState<'asc' | 'desc'>('asc');
  const [reviewedResultIds, setReviewedResultIds] = useState<Set<string>>(new Set());

  // Patient chart query
  const patientId = contextPatient?._id;
  const { data: patientChart, isLoading: chartLoading } = useQuery({
    queryKey: ['patient-chart', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      return await patientService.getChart(patientId);
    },
    enabled: !!patientId,
  });

  const { data: patientVisits = [] } = usePatientVisits(patientId);
  const patientOrders = useMemo(() => Array.isArray(patientChart?.orders) ? patientChart.orders : [], [patientChart]);
  const patientPrescriptions = useMemo(() => Array.isArray(patientChart?.prescriptions) ? patientChart.prescriptions : [], [patientChart]);

  // Current visit treatment plans
  const { data: currentVisitPlans = [] } = useQuery({
    queryKey: ['treatment-plans', currentVisitId],
    queryFn: () => currentVisitId ? treatmentPlanService.findByVisit(currentVisitId) : Promise.resolve([]),
    enabled: !!currentVisitId,
  });

  // Current visit orders
  const currentVisitOrders = useMemo(() => {
    return (Array.isArray(patientOrders) ? patientOrders : []).filter((order: any) => {
      const orderVisitId = typeof order.visitId === 'object' ? order.visitId?._id : order.visitId;
      return orderVisitId === currentVisitId;
    });
  }, [patientOrders, currentVisitId]);

  const currentVisitLabOrder = currentVisitOrders.find((order: any) => (order.orderType || order.order_type) === 'lab');
  const labOrderId = selectedVisit?.orders?.find((o: any) => o.orderType === 'lab')?._id ||
    currentVisitLabOrder?._id ||
    currentVisitLabOrder?.id ||
    selectedVisit?.consultationOrderId;

  const { data: labResults = [] } = useResults(labOrderId);
  const chartReviewLabResults = useMemo(() => chartOrderResults(patientChart), [patientChart]);

  const rdtResults: LabResult[] = useMemo(() => {
    const rapidTests = (selectedVisit as any)?.rapidTestResults || [];
    return rapidTests.map((rt: any, idx: number) => ({
      _id: `rdt-${rt.testType}-${idx}`,
      testCode: rt.testType === 'malaria' ? 'RAPID_MALARIA' : 'RAPID_TYPHOID',
      testName: rt.testType === 'malaria' ? 'Rapid Malaria Test' : 'Rapid Typhoid Test',
      value: rt.result === 'positive'
        ? `Positive${rt.parasiteCount ? ` (${rt.parasiteCount}/µL)` : ''}`
        : 'Negative',
      unit: rt.testType === 'malaria' && rt.result === 'positive' ? '/µL' : undefined,
      referenceRange: rt.antigen || undefined,
      flag: rt.result === 'positive' ? 'high' as const : 'normal' as const,
      status: 'completed',
      resulted_at: rt.performedAt || new Date().toISOString(),
      createdAt: rt.performedAt || new Date().toISOString(),
    }));
  }, [(selectedVisit as any)?.rapidTestResults]);

  const displayedLabResults = selectedVisit ? [...rdtResults, ...labResults] : chartReviewLabResults;
  const abnormalLabResults = displayedLabResults.filter((result: LabResult) => result.flag && result.flag !== 'normal');
  const criticalLabResults = displayedLabResults.filter((result: LabResult) => result.flag === 'critical_high' || result.flag === 'critical_low');

  // Sorted lab results
  const sortedLabResults = useMemo(() => {
    const flagOrder = { critical_high: 0, critical_low: 1, high: 2, low: 3, normal: 4 };
    const sorted = [...displayedLabResults];
    if (!labSortField) {
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
        } else if (labSortField === 'flag') {
          const aVal = flagOrder[a.flag as keyof typeof flagOrder] ?? 4;
          const bVal = flagOrder[b.flag as keyof typeof flagOrder] ?? 4;
          cmp = aVal - bVal;
        }
        return labSortDir === 'asc' ? cmp : -cmp;
      });
    }
    return sorted;
  }, [displayedLabResults, labSortField, labSortDir]);

  // Catalog queries
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

  const { data: medications = [], isLoading: medicationsLoading } = useQuery({
    queryKey: ['medications'],
    queryFn: () => ordersAPI.getMedications(),
    staleTime: 5 * 60 * 1000,
    enabled: prescriptionModalOpen,
  });

  const { data: specialists = [] } = useQuery({
    queryKey: ['doctors', 'specialists'],
    queryFn: () => doctorsAPI.getSpecialists(),
    staleTime: 5 * 60 * 1000,
    enabled: referralOpen,
  });

  const doctorPatientsQuery = useDoctorPatients({
    page: allPatientsPage,
    limit: 25,
    search: allPatientsSearch,
    daysBack: allPatientsDaysBack,
    enabled: allPatientsOpen,
  });

  // Sync form when selected visit changes
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
        subjective: selectedVisit.subjectiveNotes || '',
        objective: selectedVisit.objectiveNotes || '',
        assessment: selectedVisit.assessmentNotes || '',
        plan: selectedVisit.planNotes || '',
        diagnosis: selectedVisit.diagnosis || '',
      });
      setTriageOverride(selectedVisit.triagePriority || '');
      setDoctorTriageNotes('');
      setIsDirty(false);
    } else {
      setVitalsForm({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', weight: '', height: '', oxygenSaturation: '' });
      setChiefComplaintForm('');
      setSoapForm({ subjective: '', objective: '', assessment: '', plan: '', diagnosis: '' });
      setTriageOverride('');
      setDoctorTriageNotes('');
      setIsDirty(false);
    }
  }, [selectedVisit?._id]);

  // Track dirty changes
  useEffect(() => {
    if (!selectedVisit) {
      setIsDirty(false);
      return;
    }
    const hasChanged =
      (vitalsForm.temperature || '') !== (selectedVisit.temperature?.toString() || '') ||
      (vitalsForm.bloodPressure || '') !== (selectedVisit.bloodPressure || '') ||
      (vitalsForm.heartRate || '') !== (selectedVisit.heartRate?.toString() || '') ||
      (vitalsForm.respiratoryRate || '') !== (selectedVisit.respiratoryRate?.toString() || '') ||
      (vitalsForm.weight || '') !== (selectedVisit.weight?.toString() || '') ||
      (vitalsForm.height || '') !== (selectedVisit.height?.toString() || '') ||
      (vitalsForm.oxygenSaturation || '') !== (selectedVisit.oxygenSaturation?.toString() || '') ||
      chiefComplaintForm !== (selectedVisit.chiefComplaint || '') ||
      soapForm.subjective !== (selectedVisit.subjectiveNotes || '') ||
      soapForm.objective !== (selectedVisit.objectiveNotes || '') ||
      soapForm.assessment !== (selectedVisit.assessmentNotes || '') ||
      soapForm.plan !== (selectedVisit.planNotes || '') ||
      soapForm.diagnosis !== (selectedVisit.diagnosis || '') ||
      (triageOverride && triageOverride !== selectedVisit.triagePriority);
    setIsDirty(Boolean(hasChanged));
  }, [vitalsForm, chiefComplaintForm, soapForm, triageOverride, selectedVisit]);

  // Vitals validation
  const validateVitals = useCallback((form: typeof vitalsForm) => {
    const errors: Record<string, string> = {};
    const temp = parseFloat(form.temperature);
    if (form.temperature && (isNaN(temp) || temp < 30 || temp > 45)) errors.temperature = 'Range: 30-45 °C';
    if (form.bloodPressure && !/^\d{2,3}\/\d{2,3}$/.test(form.bloodPressure.trim())) errors.bloodPressure = 'Format: 120/80';
    const hr = parseInt(form.heartRate);
    if (form.heartRate && (isNaN(hr) || hr < 20 || hr > 250)) errors.heartRate = 'Range: 20-250 bpm';
    const rr = parseInt(form.respiratoryRate);
    if (form.respiratoryRate && (isNaN(rr) || rr < 5 || rr > 80)) errors.respiratoryRate = 'Range: 5-80 /min';
    const wt = parseFloat(form.weight);
    if (form.weight && (isNaN(wt) || wt < 1 || wt > 300)) errors.weight = 'Range: 1-300 kg';
    const ht = parseFloat(form.height);
    if (form.height && (isNaN(ht) || ht < 30 || ht > 250)) errors.height = 'Range: 30-250 cm';
    const spo2 = parseInt(form.oxygenSaturation);
    if (form.oxygenSaturation && (isNaN(spo2) || spo2 < 0 || spo2 > 100)) errors.oxygenSaturation = 'Range: 0-100%';
    setVitalsErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  useEffect(() => {
    validateVitals(vitalsForm);
  }, [vitalsForm, validateVitals]);

  // Clinical workflow guards
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
    if (status === 'awaiting_lab') blockers.push('Order payment is still pending at reception.');
    if (status === 'awaiting_results') blockers.push('Lab test processing is still in progress.');
    if (status === 'awaiting_pharmacy') blockers.push('Pharmacy order payment is pending.');
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

  // Keyboard shortcuts (Ctrl+S: Save Draft, Ctrl+Enter: Complete, 1-3: Tabs)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedVisit) return;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (canContinueClinicalWork) handleSaveVitalsAndSOAP();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canCloseEncounter && !completeVisit.isPending) setConfirmCompleteOpen(true);
        return;
      }
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tabMap: Record<string, string> = { '1': 'soap', '2': 'lab-results', '3': 'timeline' };
        if (tabMap[e.key]) { e.preventDefault(); setActiveTab(tabMap[e.key]); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedVisit, canContinueClinicalWork, canCloseEncounter, completeVisit.isPending]);

  // Handlers & navigation guards
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
    guardNavigation(() => {
      setSearchedPatient(null);
      setSelectedVisit(visit);
      setActiveTab(tab);
    }, 'select', { visit, tab });
  }, [guardNavigation]);

  const acceptVisit = useCallback((visit: Visit) => {
    guardNavigation(() => handleAcceptPatient(visit), 'accept', visit);
  }, [guardNavigation]);

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
    } catch {}
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
      toast.success('Clinical notes saved');
      setIsDirty(false);
    } catch {}
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

  // Lab order mutations
  const createLabOrder = useMutation({
    mutationFn: async () => {
      const pId = contextPatient?._id;
      if (!pId || selectedTests.length === 0) return;
      const orderData: any = {
        patientId: pId,
        orderType: 'lab',
        tests: selectedTests.map((t) => ({
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
      toast.success('Lab order created. Patient should pay at reception.');
      setLabOrderModalOpen(false);
      setSelectedTests([]);
      setEditingOrder(null);
      if (selectedVisit) {
        setSelectedVisit((prev) => (prev ? { ...prev, status: 'awaiting_lab' } : prev));
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

  const updateLabOrder = useMutation({
    mutationFn: async () => {
      if (!editingOrder || selectedTests.length === 0) return;
      return await ordersAPI.update(editingOrder._id || editingOrder.id, {
        tests: selectedTests.map((t) => ({
          testId: t._id,
          testCode: t.code,
          testName: t.name,
          price: t.price,
        })),
        priority: editingOrder.priority,
      });
    },
    onSuccess: () => {
      toast.success('Lab order updated');
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

  // RDT order mutation
  const createRdtOrder = useMutation({
    mutationFn: async () => {
      const pId = contextPatient?._id;
      if (!pId) return;
      const rdtTests: { testCode: string; testName: string; price: number }[] = [];
      if (selectedRdts.malaria) rdtTests.push({ testCode: 'RAPID_MALARIA', testName: 'Rapid Malaria Test', price: branch?.servicePrices?.rapid_malaria ?? 50 });
      if (selectedRdts.typhoid) rdtTests.push({ testCode: 'RAPID_TYPHOID', testName: 'Rapid Typhoid Test', price: branch?.servicePrices?.rapid_typhoid ?? 50 });
      if (rdtTests.length === 0) return;

      const orderData: any = {
        patientId: pId,
        orderType: 'lab',
        tests: rdtTests,
        priority: 'routine',
      };
      if (selectedVisit) {
        orderData.visitId = selectedVisit._id || selectedVisit.id;
      }
      return await ordersAPI.create(orderData);
    },
    onSuccess: () => {
      toast.success('Rapid test order created. Patient should pay at reception.');
      setRdtModalOpen(false);
      setSelectedRdts({ malaria: false, typhoid: false });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create RDT order';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Prescription mutations
  const createPrescription = useMutation({
    mutationFn: async () => {
      const pId = contextPatient?._id;
      if (!pId || prescriptionItems.length === 0) return;

      const payload: any = {
        patientId: pId,
        items: prescriptionItems.map(({ unitPrice, sellMode, packSizes, baseUnit, computedQuantity, quantityTouched, isControlled, requiresPrescription, ...item }) => ({
          ...item,
          quantity: Math.max(1, Number(item.quantity || computedQuantity || computeMedicationQuantity(item, { baseUnit }) || 1)),
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
        setSelectedVisit((prev) => (prev ? { ...prev, status: 'awaiting_pharmacy' } : prev));
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

  const updatePrescription = useMutation({
    mutationFn: async () => {
      if (!editingPrescription || prescriptionItems.length === 0) return;
      return await prescriptionService.update(editingPrescription._id, {
        items: prescriptionItems.map(({ unitPrice, sellMode, packSizes, baseUnit, computedQuantity, quantityTouched, isControlled, requiresPrescription, ...item }) => ({
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

  // Admission mutation
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

  // Medication prescription item helpers
  const buildPrescriptionItem = (med: MedicationLike, pharmacistNote = ''): PrescriptionModalItem => {
    const regimen = buildSmartRegimen(med);
    const computedQuantity = computeMedicationQuantity(regimen, med);
    return {
      medicationId: med._id,
      medicationName: med.name,
      strengthPerDose: regimen.strengthPerDose,
      dosesPerDay: regimen.dosesPerDay,
      durationDays: regimen.durationDays,
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
      instructions: '',
      pharmacistNote,
    };
  };

  const addMedicationToPrescription = (med: any) => {
    const allergies: string[] = contextPatient?.allergies || [];
    const medText = `${med.name} ${med.genericName || ''}`.toLowerCase();
    const matchedAllergy = allergies.find((a) => {
      const allergen = a.toLowerCase().trim();
      if (!allergen) return false;
      if (medText.includes(allergen)) return true;
      const allergyRoots: Record<string, string[]> = {
        penicillin: ['amoxicillin', 'ampicillin', 'penicillin', 'augmentin'],
        sulfa: ['sulfamethoxazole', 'trimethoprim', 'bactrim', 'sulfa'],
        aspirin: ['aspirin', 'acetylsalicylic', 'asa'],
        nsaid: ['ibuprofen', 'diclofenac', 'naproxen', 'ketoprofen', 'nsaid'],
        'ace inhibitor': ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
        'beta blocker': ['atenolol', 'metoprolol', 'propranolol', 'carvedilol'],
      };
      for (const [root, related] of Object.entries(allergyRoots)) {
        if (allergen.includes(root) && related.some((r) => medText.includes(r))) return true;
      }
      return false;
    });

    if (matchedAllergy) {
      setAllergyOverrideInfo({ med, allergy: matchedAllergy });
      setAllergyOverrideText('');
      setAllergyOverrideOpen(true);
      return;
    }

    setPrescriptionItems([...prescriptionItems, buildPrescriptionItem(med)]);
  };

  const addMedicationAfterAllergyCheck = useCallback((med: any) => {
    setPrescriptionItems([
      ...prescriptionItems,
      buildPrescriptionItem(med, `Allergy override approved: ${allergyOverrideText.trim()}`),
    ]);
  }, [prescriptionItems, allergyOverrideText]);

  const updatePrescriptionItemField = (index: number, field: string, value: any) => {
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
      if (!previous.instructions) {
        updated[index].instructions = nextInstruction;
      }
    }
    if (field === 'quantity') {
      updated[index].quantity = Math.max(0, Number(value) || 0);
      updated[index].quantityTouched = Number(value) !== Number(updated[index].computedQuantity || 0);
    }
    setPrescriptionItems(updated);
  };

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

  // Dashboard queue buckets
  const stats = dashboardData?.todayStats || { seen: 0, waiting: 0, completed: 0 };
  const waitingQueue = dashboardData?.waitingQueue || [];
  const activePatients = dashboardData?.activePatients || [];
  const resultsReady = dashboardData?.resultsReady || [];
  const incomingReferrals = dashboardData?.incomingReferrals || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6" aria-busy="true" aria-label="Loading doctor workbench">
        <div className="mx-auto max-w-7xl space-y-5">
          <Skeleton className="h-14 w-full rounded-xl bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((idx) => (
              <Skeleton key={idx} className="h-28 rounded-xl bg-slate-200" />
            ))}
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
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center rounded-xl border bg-white p-8 text-center shadow-xs">
          <AlertTriangle className="mb-4 h-10 w-10 text-amber-600" />
          <h1 className="text-lg font-semibold">Doctor workbench could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">Check your connection, then retry.</p>
          <Button className="mt-5" onClick={() => refetchDashboard()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const isPatientActive = Boolean(selectedVisit || searchedPatient);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden select-none">
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
        onAcceptNext={() => {
          if (waitingQueue.length > 0) acceptVisit(waitingQueue[0]);
        }}
        onOpenDashboard={() => guardNavigation(() => { setSelectedVisit(null); setSearchedPatient(null); }, 'dashboard')}
        onOpenResults={() => {
          if (resultsReady.length > 0) selectVisit(resultsReady[0], 'lab-results');
        }}
        onOpenAllPatients={() => {
          setAllPatientsOpen(true);
          setAllPatientsPage(1);
          setAllPatientsSearch('');
          setAllPatientsDaysBack(undefined);
        }}
        onLogout={handleLogout}
        acceptPending={acceptPatient.isPending}
        doctorMode={!!user?.doctorMode}
        onExitDoctorMode={user?.doctorMode ? handleExitDoctorMode : undefined}
      />

      {/* Main Workspace below TopBar */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-[116px] md:pt-[132px]">
        {!isPatientActive ? (
          /* Mode 1: Clinic Queue Hub */
          <DoctorQueueHub
            stats={stats}
            waitingQueue={waitingQueue}
            resultsReady={resultsReady}
            activePatients={activePatients}
            incomingReferrals={incomingReferrals}
            onSelectVisit={selectVisit}
            onAcceptVisit={acceptVisit}
            onAcceptNext={() => {
              if (waitingQueue.length > 0) acceptVisit(waitingQueue[0]);
            }}
            acceptPending={acceptPatient.isPending}
          />
        ) : (
          /* Mode 2: Active Consultation Workspace */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* 1. Slim Clinical Ribbon */}
            <ClinicalRibbon
              patient={contextPatient}
              visit={selectedVisit}
              isReadOnly={isReadOnly}
              isChartReview={isChartReviewMode}
              isDirty={isDirty}
              canWriteConsultation={canWriteConsultation}
              canCloseEncounter={canCloseEncounter}
              closureBlockers={closureBlockers}
              vitals={{
                bloodPressure: vitalsForm.bloodPressure || selectedVisit?.bloodPressure,
                heartRate: vitalsForm.heartRate || selectedVisit?.heartRate,
                temperature: vitalsForm.temperature || selectedVisit?.temperature,
                oxygenSaturation: vitalsForm.oxygenSaturation || selectedVisit?.oxygenSaturation,
              }}
              onBackToQueue={() =>
                guardNavigation(() => { setSelectedVisit(null); setSearchedPatient(null); }, 'dashboard')
              }
              onSaveDraft={handleSaveVitalsAndSOAP}
              onCompleteVisit={() => setConfirmCompleteOpen(true)}
              savePending={updateVisit.isPending}
              completePending={completeVisit.isPending}
            />

            {/* 2. Persistent 1-Click Action Bar */}
            <QuickActionBar
              onOpenPrescribe={() => {
                setEditingPrescription(null);
                setPrescriptionItems([]);
                setPrescriptionModalOpen(true);
              }}
              onOpenRdt={() => {
                setSelectedRdts({ malaria: false, typhoid: false });
                setRdtModalOpen(true);
              }}
              onOpenLab={() => {
                setEditingOrder(null);
                setSelectedTests([]);
                setLabOrderModalOpen(true);
              }}
              onOpenTreatmentPlan={() => setTreatmentPlanOpen(true)}
              onOpenAdmit={() => setAdmitOpen(true)}
              onOpenRefer={() => setReferralOpen(true)}
              isReadOnly={isReadOnly}
              canWriteConsultation={canWriteConsultation}
              consultationPaymentBlocked={consultationPaymentBlocksWriting}
              hasAbnormalResults={abnormalLabResults.length > 0}
              abnormalResultsCount={abnormalLabResults.length}
              activeOrdersCount={currentVisitOrders.length}
              treatmentPlansCount={currentVisitPlans.length}
              onOpenResultsTab={() => setActiveTab('lab-results')}
            />

            {/* 3. 70/30 Split Working Area */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left Pane: Charting Canvas (SOAP, Results, Timeline) */}
              <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => guardNavigation(() => setActiveTab(val), 'tab', val)}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="shrink-0 border-b border-slate-200 px-4 md:px-6 bg-white flex items-center justify-between">
                    <TabsList className="h-10 bg-transparent p-0 gap-6">
                      <TabsTrigger
                        value="soap"
                        className="h-10 rounded-none border-b-2 border-transparent px-1 font-medium text-xs data-[state=active]:border-teal-700 data-[state=active]:text-teal-900 data-[state=active]:bg-transparent shadow-none"
                      >
                        SOAP Notes
                      </TabsTrigger>
                      <TabsTrigger
                        value="lab-results"
                        className="h-10 rounded-none border-b-2 border-transparent px-1 font-medium text-xs data-[state=active]:border-teal-700 data-[state=active]:text-teal-900 data-[state=active]:bg-transparent shadow-none gap-1.5"
                      >
                        Lab Results
                        {displayedLabResults.length > 0 && (
                          <span className={cn(
                            "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                            abnormalLabResults.length > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
                          )}>
                            {displayedLabResults.length}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="timeline"
                        className="h-10 rounded-none border-b-2 border-transparent px-1 font-medium text-xs data-[state=active]:border-teal-700 data-[state=active]:text-teal-900 data-[state=active]:bg-transparent shadow-none"
                      >
                        History & Timeline
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Tab 1: Clinical SOAP Documentation */}
                  <TabsContent value="soap" className="m-0 flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/40">
                    <div className="mx-auto max-w-4xl space-y-4">
                      {isChartReviewMode && (
                        <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Chart review mode — notes require an active registered visit. You can still review history or order tests.</span>
                        </div>
                      )}

                      {/* Chief Complaint */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-900">Chief Complaint *</Label>
                        <Textarea
                          value={chiefComplaintForm}
                          onChange={(e) => setChiefComplaintForm(e.target.value)}
                          placeholder="What brings the patient in today? (e.g., 3-day fever, chills, body pain)"
                          rows={2}
                          className="min-h-[50px] resize-y text-sm bg-slate-50/50"
                          disabled={isReadOnly || !canWriteConsultation}
                        />
                      </div>

                      {/* Subjective */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-900">
                          Subjective <span className="font-normal text-slate-500">(History of Presenting Illness)</span>
                        </Label>
                        <Textarea
                          value={soapForm.subjective}
                          onChange={(e) => setSoapForm({ ...soapForm, subjective: e.target.value })}
                          placeholder="Patient narrative, onset, duration, associated symptoms, relevant negatives..."
                          rows={3}
                          className="min-h-[72px] resize-y text-sm bg-slate-50/50"
                          disabled={isReadOnly || !canWriteConsultation}
                        />
                      </div>

                      {/* Objective */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-900">
                          Objective <span className="font-normal text-slate-500">(Physical Examination & Observations)</span>
                        </Label>
                        <Textarea
                          value={soapForm.objective}
                          onChange={(e) => setSoapForm({ ...soapForm, objective: e.target.value })}
                          placeholder="Physical exam findings, chest auscultation, abdominal palpation, throat, skin..."
                          rows={3}
                          className="min-h-[72px] resize-y text-sm bg-slate-50/50"
                          disabled={isReadOnly || !canWriteConsultation}
                        />
                      </div>

                      {/* Assessment & Diagnosis */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-900">Assessment / Differential</Label>
                          <Textarea
                            value={soapForm.assessment}
                            onChange={(e) => setSoapForm({ ...soapForm, assessment: e.target.value })}
                            placeholder="Clinical impression, differential diagnoses considered..."
                            rows={2}
                            className="min-h-[56px] resize-y text-sm bg-slate-50/50"
                            disabled={isReadOnly || !canWriteConsultation}
                          />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-900">Working / Primary Diagnosis</Label>
                          <Input
                            value={soapForm.diagnosis}
                            onChange={(e) => setSoapForm({ ...soapForm, diagnosis: e.target.value })}
                            placeholder="e.g. Uncomplicated Malaria"
                            className="h-10 text-sm bg-slate-50/50"
                            disabled={isReadOnly || !canWriteConsultation}
                          />
                        </div>
                      </div>

                      {/* Plan */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-slate-900">Plan & Counselling</Label>
                          {currentVisitPlans.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] text-teal-700 hover:text-teal-800 gap-1 p-1"
                              onClick={() => {
                                const allItems = currentVisitPlans.flatMap((p: any) => p.items || []);
                                const summary = generatePlanSummary(allItems);
                                setSoapForm((prev) => ({ ...prev, plan: prev.plan ? prev.plan + '\n' + summary : summary }));
                                toast.success('Plan synced from treatment orders');
                              }}
                            >
                              <RefreshCw className="h-3 w-3" /> Sync Treatment Plan
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={soapForm.plan}
                          onChange={(e) => setSoapForm({ ...soapForm, plan: e.target.value })}
                          placeholder="Treatment regimen, hydration, follow-up instructions, patient education..."
                          rows={3}
                          className="min-h-[72px] resize-y text-sm bg-slate-50/50"
                          disabled={isReadOnly || !canWriteConsultation}
                        />

                        {/* Synced Treatment Plans Display */}
                        {currentVisitPlans.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            {currentVisitPlans.map((plan: any) => (
                              <div key={plan._id} className="rounded-md border border-slate-200 bg-slate-50/70 p-2 text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-slate-900">{plan.planNumber}</span>
                                  <Badge variant="outline" className={cn("text-[9px] h-4 px-1 capitalize", PLAN_STATUS_COLORS[plan.status])}>
                                    {plan.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {(plan.items || []).map((item: any, idx: number) => {
                                    const Icon = item.type === 'drug' || item.type === 'iv' ? Pill : item.type === 'lab' ? FlaskConical : item.type === 'procedure' ? Scissors : FileText;
                                    return (
                                      <span key={idx} className="inline-flex items-center gap-1 rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                                        <Icon className="h-3 w-3 text-slate-400" />
                                        {(item.description || item.medicationName || item.testName || '').slice(0, 24)}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Lab Results */}
                  <TabsContent value="lab-results" className="m-0 flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/40">
                    <div className="mx-auto max-w-4xl space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-center justify-between">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900">Laboratory & Bedside Investigations</h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {displayedLabResults.length} test result{displayedLabResults.length !== 1 ? 's' : ''} available for this patient.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedVisit) queryClient.invalidateQueries({ queryKey: ['results', labOrderId] });
                            queryClient.invalidateQueries({ queryKey: ['patient-chart'] });
                            toast.success('Refreshed test results');
                          }}
                          className="h-8 text-xs gap-1"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Refresh
                        </Button>
                      </div>

                      {displayedLabResults.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200 p-8">
                          No lab test results on file for this encounter.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold">
                                <th className="py-2.5 px-4 cursor-pointer" onClick={() => setLabSortField('testName')}>
                                  Test Name
                                </th>
                                <th className="py-2.5 px-4 cursor-pointer" onClick={() => setLabSortField('value')}>
                                  Result
                                </th>
                                <th className="py-2.5 px-4">Reference Range</th>
                                <th className="py-2.5 px-4 cursor-pointer" onClick={() => setLabSortField('flag')}>
                                  Flag
                                </th>
                                <th className="py-2.5 px-4">Resulted</th>
                                <th className="py-2.5 px-4 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sortedLabResults.map((result) => {
                                const reviewed = reviewedResultIds.has(result._id);
                                return (
                                  <tr key={result._id} className="hover:bg-slate-50/50">
                                    <td className="py-3 px-4 font-medium text-slate-900">{result.testName}</td>
                                    <td className="py-3 px-4 font-semibold text-slate-950">
                                      {result.value} {result.unit || ''}
                                    </td>
                                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                                      {result.referenceRange || result.reference_range || '—'}
                                    </td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline" className={cn("text-[10px] h-4.5 px-1.5 capitalize font-medium", getResultRiskTone(result.flag))}>
                                        {getFlagLabel(result.flag)}
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                                      {formatClinicalDateTime(result.resulted_at || result.createdAt)}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={reviewed ? 'outline' : 'default'}
                                        onClick={() =>
                                          setReviewedResultIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(result._id)) next.delete(result._id);
                                            else next.add(result._id);
                                            return next;
                                          })
                                        }
                                        className={cn("h-6.5 text-[10px] px-2", !reviewed && "bg-teal-700 hover:bg-teal-800 text-white")}
                                      >
                                        {reviewed ? 'Reviewed' : 'Review'}
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Tab 3: Timeline & Patient Chart */}
                  <TabsContent value="timeline" className="m-0 flex-1 overflow-y-auto">
                    {patientId ? (
                      <PatientTimeline
                        patientId={patientId}
                        patientChart={patientChart}
                        patientVisits={patientVisits}
                        patientOrders={patientOrders}
                        patientPrescriptions={patientPrescriptions}
                        chartLoading={chartLoading}
                        onNavigate={setActiveTab}
                      />
                    ) : (
                      <div className="py-12 text-center text-sm text-slate-400">Select a patient to view clinical timeline</div>
                    )}
                  </TabsContent>
                </Tabs>
              </main>

              {/* Right Pane: 30% Collapsible Visit Context Drawer */}
              <VisitContextDrawer
                collapsed={drawerCollapsed}
                onToggleCollapse={() => setDrawerCollapsed((c) => !c)}
                vitalsForm={vitalsForm}
                setVitalsForm={setVitalsForm}
                vitalsErrors={vitalsErrors}
                selectedVisit={selectedVisit}
                isReadOnly={isReadOnly}
                canWriteConsultation={canWriteConsultation}
                triageOverride={triageOverride}
                setTriageOverride={setTriageOverride}
                currentVisitOrders={currentVisitOrders}
                currentVisitPlans={currentVisitPlans}
                onStartEditOrder={startEditOrder}
                onStartEditPrescription={startEditPrescription}
              />
            </div>
          </div>
        )}
      </div>

      {/* Extracted Modals */}
      <DoctorLabOrderModal
        open={labOrderModalOpen}
        onOpenChange={(open) => {
          if (!open) { setEditingOrder(null); setSelectedTests([]); }
          setLabOrderModalOpen(open);
        }}
        editingOrder={editingOrder}
        tests={tests}
        testsLoading={testsLoading}
        testsError={testsError}
        testsLoadError={testsLoadError}
        selectedTests={selectedTests}
        onAddTest={(test) => {
          if (!selectedTests.find((t) => (t._id || t.code) === (test._id || test.code))) {
            setSelectedTests([...selectedTests, test]);
          }
        }}
        onRemoveTest={(testId) => setSelectedTests(selectedTests.filter((t) => (t._id || t.code) !== testId))}
        onCancel={() => { setLabOrderModalOpen(false); setEditingOrder(null); setSelectedTests([]); }}
        onSubmit={() => (editingOrder ? updateLabOrder.mutate() : createLabOrder.mutate())}
        isPending={editingOrder ? updateLabOrder.isPending : createLabOrder.isPending}
      />

      <DoctorRdtOrderModal
        open={rdtModalOpen}
        onOpenChange={setRdtModalOpen}
        selectedRdts={selectedRdts}
        onToggleRdt={(key, checked) => setSelectedRdts((prev) => ({ ...prev, [key]: checked }))}
        malariaPrice={branch?.servicePrices?.rapid_malaria ?? 50}
        typhoidPrice={branch?.servicePrices?.rapid_typhoid ?? 50}
        onCancel={() => setRdtModalOpen(false)}
        onSubmit={() => createRdtOrder.mutate()}
        isPending={createRdtOrder.isPending}
      />

      <DoctorPrescriptionModal
        open={prescriptionModalOpen}
        onOpenChange={(open) => {
          if (!open) { setEditingPrescription(null); setPrescriptionItems([]); }
          setPrescriptionModalOpen(open);
        }}
        editingPrescription={editingPrescription}
        patientName={patientDisplayName(selectedVisit || ({ patientId: contextPatient } as Visit))}
        patientId={contextPatient?.patientId}
        allergies={contextPatient?.allergies || []}
        medications={medications}
        medicationsLoading={medicationsLoading}
        prescriptionItems={prescriptionItems}
        onSelectMedication={(med) => addMedicationToPrescription(med)}
        onUpdateItem={updatePrescriptionItemField}
        onRemoveItem={(idx) => setPrescriptionItems(prescriptionItems.filter((_, i) => i !== idx))}
        onCancel={() => { setPrescriptionModalOpen(false); setEditingPrescription(null); setPrescriptionItems([]); }}
        onSubmit={() => (editingPrescription ? updatePrescription.mutate() : createPrescription.mutate())}
        isPending={editingPrescription ? updatePrescription.isPending : createPrescription.isPending}
      />

      <DoctorReferralModal
        open={referralOpen}
        onOpenChange={setReferralOpen}
        specialists={specialists}
        referralForm={referralForm}
        setReferralForm={setReferralForm}
        onCancel={() => setReferralOpen(false)}
        onSubmit={async () => {
          if (!selectedVisit) return;
          try {
            await referToSpecialist.mutateAsync({ visitId: selectedVisit._id || selectedVisit.id || '', data: referralForm });
            toast.success('Patient referred to specialist');
            setReferralOpen(false);
            setReferralForm({ specialistId: '', reason: '', notes: '' });
            setSelectedVisit(null);
          } catch {}
        }}
        isPending={referToSpecialist.isPending}
      />

      <DoctorAdmissionModal
        open={admitOpen}
        onOpenChange={setAdmitOpen}
        admitForm={admitForm}
        setAdmitForm={setAdmitForm}
        onCancel={() => setAdmitOpen(false)}
        onSubmit={() => createAdmission.mutate()}
        isPending={createAdmission.isPending}
      />

      <DoctorAllPatientsModal
        open={allPatientsOpen}
        onOpenChange={setAllPatientsOpen}
        doctorPatientsTotal={doctorPatientsQuery.data?.total || 0}
        doctorPatientsQuery={doctorPatientsQuery}
        allPatientsSearch={allPatientsSearch}
        setAllPatientsSearch={setAllPatientsSearch}
        allPatientsDaysBack={allPatientsDaysBack}
        setAllPatientsDaysBack={setAllPatientsDaysBack}
        allPatientsPage={allPatientsPage}
        setAllPatientsPage={setAllPatientsPage}
        onSelectPatient={async (p) => {
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
              toast.info(`${p.firstName} has no visits on file`);
            }
          } catch {
            toast.error('Failed to load patient visits');
          }
        }}
        selectedPatientId={selectedVisit?.patientId?._id || selectedVisit?.patientId}
      />

      {/* Treatment Plan Builder Dialog */}
      <Dialog open={treatmentPlanOpen} onOpenChange={setTreatmentPlanOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b px-6 pb-3 pt-4">
            <DialogTitle>Create Treatment Plan</DialogTitle>
            <DialogDescription>Build a plan of drugs, IVs, labs, and procedures for this encounter.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 px-6">
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
                  setSoapForm((prev) => ({
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

      {/* Complete Visit Alert Dialog */}
      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close the encounter for <span className="font-semibold text-foreground">{patientDisplayName(selectedVisit)}</span> and advance to the next waiting patient. SOAP notes will be signed and locked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {closureBlockers.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              {closureBlockers.length === 1 ? closureBlockers[0] : `${closureBlockers.length} blocker(s) remain`}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completeVisit.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={completeVisit.isPending || !canCloseEncounter}
              onClick={(e) => {
                e.preventDefault();
                setConfirmCompleteOpen(false);
                handleCompleteAndNext();
              }}
            >
              {completeVisit.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Complete & Next
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard Changes Dialog */}
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
            <Button variant="outline" onClick={() => { setDiscardConfirmOpen(false); setPendingNavigation(null); }}>
              Stay
            </Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={confirmDiscardAndProceed}>
              Discard & Switch
            </Button>
            <Button onClick={saveAndProceed} disabled={updateVisit.isPending}>
              {updateVisit.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save & Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allergy Override Dialog */}
      <Dialog
        open={allergyOverrideOpen}
        onOpenChange={(open) => {
          setAllergyOverrideOpen(open);
          if (!open) { setAllergyOverrideInfo(null); setAllergyOverrideText(''); }
        }}
      >
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
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold">PROCEED</span> to override this alert and prescribe anyway.
            </p>
            <Input
              value={allergyOverrideText}
              onChange={(e) => setAllergyOverrideText(e.target.value)}
              placeholder="Type PROCEED to override"
              className={cn("font-mono", allergyOverrideText === 'PROCEED' ? "border-green-500" : allergyOverrideText.length > 0 && "border-red-400")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAllergyOverrideOpen(false); setAllergyOverrideInfo(null); setAllergyOverrideText(''); }}
            >
              Cancel
            </Button>
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
