import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { visitsAPI, ordersAPI, doctorsAPI, admissionsAPI } from '@/services/api';
import { medicationService } from '@/services/medicationService';
import { prescriptionService } from '@/services/prescriptionService';
import { soapNoteService } from '@/services/soapNoteService';
import { patientService } from '@/services/patientService';
import { SoapNoteTypeEnum } from '@/types/soap-note';
import { useDoctorDashboard, useDoctorPatients, useAcceptPatient, useUpdateVisit, useCompleteVisit, usePatientVisits, useReferToSpecialist } from '@/hooks/useVisits';
import { useResults } from '@/hooks/useResults';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Dashboard components
import { TreatmentPlanBuilder } from '@/pages/shared/TreatmentPlanBuilder';
import { PatientTimeline } from '@/components/doctor/PatientTimeline';
import { DoctorTopBar } from '@/components/doctor/DoctorTopBar';
import { DoctorTreatmentPlanCard } from '@/components/doctor/DoctorTreatmentPlanCard';
import { MedicationPicker } from '@/components/medications/MedicationPicker';
import {
  buildSmartInstruction,
  buildSmartRegimen,
  computeMedicationQuantity,
  estimateMedicationDispense,
  getMedicationBaseUnit,
  getMedicationPrice,
  validateMedicationRegimen,
  type MedicationLike,
} from '@/lib/medicationIntelligence';

// Icons
import {
  Loader2, CheckCircle, User, FileText, FlaskConical, Pill,
  ChevronDown, AlertTriangle, Search, Plus, Trash2, Save,
  Send, Heart, ClipboardList, UserCheck, BedDouble, ExternalLink, Activity,
  Pencil, AlertCircle, TestTube, Stethoscope, Calendar, Clock, Eye, Printer,
  RefreshCw, ShieldCheck
} from 'lucide-react';

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

// Helper to get flag color
const getFlagColor = (flag?: string) => {
  if (!flag || flag === 'normal') return 'text-green-600 bg-green-50';
  if (flag === 'low') return 'text-blue-600 bg-blue-50';
  if (flag === 'high') return 'text-amber-600 bg-amber-50';
  if (flag === 'critical_low' || flag === 'critical_high') return 'text-red-600 bg-red-50';
  return 'text-gray-600 bg-gray-50';
};

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

const CLINICAL_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-muted-foreground';
const CLINICAL_CARD = 'bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)]';

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

export default function DoctorDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useDoctorDashboard();
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
  const [selectedTests, setSelectedTests] = useState<Test[]>([]);
  const [searchTest, setSearchTest] = useState('');

  // Prescription modal state
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([]);
  const [searchMedication, setSearchMedication] = useState('');

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
  const [pendingNavigation, setPendingNavigation] = useState<{ type: 'patient' | 'tab'; value?: any } | null>(null);

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
        doctorId: profile?.id,  // Profile ID - admission.doctorId now refs Profile
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
  });

  // Fetch medications for prescription modal
  const { data: medications = [], isLoading: medicationsLoading } = useQuery({
    queryKey: ['medications'],
    queryFn: () => medicationService.findAll(),
    staleTime: 5 * 60 * 1000,
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
  const abnormalLabResults = labResults.filter((result: LabResult) => result.flag && result.flag !== 'normal');
  const criticalLabResults = labResults.filter((result: LabResult) => result.flag === 'critical_high' || result.flag === 'critical_low');
  const latestResultAt = labResults.reduce<string | undefined>((latest, result: LabResult) => {
    const candidate = result.resulted_at || result.createdAt;
    if (!candidate) return latest;
    if (!latest) return candidate;
    return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
  }, undefined);

  // m8: Sorted lab results
  const sortedLabResults = useMemo(() => {
    const flagOrder = { critical_high: 0, critical_low: 1, high: 2, low: 3, normal: 4 };
    const sorted = [...labResults];
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
        else if (labSortField === 'value') cmp = (a.value || '').localeCompare(b.value || '');
        else if (labSortField === 'flag') {
          const aVal = flagOrder[a.flag as keyof typeof flagOrder] ?? 4;
          const bVal = flagOrder[b.flag as keyof typeof flagOrder] ?? 4;
          cmp = aVal - bVal;
        }
        return labSortDir === 'asc' ? cmp : -cmp;
      });
    }
    return sorted;
  }, [labResults, labSortField, labSortDir]);

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

  // Handlers
  const handleSelectSearchPatient = (patient: any) => {
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
    } catch (error) {
      toast.error('Failed to accept patient');
    }
  };

  const handleSaveVitalsAndSOAP = async () => {
    if (!selectedVisit) return;
    if (!canWriteConsultation) {
      toast.error('Consultation fee must be paid before saving clinical notes');
      return;
    }

    try {
      await updateVisit.mutateAsync({
        visitId: selectedVisit._id || selectedVisit.id || '',
        data: {
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
          triageOverride_priority: triageOverride || undefined,
          doctorTriageNotes: doctorTriageNotes.trim() || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['patient-chart', selectedVisit.patientId?._id || selectedVisit.patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast.success('Notes saved');
      setIsDirty(false);
    } catch (error) {
      toast.error('Failed to save notes');
    }
  };

  const handleCompleteVisit = async (): Promise<boolean> => {
    if (!selectedVisit) return false;
    if (!canWriteConsultation) {
      toast.error('Consultation fee must be paid before completing the encounter');
      return false;
    }

    try {
      if (soapForm.subjective || soapForm.objective || soapForm.assessment || soapForm.plan || soapForm.diagnosis) {
        try {
          await soapNoteService.create({
            patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
            visitId: selectedVisit._id || selectedVisit.id,
            doctorId: profile?.id,
            noteType: SoapNoteTypeEnum.CONSULTATION,
            chiefComplaint: selectedVisit.chiefComplaint || undefined,
            historyPresentIllness: soapForm.subjective || undefined,
            vitalSigns: {
              temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
              bloodPressure: vitalsForm.bloodPressure || undefined,
              heartRate: vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : undefined,
              respiratoryRate: vitalsForm.respiratoryRate ? parseInt(vitalsForm.respiratoryRate) : undefined,
              weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : undefined,
              height: vitalsForm.height ? parseFloat(vitalsForm.height) : undefined,
              oxygenSaturation: vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation) : undefined,
            },
            physicalExamination: soapForm.objective || undefined,
            diagnosis: soapForm.diagnosis || soapForm.assessment || undefined,
            treatmentPlan: soapForm.plan || undefined,
            followUpInstructions: soapForm.plan || undefined,
            isSigned: true,
          });
        } catch (e) {
          // Non-blocking: SOAP note creation is best-effort
        }
      }
      await completeVisit.mutateAsync(selectedVisit._id || selectedVisit.id || '');
      toast.success('Visit completed');
      setIsDirty(false);
      setSelectedVisit(null);
      return true;
    } catch (error) {
      toast.error('Failed to complete visit');
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

  const getPrescriptionEstimate = (item: any) => estimateMedicationDispense(item, item as MedicationLike);

  const getPrescriptionEstimateTotal = (items: any[]) =>
    items.reduce((sum, item) => sum + getPrescriptionEstimate(item).lineTotal, 0);

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
      toast.success('Lab order created. Patient should pay at reception.');
      setLabOrderModalOpen(false);
      setSelectedTests([]);
      setEditingOrder(null);
      if (selectedVisit) {
        setSelectedVisit(prev => prev ? { ...prev, status: 'awaiting_lab' } : prev);
      }
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
          quantity: Number(item.quantity || computedQuantity || computeMedicationQuantity(item, { baseUnit }) || 1),
          // The frontend no longer sends dosage/frequency/duration (legacy) — backend
          // auto-generates them from strengthPerDose / dosesPerDay / durationDays
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        totalAmount: getPrescriptionEstimateTotal(prescriptionItems),
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

  // Prescription update mutation
  const updatePrescription = useMutation({
    mutationFn: async () => {
      if (!editingPrescription || prescriptionItems.length === 0) return;
      return await prescriptionService.update(editingPrescription._id, {
        items: prescriptionItems.map(({ unitPrice, sellMode, packSizes, baseUnit, smartInstruction, computedQuantity, quantityTouched, isControlled, requiresPrescription, ...item }) => ({
          ...item,
          quantity: Number(item.quantity || computedQuantity || computeMedicationQuantity(item, { baseUnit }) || 1),
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        totalAmount: getPrescriptionEstimateTotal(prescriptionItems),
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
    const instructions = buildSmartInstruction(regimen);
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
      updated[index].quantity = Number(value) || 0;
      updated[index].quantityTouched = Number(value) !== Number(updated[index].computedQuantity || 0);
    }
    setPrescriptionItems(updated);
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
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
      unitPrice: 0,
      instructions: item.instructions || '',
      pharmacistNote: item.pharmacistNote || '',
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

  // Global search across all visit queues
  const searchHits: Visit[] = []; // Replaced by DoctorTopBar patient search

  // Get the active visit for the doctor (if any)
  const currentActiveVisit = activePatients.find((v: Visit) => v.status === 'in_consultation') || activePatients[0];
  const canContinueClinicalWork = !!selectedVisit && ['in_consultation', 'results_ready', 'awaiting_doctor_review'].includes(selectedVisit.status);
  const isReadOnly = !canContinueClinicalWork;
  const canWriteConsultation = canContinueClinicalWork && selectedVisit?.consultationPaid === true;
  const consultationPaymentBlocksWriting = canContinueClinicalWork && selectedVisit?.consultationPaid === false;
  const canCloseEncounter = !!selectedVisit && !['awaiting_lab', 'awaiting_results', 'awaiting_pharmacy', 'awaiting_dispensing'].includes(selectedVisit.status);
  const closureBlockers = useMemo(() => {
    if (!selectedVisit) return [];
    const blockers: string[] = [];
    const status = selectedVisit.status;
    if (status === 'awaiting_lab') blockers.push('Lab order payment is still pending.');
    if (status === 'awaiting_results') blockers.push('Lab processing is still in progress.');
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

  // C1: Guard navigation when dirty
  const guardNavigation = useCallback((action: () => void, navType: 'patient' | 'tab', navValue?: any) => {
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
    if (pendingNavigation.type === 'patient' && pendingNavigation.value) {
      handleAcceptPatient(pendingNavigation.value);
    } else if (pendingNavigation.type === 'tab' && pendingNavigation.value) {
      setActiveTab(pendingNavigation.value);
    }
    setPendingNavigation(null);
  }, [pendingNavigation]);

  const saveAndProceed = useCallback(async () => {
    await handleSaveVitalsAndSOAP();
    setIsDirty(false);
    setDiscardConfirmOpen(false);
    if (!pendingNavigation) return;
    if (pendingNavigation.type === 'patient' && pendingNavigation.value) {
      handleAcceptPatient(pendingNavigation.value);
    } else if (pendingNavigation.type === 'tab' && pendingNavigation.value) {
      setActiveTab(pendingNavigation.value);
    }
    setPendingNavigation(null);
  }, [pendingNavigation]);

  // Auto-select the active patient if available
  useEffect(() => {
    if (currentActiveVisit && !selectedVisit) {
      setSelectedVisit(currentActiveVisit);
    }
  }, [currentActiveVisit?._id]);

  // Keep selectedVisit in sync with the latest dashboard data
  useEffect(() => {
    if (!selectedVisit) return;
    const allKnownVisits = [
      ...waitingQueue, ...activePatients, ...resultsReady,
      ...awaitingLabPayment, ...awaitingResults, ...awaitingPharmacy, ...awaitingDispensing,
    ];
    const refreshed = allKnownVisits.find((v) => v._id === selectedVisit._id);
    if (refreshed && JSON.stringify(refreshed) !== JSON.stringify(selectedVisit)) {
      setSelectedVisit(refreshed);
    }
  }, [waitingQueue, activePatients, resultsReady, awaitingLabPayment, awaitingResults, awaitingPharmacy, awaitingDispensing]);

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
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading workbench…</span>
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
        onSelectVisit={(visit) => { setSearchedPatient(null); setSelectedVisit(visit); setActiveTab(visit.status === 'results_ready' ? 'lab-results' : 'soap'); }}
        onAcceptVisit={handleAcceptPatient}
        onSelectPatient={handleSelectSearchPatient}
        onAcceptNext={() => { if (waitingQueue.length > 0) handleAcceptPatient(waitingQueue[0]); }}
        onOpenDashboard={() => { setSelectedVisit(null); setSearchedPatient(null); setActiveTab('soap'); }}
        onOpenResults={() => { if (resultsReady.length > 0) { setSelectedVisit(resultsReady[0]); setActiveTab('lab-results'); } }}
        onOpenAllPatients={() => { setAllPatientsOpen(true); setAllPatientsPage(1); setAllPatientsSearch(''); setAllPatientsDaysBack(undefined); }}
        onLogout={handleLogout}
        acceptPending={acceptPatient.isPending}
      />

      <div className="flex flex-1 pt-14 h-full">
        {/* Main Workspace */}
        <main className="flex-1 h-[calc(100vh-56px)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row gap-4 bg-slate-100/80 p-3 md:p-4">
            {/* Left Editor Area */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {selectedVisit || searchedPatient ? (
                <>
                  {/* Calm Patient Header */}
                  <section className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm md:px-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {contextPatient?.firstName?.[0]}{contextPatient?.lastName?.[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base font-semibold leading-tight">
                              {[contextPatient?.firstName, contextPatient?.lastName].filter(Boolean).join(' ').trim() || 'Unnamed patient'}
                            </h2>
                            {selectedVisit?.triagePriority && (
                              <Badge variant={selectedVisit.triagePriority.includes('emergency') || selectedVisit.triagePriority.includes('urgent') ? 'destructive' : 'outline'} className="h-5 text-[10px] capitalize">
                                {selectedVisit.triagePriority.replace('esi_', 'ESI ').replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {contextPatient?.allergies?.length > 0 ? (
                              <Badge variant="outline" className="h-5 border-red-200 bg-red-50 text-[10px] text-red-700">
                                Allergy: {contextPatient.allergies.slice(0, 1).join(', ')}{contextPatient.allergies.length > 1 ? ' +' + (contextPatient.allergies.length - 1) : ''}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">NKDA</span>
                            )}
                            {isReadOnly && <Badge className="h-5 bg-amber-500 text-[10px] text-white hover:bg-amber-500">View-only</Badge>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="font-mono">{contextPatient?.patientId || 'PID N/A'}</span>
                            <span>{patientAgeLabel(contextPatient)} / {contextPatient?.gender || 'N/A'}</span>
                            {selectedVisit && <span className="font-mono">{selectedVisit.visitNumber}</span>}
                            {selectedVisit && <span className="capitalize">{statusLabel(selectedVisit.status)}</span>}
                            {!selectedVisit && searchedPatient && <span className="font-medium text-amber-700">Chart review only - no active visit</span>}
                            <span>Wallet: Le {selectedWalletBalance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4 xl:min-w-[520px]">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide">Visit</p>
                          <p className="font-mono text-foreground">{selectedVisit?.visitNumber || 'No active visit'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide">Status</p>
                          <p className="capitalize text-foreground">{selectedVisit ? statusLabel(selectedVisit.status) : 'chart review'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide">Room</p>
                          <p className="text-foreground">{selectedVisit?.room || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide">Wallet</p>
                          <p className="font-semibold text-emerald-700">Le {selectedWalletBalance.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {(selectedVisit?.triageAlert || consultationPaymentBlocksWriting || (isDirty && canWriteConsultation)) && (
                    <div className="rounded-lg border border-amber-200 bg-white px-4 py-2 shadow-sm md:px-5">
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
                        {isDirty && canWriteConsultation && (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" /> Unsaved changes
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid overflow-visible rounded-xl border border-border bg-white shadow-sm xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section className="min-w-0 border-r border-border/80">
                      <Tabs value={activeTab} onValueChange={(val) => guardNavigation(() => setActiveTab(val), 'tab', val)} className="flex flex-col">
                        <div className="border-b border-border px-4 md:px-5">
                          <TabsList className="h-11 bg-transparent p-0">
                            <TabsTrigger value="soap" className="rounded-none border-b-2 border-transparent px-0 mr-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Consult</TabsTrigger>
                            <TabsTrigger value="lab-results" className="rounded-none border-b-2 border-transparent px-0 mr-6 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                              Results
                              {labResults.length > 0 && <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{labResults.length}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Timeline</TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="soap" className="m-0 flex-1 overflow-y-auto p-4 md:p-5">
                          <div className="mx-auto max-w-5xl space-y-5">
                            <div className="grid gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-3 lg:grid-cols-6">
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

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                              <div className="space-y-4">
                                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
                                  <div className="pt-7 text-center text-xl font-bold text-teal-700">C</div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Chief Complaint</Label>
                                    <Textarea value={chiefComplaintForm} onChange={(e) => setChiefComplaintForm(e.target.value)} placeholder="What brings the patient in today?" rows={2} className="resize-y border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t pt-4">
                                  <div className="pt-7 text-center text-xl font-bold text-teal-700">S</div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subjective</Label>
                                    <Textarea value={soapForm.subjective} onChange={(e) => setSoapForm({ ...soapForm, subjective: e.target.value })} placeholder="Patient history, symptoms, relevant negatives..." rows={8} className="resize-y border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t pt-4">
                                  <div className="pt-7 text-center text-xl font-bold text-teal-700">O</div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Objective</Label>
                                    <Textarea value={soapForm.objective} onChange={(e) => setSoapForm({ ...soapForm, objective: e.target.value })} placeholder="Exam findings, observations, reviewed results..." rows={6} className="resize-y border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                                  {[
                                    { key: 'temperature', label: 'Temp', placeholder: '36.5', type: 'number' },
                                    { key: 'bloodPressure', label: 'BP', placeholder: '120/80', type: 'text' },
                                    { key: 'heartRate', label: 'HR', placeholder: '72', type: 'number' },
                                    { key: 'respiratoryRate', label: 'RR', placeholder: '16', type: 'number' },
                                    { key: 'weight', label: 'Weight', placeholder: '70', type: 'number' },
                                    { key: 'oxygenSaturation', label: 'SpO2', placeholder: '98', type: 'number' },
                                  ].map((field) => (
                                    <div key={field.key}>
                                      <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                                      <Input type={field.type} value={(vitalsForm as any)[field.key]} onChange={(e) => setVitalsForm({ ...vitalsForm, [field.key]: e.target.value })} placeholder={field.placeholder} className={cn('mt-1 h-8 bg-white text-xs font-mono', vitalsErrors[field.key] && 'border-red-400 focus-visible:ring-red-400')} disabled={isReadOnly || !canWriteConsultation} />
                                      {vitalsErrors[field.key] && <p className="mt-0.5 text-[10px] text-red-500">{vitalsErrors[field.key]}</p>}
                                    </div>
                                  ))}
                                  <div className="col-span-2">
                                    <Label className="text-[10px] text-muted-foreground">Priority Override</Label>
                                    <Select value={triageOverride || selectedVisit?.triagePriority || ''} onValueChange={setTriageOverride} disabled={isReadOnly || !canWriteConsultation}>
                                      <SelectTrigger className="mt-1 h-8 bg-white text-xs"><SelectValue placeholder="Set priority" /></SelectTrigger>
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
                                <div className="space-y-2">
                                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis</Label>
                                  <Input value={soapForm.diagnosis} onChange={(e) => setSoapForm({ ...soapForm, diagnosis: e.target.value })} placeholder="Primary diagnosis" className="h-9 border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                </div>
                                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
                                  <div className="pt-7 text-center text-xl font-bold text-teal-700">A</div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assessment</Label>
                                    <Textarea value={soapForm.assessment} onChange={(e) => setSoapForm({ ...soapForm, assessment: e.target.value })} placeholder="Clinical impression and differential..." rows={5} className="resize-y border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 border-t pt-4">
                                  <div className="pt-7 text-center text-xl font-bold text-teal-700">P</div>
                                  <div className="space-y-2">
                                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plan</Label>
                                    <Textarea value={soapForm.plan} onChange={(e) => setSoapForm({ ...soapForm, plan: e.target.value })} placeholder="Treatment plan, follow-up, counselling..." rows={5} className="resize-y border-muted-foreground/20 bg-white text-sm" disabled={isReadOnly || !canWriteConsultation} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="lab-results" className="m-0 flex-1 overflow-y-auto bg-slate-50/60 p-3 md:p-5">
                          {selectedVisit ? (
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
                                      Current visit LIS results for {patientDisplayName(selectedVisit)}. Last result: {formatClinicalDateTime(latestResultAt)}.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => queryClient.invalidateQueries({ queryKey: ['results', labOrderId] })}>
                                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={sortedLabResults.length === 0}>
                                      <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 bg-[#0d9488] text-xs text-white hover:bg-[#0f766e]"
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
                                  No released lab results yet for this visit.
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
                                            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                              <Eye className="mr-1 h-3.5 w-3.5" /> Compare
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant={reviewed ? 'outline' : 'default'}
                                              className={cn('h-7 px-2 text-xs', !reviewed && 'bg-slate-900 text-white hover:bg-slate-800')}
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

                    <aside className="bg-slate-50/80 px-4 py-4 xl:max-h-[calc(100vh-186px)] xl:overflow-y-auto">
                      <div className="space-y-5">
                        <div className="rounded-lg border border-teal-100 bg-white p-3 shadow-sm">
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Encounter</h3>
                            {selectedVisit && <span className="text-[10px] capitalize text-muted-foreground">{statusLabel(selectedVisit.status)}</span>}
                          </div>
                          <div className="mb-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">Next step</p>
                            <p>Finalize this encounter and move to the next patient.</p>
                          </div>
                          <Button className="w-full justify-center bg-[#0d9488] text-white hover:bg-[#0f766e]" onClick={() => setConfirmCompleteOpen(true)} disabled={completeVisit.isPending || !canCloseEncounter || isReadOnly || !canWriteConsultation} title={!canCloseEncounter ? closureBlockers.join(' ') : undefined}>
                            {completeVisit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Complete & Next
                          </Button>
                          {closureBlockers.length > 0 && <p className="mt-2 text-xs text-amber-700">{closureBlockers[0]}</p>}
                        </div>

                        <div className="grid grid-cols-4 gap-2 border-t border-border pt-4">
                          {[
                            { label: 'Order Lab', icon: FlaskConical, disabled: !contextPatient, onClick: () => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); } },
                            { label: 'Prescribe', icon: Pill, disabled: !contextPatient, onClick: () => { setEditingPrescription(null); setPrescriptionItems([]); setPrescriptionModalOpen(true); } },
                            { label: 'Plan', icon: ClipboardList, disabled: !contextPatient, onClick: () => setTreatmentPlanOpen(true) },
                            { label: 'Refer', icon: Send, disabled: !selectedVisit, onClick: () => { setReferralOpen(true); setReferralForm({ specialistId: '', reason: '', notes: '' }); } },
                          ].map((action) => {
                            const Icon = action.icon;
                            return (
                              <button
                                key={action.label}
                                type="button"
                                onClick={action.onClick}
                                disabled={action.disabled}
                                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-transparent text-[10px] font-medium text-slate-700 transition-colors hover:border-border hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Icon className="h-4 w-4 text-slate-700" />
                                <span>{action.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="border-t border-border pt-4">
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Needs attention</h4>
                          <div className="space-y-2 text-xs">
                            {abnormalLabResults[0] && (
                              <button className="flex w-full items-center justify-between gap-2 rounded-md bg-red-50 px-2 py-2 text-left text-red-700" onClick={() => setActiveTab('lab-results')}>
                                <span className="truncate">Critical/abnormal: {abnormalLabResults[0].testName}</span>
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              </button>
                            )}
                            {consultationPaymentBlocksWriting && <div className="rounded-md bg-red-50 px-2 py-2 text-red-700">Consultation fee unpaid</div>}
                            {currentVisitPrescriptions.some((rx: any) => !rx.isPaid) && <div className="rounded-md bg-amber-50 px-2 py-2 text-amber-700">Prescription unpaid</div>}
                            {closureBlockers.length === 0 && abnormalLabResults.length === 0 && !consultationPaymentBlocksWriting && !currentVisitPrescriptions.some((rx: any) => !rx.isPaid) && <div className="text-muted-foreground">No blocking items.</div>}
                          </div>
                        </div>

                        <div className="border-t border-border pt-4">
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Orders</h4>
                          <div className="space-y-2 text-xs">
                            {currentVisitOrders.slice(0, 3).map((order: any) => (
                              <div key={order._id || order.id} className="flex items-center justify-between gap-2">
                                <span className="truncate">{(order.order_tests || order.tests || []).map((t: any) => t.testName || t.testCode).join(', ') || statusLabel(order.orderType || order.order_type)}</span>
                                <span className="shrink-0 capitalize text-muted-foreground">{statusLabel(order.status || order.paymentStatus || order.payment_status)}</span>
                              </div>
                            ))}
                            {currentVisitPrescriptions.slice(0, 3).map((rx: any) => (
                              <div key={rx._id} className="flex items-center justify-between gap-2">
                                <span className="truncate">{(rx.items || []).map((i: any) => i.medicationName).join(', ') || rx.prescriptionNumber}</span>
                                <span className="shrink-0 text-muted-foreground">{rx.isPaid ? statusLabel(rx.status) : 'unpaid'}</span>
                              </div>
                            ))}
                            {currentVisitOrders.length === 0 && currentVisitPrescriptions.length === 0 && <div className="text-muted-foreground">No active orders.</div>}
                          </div>
                        </div>

                        <div className="border-t border-border pt-4">
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Handoff</h4>
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-muted-foreground">{selectedVisit?.status === 'admitted' ? 'Admitted' : 'Not admitted'}</span>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdmitOpen(true)} disabled={!selectedVisit}>Admit</Button>
                          </div>
                        </div>

                        <div className="border-t border-border pt-4">
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Closure checklist</h4>
                          <div className="space-y-1.5 text-xs">
                            {[
                              { label: 'Diagnosis entered', done: !!soapForm.diagnosis },
                              { label: 'SOAP saved', done: !isDirty },
                              { label: 'No blockers', done: closureBlockers.length === 0 },
                              { label: 'Results reviewed', done: abnormalLabResults.length === 0 || activeTab === 'lab-results' },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-2">
                                <span className={item.done ? 'text-muted-foreground' : 'text-foreground'}>{item.label}</span>
                                <span className={cn('h-2 w-2 rounded-full', item.done ? 'bg-emerald-500' : 'bg-amber-400')} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </aside>
                  </div>

                  <div className="sticky bottom-0 z-10 border-t bg-white/95 px-4 md:px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85">
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
                        <Button size="sm" className="bg-[#0d9488] text-white hover:bg-[#0f766e]" onClick={() => setConfirmCompleteOpen(true)} disabled={completeVisit.isPending || !canCloseEncounter || isReadOnly || !canWriteConsultation}>
                          {completeVisit.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-2 h-3.5 w-3.5" />}
                          Complete & Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col gap-6">
                  {/* Today's Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { if (activePatients.length > 0) { setSelectedVisit(activePatients[0]); setActiveTab('soap'); } }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-blue-600" />
                        </div>
                        <Badge variant="secondary" className="text-xs">{openEncounterCount} active</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stats.seen}</p>
                      <p className="text-xs text-muted-foreground mt-1">Patients seen today</p>
                    </div>

                    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { if (waitingQueue.length > 0) handleAcceptPatient(waitingQueue[0]); }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-amber-600" />
                        </div>
                        <Badge variant="secondary" className="text-xs">in queue</Badge>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{stats.waiting}</p>
                      <p className="text-xs text-muted-foreground mt-1">Patients waiting</p>
                    </div>

                    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { if (resultsReady.length > 0) { setSelectedVisit(resultsReady[0]); setActiveTab('lab-results'); } }}>
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
                        <Button size="sm" onClick={() => handleAcceptPatient(waitingQueue[0])} disabled={acceptPatient.isPending}>
                          {acceptPatient.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 mr-1.5" />}
                          Accept Next
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {waitingQueue.slice(0, 5).map((visit: Visit) => (
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleAcceptPatient(visit)}>
                            <div className="flex items-center gap-3 min-w-0">
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
                        <Button size="sm" variant="outline" onClick={() => { setSelectedVisit(resultsReady[0]); setActiveTab('lab-results'); }}>
                          <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                          Review Results
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {resultsReady.slice(0, 3).map((visit: Visit) => (
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50/50 hover:bg-green-100/50 transition-colors cursor-pointer" onClick={() => { setSelectedVisit(visit); setActiveTab('lab-results'); }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-green-700">
                                  {visit.patientId?.firstName?.[0]}{visit.patientId?.lastName?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{patientDisplayName(visit)}</p>
                                <p className="text-xs text-muted-foreground truncate">{visit.chiefComplaint || 'Lab results available'}</p>
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
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => { setSelectedVisit(visit); setActiveTab('soap'); }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-blue-700">
                                  {visit.patientId?.firstName?.[0]}{visit.patientId?.lastName?.[0]}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{patientDisplayName(visit)}</p>
                                <p className="text-xs text-muted-foreground truncate">{visit.chiefComplaint || 'In consultation'}</p>
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
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100/50 transition-colors cursor-pointer" onClick={() => { setSelectedVisit(visit); setActiveTab('soap'); }}>
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
                          <div key={visit._id} className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-colors cursor-pointer" onClick={() => { setSelectedVisit(visit); setActiveTab('soap'); }}>
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
          </div>
        </main>
      </div>

      {/* All Modals */}

      {/* Lab Order Modal */}
      <Dialog open={labOrderModalOpen} onOpenChange={(open) => { if (!open) cancelEdit(); setLabOrderModalOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Edit Lab Order' : 'Order Lab Tests'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <DialogFooter>
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
            <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,0.32fr)_minmax(420px,1fr)_minmax(260px,0.3fr)]">
              <MedicationPicker
                medications={filteredMedications}
                loading={medicationsLoading}
                searchTerm={searchMedication}
                onSearchTermChange={setSearchMedication}
                onSelect={(med) => addMedicationToPrescription(med as Medication)}
                title="Search CAF / local drugs"
                className="min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:min-h-0"
                listClassName="h-[32vh] lg:h-[calc(94vh-15rem)]"
              />
              <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <Label className="text-sm font-semibold text-slate-950">Regimen editor</Label>
                    <p className="text-[11px] text-muted-foreground">Dose math, route, dispense quantity, and patient-facing directions.</p>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-[10px]">Est. individual pricing</Badge>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  {prescriptionItems.length === 0 ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Select a medication from the left to start the prescription.
                    </div>
                  ) : (
                    <div className="space-y-3 p-3">
                      {prescriptionItems.map((item, index) => {
                        const computedQty = computeMedicationQuantity(item, { baseUnit: item.baseUnit });
                        const dispenseQty = Number(item.quantity || computedQty || 1);
                        const estimate = getPrescriptionEstimate({ ...item, quantity: dispenseQty });
                        const unitLabel = item.baseUnit || 'unit';
                        const duplicateCount = prescriptionItems.filter((candidate) => candidate.medicationId === item.medicationId).length;
                        const isDuplicate = duplicateCount > 1;
                        const quantityDiffers = dispenseQty !== computedQty;
                        const validationErrors = validateMedicationRegimen({ ...item, quantity: dispenseQty });
                        return (
                          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-sm font-semibold text-slate-950">{item.medicationName}</p>
                                  {item.isControlled && <Badge variant="destructive" className="text-[10px]">Controlled</Badge>}
                                  {isDuplicate && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">Duplicate</Badge>}
                                  {(item.route === 'intravenous' || item.route === 'intramuscular') && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">{item.route === 'intravenous' ? 'IV' : 'IM'}</Badge>}
                                </div>
                                {item.sellMode && item.sellMode !== 'individual' && item.packSizes && item.packSizes.length > 0 && (
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    Packs: {item.packSizes.slice(0, 2).map((ps: any) => `${ps.name} (${ps.unitsPerPack || ps.quantityPerPack || '?'} ${unitLabel}) @ Le ${Number(ps.sellingPrice || 0).toLocaleString()}`).join(' - ')}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removePrescriptionItem(index)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-5">
                              <div className="xl:col-span-2">
                                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Per dose</Label>
                                <Input placeholder="e.g. 500mg or 1 tablet" value={item.strengthPerDose} onChange={(e) => updatePrescriptionItem(index, 'strengthPerDose', e.target.value)} className="mt-1 h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Doses/day</Label>
                                <Input type="number" min={1} value={item.dosesPerDay} onChange={(e) => updatePrescriptionItem(index, 'dosesPerDay', parseInt(e.target.value) || 1)} className="mt-1 h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Days</Label>
                                <Input type="number" min={1} value={item.durationDays} onChange={(e) => updatePrescriptionItem(index, 'durationDays', parseInt(e.target.value) || 1)} className="mt-1 h-8 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Route</Label>
                                <Select value={item.route || 'oral'} onValueChange={(value) => updatePrescriptionItem(index, 'route', value)}>
                                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="oral">Oral</SelectItem>
                                    <SelectItem value="intravenous">IV</SelectItem>
                                    <SelectItem value="intramuscular">IM</SelectItem>
                                    <SelectItem value="subcutaneous">SC</SelectItem>
                                    <SelectItem value="topical">Topical</SelectItem>
                                    <SelectItem value="ophthalmic">Eye drops</SelectItem>
                                    <SelectItem value="otic">Ear drops</SelectItem>
                                    <SelectItem value="nasal">Nasal</SelectItem>
                                    <SelectItem value="inhalation">Inhalation</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="mt-3 grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_auto]">
                              <div>
                                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Qty to dispense</Label>
                                <Input type="number" min={1} value={dispenseQty} onChange={(e) => updatePrescriptionItem(index, 'quantity', Number(e.target.value) || 0)} className={cn('mt-1 h-8 text-xs font-semibold', quantityDiffers && 'border-amber-300 bg-amber-50')} />
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground">
                                <span>Computed: <strong className="text-slate-800">{computedQty} {unitLabel}</strong></span>
                                <span className="mx-2">-</span>
                                <span>
                                  Estimate: <strong className="text-slate-800">
                                    {estimate.mode === 'pack'
                                      ? `${estimate.sellQuantity} ${estimate.sellUnitLabel}${estimate.sellQuantity === 1 ? '' : 's'}`
                                      : `${estimate.sellQuantity} ${estimate.sellUnitLabel}${estimate.sellQuantity === 1 ? '' : 's'}`}
                                  </strong>
                                  {' '}= <strong className="text-slate-800">Le {estimate.lineTotal.toLocaleString()}</strong>
                                </span>
                                {estimate.mode === 'pack' && estimate.packUnits && (
                                  <p className="mt-1 text-slate-600">
                                    Covers {estimate.sellQuantity * estimate.packUnits} {unitLabel}; charging by {estimate.sellUnitLabel}, not by days.
                                  </p>
                                )}
                                {quantityDiffers && <p className="mt-1 font-medium text-amber-700">Manual quantity differs from computed regimen. Keep only if clinically intentional.</p>}
                              </div>
                              <Button type="button" variant="outline" size="sm" className="h-8 self-end text-xs" onClick={() => updatePrescriptionItem(index, 'quantity', computedQty)}>
                                Reset qty
                              </Button>
                            </div>

                            {validationErrors.length > 0 && (
                              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                                {validationErrors.join(' ')}
                              </div>
                            )}

                            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
                              <Input placeholder="Patient instructions" value={item.instructions} onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)} className="h-9 text-xs" />
                              <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => updatePrescriptionItem(index, 'instructions', item.smartInstruction || buildSmartInstruction(item))}>
                                Regenerate instructions
                              </Button>
                            </div>
                            <Input placeholder="Pharmacist note (internal only, not on label)" value={item.pharmacistNote || ''} onChange={(e) => updatePrescriptionItem(index, 'pharmacistNote', e.target.value)} className="mt-2 h-8 text-xs" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-col gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Prescription summary</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    Le {getPrescriptionEstimateTotal(prescriptionItems).toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Smart estimate from base-unit need and available cards/packs. Reception can still adjust at dispense.</p>
                </div>

                <div className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Label preview</p>
                    <Badge variant="outline" className="text-[10px]">{prescriptionItems.length} labels</Badge>
                  </div>
                  <ScrollArea className="h-[34vh] lg:h-[calc(94vh-25.5rem)]">
                    {prescriptionItems.length === 0 ? (
                      <p className="py-10 text-center text-xs text-muted-foreground">Added medicines will preview here.</p>
                    ) : (
                      <div className="space-y-2 pr-2">
                        {prescriptionItems.map((item, index) => {
                          const computedQty = computeMedicationQuantity(item, { baseUnit: item.baseUnit });
                          const dispenseQty = Number(item.quantity || computedQty || 1);
                          const estimate = getPrescriptionEstimate({ ...item, quantity: dispenseQty });
                          const unitLabel = item.baseUnit || 'unit';
                          return (
                            <div key={`${item.medicationId}-${index}`} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs">
                              <p className="font-semibold text-slate-950">{item.medicationName}</p>
                              <p className="mt-1 text-slate-700">{item.instructions || buildSmartInstruction(item)}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Need: {dispenseQty} {unitLabel}. Suggested dispense: {estimate.mode === 'pack' ? `${estimate.sellQuantity} ${estimate.sellUnitLabel}` : `${estimate.sellQuantity} ${estimate.sellUnitLabel}`}. Route: {statusLabel(item.route)}.
                              </p>
                              {item.pharmacistNote && <p className="mt-1 text-[11px] text-muted-foreground">Pharmacist: {item.pharmacistNote}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t bg-white px-4 py-3 sm:px-5">
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button className="bg-[#0d9488] text-white hover:bg-[#0f766e]" onClick={() => editingPrescription ? updatePrescription.mutate() : createPrescription.mutate()} disabled={(editingPrescription ? updatePrescription.isPending : createPrescription.isPending) || prescriptionItems.length === 0 || prescriptionItems.some(i => validateMedicationRegimen(i).length > 0)}>
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
            <Button onClick={async () => { if (!selectedVisit) return; try { await referToSpecialist.mutateAsync({ visitId: selectedVisit._id || selectedVisit.id || '', data: referralForm }); toast.success('Patient referred to specialist'); setReferralOpen(false); setReferralForm({ specialistId: '', reason: '', notes: '' }); setSelectedVisit(null); } catch { toast.error('Failed to refer patient'); } }} disabled={referToSpecialist.isPending || !referralForm.specialistId || !referralForm.reason}>
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
              onPlanCreated={() => {
                setTreatmentPlanOpen(false);
                queryClient.invalidateQueries({ queryKey: ['visits'] });
                queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
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
            <Button onClick={() => { setConfirmCompleteOpen(false); handleCompleteAndNext(); }} disabled={completeVisit.isPending || !canCloseEncounter} className="bg-[#0d9488] hover:bg-[#0f766e] text-white">
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
                        setAllPatientsOpen(false);
                        try {
                          const visits: any[] = await visitsAPI.getByPatient(p._id);
                          if (visits && visits.length > 0) {
                            const last = visits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                            setSelectedVisit(last);
                            setActiveTab('timeline');
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
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={saveAndProceed} disabled={updateVisit.isPending}>
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
              className="bg-red-600 hover:bg-red-700 text-white"
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
