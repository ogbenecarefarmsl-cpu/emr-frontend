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

// Icons
import {
  Loader2, CheckCircle, User, FileText, FlaskConical, Pill,
  ChevronDown, AlertTriangle, Search, Plus, Trash2, Save,
  Send, Heart, ClipboardList, UserCheck, BedDouble, ExternalLink, Activity,
  Pencil, AlertCircle, TestTube, Stethoscope, Calendar, LogOut
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
  const { data: medications = [] } = useQuery({
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
        items: prescriptionItems.map(({ unitPrice, sellMode, packSizes, baseUnit, ...item }) => ({
          ...item,
          // The frontend no longer sends dosage/frequency/duration (legacy) — backend
          // auto-generates them from strengthPerDose / dosesPerDay / durationDays
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        // totalAmount is now auto-computed on the backend
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
        items: prescriptionItems.map(({ unitPrice, ...item }) => ({
          ...item,
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        // totalAmount is auto-computed on the backend
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
        medicationId: med._id,
        medicationName: med.name,
        // Structured regimen (NEW)
        strengthPerDose: med.strength || '1',
        dosesPerDay: 1,
        durationDays: 7,
        // Free-text overrides (auto-generated from above)
        dosage: '',
        frequency: '',
        duration: '',
        // Computed in real time from structured fields
        quantity: 0,
        route: 'oral',
        unitPrice: med.unitPrice || 0,
        // For the doctor's awareness
        sellMode: med.sellMode,
        packSizes: med.packSizes,
        baseUnit: med.baseUnit,
        instructions: '',
        pharmacistNote: '',
      },
    ]);
  };

  const updatePrescriptionItem = (index: number, field: string, value: any) => {
    const updated = [...prescriptionItems];
    updated[index][field] = value;
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
        medicationId: med._id,
        medicationName: med.name,
        strengthPerDose: med.strength || '1',
        dosesPerDay: 1,
        durationDays: 7,
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 0,
        route: 'oral',
        unitPrice: med.unitPrice || 0,
        sellMode: med.sellMode,
        packSizes: med.packSizes,
        baseUnit: med.baseUnit,
        instructions: '',
        pharmacistNote: '',
      },
    ]);
  }, [prescriptionItems]);

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
        acceptPending={acceptPatient.isPending}
      />

      {/* Header */}
      <header className="fixed top-12 left-0 right-0 h-14 bg-white border-b border-border z-50 flex items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0 md:hidden">
            <img src="/harbour-emr-logo.svg" alt="Harbour EMR Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-primary text-lg">Harbour EMR</span>
          </div>
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
            {[
              { label: 'Consult', value: 'soap', shortcut: '1' },
              { label: 'Results', value: 'lab-results', shortcut: '2' },
              { label: 'Timeline', value: 'timeline', shortcut: '3' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => guardNavigation(() => setActiveTab(tab.value), 'tab', tab.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === tab.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title={`${tab.label} (${tab.shortcut})`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { if (resultsReady.length > 0) { setSelectedVisit(resultsReady[0]); setActiveTab('lab-results'); } }}
              disabled={resultsReady.length === 0}
              className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
              title={`${resultsReady.length} results ready`}
            >
              <FlaskConical className="w-4 h-4 text-muted-foreground" />
              {resultsReady.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center px-1">{resultsReady.length}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setAllPatientsOpen(true); setAllPatientsPage(1); setAllPatientsSearch(''); setAllPatientsDaysBack(undefined); }}
              className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
              title="All My Patients"
            >
              <UserCheck className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{profile?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium hidden lg:block truncate max-w-40">{profile?.fullName}</span>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleLogout} title="Logout">
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-[104px] h-full">
        {/* Main Workspace */}
        <main className="flex-1 h-[calc(100vh-104px)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row gap-6 p-4 md:p-6">
            {/* Left Editor Area */}
            <div className="flex-1 flex flex-col gap-5 min-w-0">
              {/* Quick Actions Bar - Always visible when patient selected */}
              {(selectedVisit || searchedPatient) && (
                <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border border-primary/20 rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 hover:bg-primary/10 hover:border-primary"
                      onClick={() => { setLabOrderModalOpen(true); setEditingOrder(null); }}
                      disabled={!contextPatient}
                    >
                      <FlaskConical className="w-4 h-4" />
                      Order Lab
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 hover:bg-primary/10 hover:border-primary"
                      onClick={() => { setPrescriptionModalOpen(true); setEditingPrescription(null); }}
                      disabled={!contextPatient}
                    >
                      <Pill className="w-4 h-4" />
                      Prescribe
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 hover:bg-primary/10 hover:border-primary"
                      onClick={() => setTreatmentPlanOpen(true)}
                      disabled={!contextPatient}
                    >
                      <ClipboardList className="w-4 h-4" />
                      Treatment Plan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 hover:bg-primary/10 hover:border-primary"
                      onClick={() => { setReferralOpen(true); setReferralForm({ specialistId: '', reason: '', notes: '' }); }}
                      disabled={!selectedVisit}
                    >
                      <UserCheck className="w-4 h-4" />
                      Refer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 hover:bg-primary/10 hover:border-primary"
                      onClick={() => { setAdmitOpen(true); setAdmitForm({ wardType: 'general', bedNumber: '', admissionReason: '', diagnosis: '', notes: '' }); }}
                      disabled={!selectedVisit}
                    >
                      <BedDouble className="w-4 h-4" />
                      Admit
                    </Button>
                    <div className="flex-1" />
                    {abnormalLabResults.length > 0 && (
                      <Badge className="bg-red-500 text-white gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        {abnormalLabResults.length} abnormal result{abnormalLabResults.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {selectedVisit || searchedPatient ? (
                <>
                  {selectedVisit.triageAlert && selectedVisit.triageAlerts && selectedVisit.triageAlerts.length > 0 && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 flex items-start gap-2.5 shadow-[0_1px_3px_rgba(220,38,38,0.08)]">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Nurse Triage Alert</p>
                        <p className="text-sm font-semibold text-red-900 mt-0.5">{selectedVisit.triageAlert}</p>
                        {selectedVisit.triageAlerts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {selectedVisit.triageAlerts.map((a: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-medium border border-red-200">
                                {a.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Patient Context Strip */}
                  <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {contextPatient?.firstName?.[0]}{contextPatient?.lastName?.[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold">{[contextPatient?.firstName, contextPatient?.lastName].filter(Boolean).join(' ').trim() || 'Unnamed patient'}</h2>
                        <p className="text-[11px] text-muted-foreground font-mono">{contextPatient?.patientId || 'N/A'}</p>
                      </div>
                      <div className="hidden sm:block h-8 w-px bg-border mx-1" />
                      <span className="text-xs text-muted-foreground">{patientAgeLabel(contextPatient)} · {contextPatient?.gender || 'N/A'}</span>
                      {selectedVisit && (
                        <>
                          <div className="hidden sm:block h-8 w-px bg-border mx-1" />
                          <div className="flex items-center gap-1.5">
                            {selectedVisit.triagePriority && (
                              <span className={cn("w-2 h-2 rounded-full", selectedVisit.triagePriority.includes('emergency') || selectedVisit.triagePriority.includes('urgent') ? "bg-red-500" : "bg-amber-500")} />
                            )}
                            <span className="text-[11px] text-muted-foreground">{selectedVisit.triagePriority ? statusLabel(selectedVisit.triagePriority) : 'Triage'}</span>
                          </div>
                        </>
                      )}
                      {selectedVisit && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-full md:max-w-[180px]">{chiefComplaintForm || selectedVisit.chiefComplaint || 'No complaint'}</span>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        {contextPatient?.allergies?.length > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium border border-red-200 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {contextPatient.allergies.length} allerg{contextPatient.allergies.length === 1 ? 'y' : 'ies'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">NKDA</span>
                        )}
                        {contextPatient?.chronicConditions?.slice(0, 2).map((c: string) => (
                          <span key={c} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
                            {c}
                          </span>
                        ))}
                        {contextPatient?.chronicConditions?.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{contextPatient.chronicConditions.length - 2}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground">Le {selectedWalletBalance.toLocaleString()}</span>
                      {selectedVisit ? (
                        <>
                          <Badge variant="outline" className="text-[10px]">{selectedVisit.visitNumber}</Badge>
                          <Badge className={cn("text-[10px]", visitStatusTone(selectedVisit.status))}>{statusLabel(selectedVisit.status)}</Badge>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">No active visit</Badge>
                      )}
                      {isReadOnly && (
                        <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500 text-white">View-only</Badge>
                      )}
                    </div>
                  </div>

                  {/* Read-only banner */}
                  {/* Read-only banner */}
                  {isReadOnly && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {searchedPatient
                            ? 'View-only mode — no active visit from triage. You can order labs/prescriptions and view history, but clinical notes cannot be saved.'
                            : 'View-only mode — accept this patient from the queue to enable clinical documentation.'}
                        </span>
                      </div>
                      {searchedPatient && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSearchedPatient(null); setSelectedVisit(null); }}>
                          Close
                        </Button>
                      )}
                    </div>
                  )}

                  {consultationPaymentBlocksWriting && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-red-800">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Consultation fee has not been paid. You can view the chart and order labs/prescriptions, but clinical notes cannot be saved until payment is received.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* C1: Unsaved changes banner */}
                  {isDirty && canWriteConsultation && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="font-medium">You have unsaved changes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setIsDirty(false); toast.info('Changes discarded'); }}>Discard</Button>
                        <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSaveVitalsAndSOAP} disabled={updateVisit.isPending}>
                          {updateVisit.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Draft
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={(val) => guardNavigation(() => setActiveTab(val), 'tab', val)} className="w-full flex flex-col flex-1">
                    <div className="border-b border-border bg-white rounded-t-xl overflow-x-auto">
                      <TabsList className="bg-transparent h-auto p-0 min-w-max px-4">
                        <TabsTrigger value="soap" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">Consult</TabsTrigger>
                        <TabsTrigger value="lab-results" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none relative text-sm">
                          Results
                          {labResults.length > 0 && (
                            <Badge className="ml-1.5 h-4 min-w-4 text-[10px]">{labResults.length}</Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="timeline" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">Timeline</TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Consult Tab — Stitch Layout */}
                    <TabsContent value="soap" className="p-6 mt-0">
                      <div className="flex flex-col gap-5">
                        {/* Triage Vitals - Auto-populated from nurse triage */}
                        {(selectedVisit?.temperature || selectedVisit?.bloodPressure || selectedVisit?.heartRate || selectedVisit?.triagePriority) && (
                          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                              <Activity className="w-4 h-4" />
                              Nurse Triage
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 text-xs">
                              {selectedVisit.temperature && <div><span className="text-muted-foreground">Temp:</span> <span className="font-medium">{selectedVisit.temperature} C</span></div>}
                              {selectedVisit.bloodPressure && <div><span className="text-muted-foreground">BP:</span> <span className="font-medium">{selectedVisit.bloodPressure}</span></div>}
                              {selectedVisit.heartRate && <div><span className="text-muted-foreground">HR:</span> <span className="font-medium">{selectedVisit.heartRate} bpm</span></div>}
                              {selectedVisit.respiratoryRate && <div><span className="text-muted-foreground">RR:</span> <span className="font-medium">{selectedVisit.respiratoryRate}/min</span></div>}
                              {selectedVisit.weight && <div><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{selectedVisit.weight} kg</span></div>}
                              {selectedVisit.height && <div><span className="text-muted-foreground">Height:</span> <span className="font-medium">{selectedVisit.height} cm</span></div>}
                              {selectedVisit.oxygenSaturation && <div><span className="text-muted-foreground">SpO2:</span> <span className="font-medium">{selectedVisit.oxygenSaturation}%</span></div>}
                              {selectedVisit.triagePriority && (
                                <div>
                                  <span className="text-muted-foreground">Priority:</span>{' '}
                                  <Badge variant={selectedVisit.triagePriority.includes('emergency') || selectedVisit.triagePriority.includes('urgent') ? 'destructive' : 'outline'} className="text-[10px] capitalize">
                                    {selectedVisit.triagePriority.replace('esi_', 'ESI ')}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            {selectedVisit.triageNotes && (
                              <p className="text-xs text-blue-700 dark:text-blue-400 mt-2 italic">
                                Nurse notes: {selectedVisit.triageNotes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Rapid Test Results (malaria/typhoid) */}
                        {selectedVisit?.rapidTestResults && selectedVisit.rapidTestResults.length > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                              <TestTube className="w-4 h-4" />
                              Rapid Test Results
                            </h4>
                            <div className="space-y-2">
                              {[...selectedVisit.rapidTestResults].reverse().map((r: any, i: number) => (
                                <div key={i} className={cn('rounded-md border p-2.5', r.result === 'positive' ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200')}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold capitalize text-amber-900">{r.testType}</span>
                                      <Badge variant={r.result === 'positive' ? 'destructive' : 'default'} className="text-[10px]">
                                        {r.result === 'positive' ? 'POSITIVE' : 'NEGATIVE'}
                                      </Badge>
                                      {r.parasiteCount != null && (
                                        <span className="text-xs text-amber-900">Parasite load: <span className="font-semibold">{r.parasiteCount}/µL</span></span>
                                      )}
                                      {r.antigen && <span className="text-xs text-amber-900">Antigen: {r.antigen}</span>}
                                    </div>
                                    <span className="text-[10px] text-amber-700">
                                      {new Date(r.performedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {r.notes && <p className="text-xs text-amber-800 italic mt-1">{r.notes}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Subjective Card */}
                        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-primary">chat_bubble</span> Subjective
                            </h3>
                          </div>
                          <div className="p-4">
                            <Label className="text-[11px] text-muted-foreground font-semibold">Chief Complaint</Label>
                            <Input
                              value={chiefComplaintForm}
                              onChange={(e) => setChiefComplaintForm(e.target.value)}
                              placeholder="e.g., Fever and chills x 3 days"
                              className="mt-1"
                              disabled={isReadOnly || !canWriteConsultation}
                            />
                            <Label className="text-[11px] text-muted-foreground font-semibold mt-3 block">Patient History (HPI)</Label>
                            <Textarea value={soapForm.subjective} onChange={(e) => setSoapForm({...soapForm, subjective: e.target.value})} placeholder="Patient's description of symptoms, history of present illness..." rows={4} className="mt-1 resize-y text-sm" disabled={isReadOnly || !canWriteConsultation} />
                          </div>
                        </div>

                        {/* Objective Card */}
                        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-primary">monitor_heart</span> Objective
                            </h3>
                          </div>
                          <div className="p-4 flex flex-col gap-3">
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { key: 'temperature', label: 'Temp (C)', placeholder: '36.5', type: 'number', hint: '30-42' },
                                  { key: 'bloodPressure', label: 'BP (mmHg)', placeholder: '120/80', type: 'text' },
                                  { key: 'heartRate', label: 'HR (bpm)', placeholder: '72', type: 'number', hint: '20-300' },
                                  { key: 'respiratoryRate', label: 'RR (/min)', placeholder: '16', type: 'number', hint: '5-60' },
                                  { key: 'weight', label: 'Weight (kg)', placeholder: '70', type: 'number', hint: '0.5-300' },
                                  { key: 'height', label: 'Height (cm)', placeholder: '170', type: 'number', hint: '30-250' },
                                  { key: 'oxygenSaturation', label: 'SpO2 (%)', placeholder: '98', type: 'number', hint: '0-100' },
                                ].map((field) => (
                                  <div key={field.key}>
                                    <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                                    <Input type={field.type} value={(vitalsForm as any)[field.key]} onChange={(e) => setVitalsForm({ ...vitalsForm, [field.key]: e.target.value })} placeholder={field.placeholder} className={cn("mt-1 h-8 text-xs font-mono", vitalsErrors[field.key] && "border-red-400 focus-visible:ring-red-400")} disabled={isReadOnly || !canWriteConsultation} />
                                    {vitalsErrors[field.key] ? (
                                      <p className="text-[10px] text-red-500 mt-0.5">{vitalsErrors[field.key]}</p>
                                    ) : field.hint ? (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{field.hint}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              {/* Triage Priority Override */}
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Triage Priority (Override)</Label>
                                <Select value={triageOverride || selectedVisit?.triagePriority || ''} onValueChange={setTriageOverride} disabled={isReadOnly || !canWriteConsultation}>
                                  <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue placeholder="Set priority" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="esi_1_emergency">ESI 1 - Emergency</SelectItem>
                                    <SelectItem value="esi_2_urgent">ESI 2 - Urgent</SelectItem>
                                    <SelectItem value="esi_3_urgent">ESI 3 - Urgent</SelectItem>
                                    <SelectItem value="esi_4_less_urgent">ESI 4 - Less Urgent</SelectItem>
                                    <SelectItem value="esi_5_non_urgent">ESI 5 - Non Urgent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Label className="text-[11px] text-muted-foreground font-semibold">Doctor Triage Notes</Label>
                              <Textarea
                                value={doctorTriageNotes}
                                onChange={(e) => setDoctorTriageNotes(e.target.value)}
                                placeholder="Doctor's triage addendum or override rationale..."
                                rows={2}
                                className="resize-y text-sm"
                                disabled={isReadOnly || !canWriteConsultation}
                              />
                              <Label className="text-[11px] text-muted-foreground font-semibold">Exam Notes</Label>
                              <Textarea value={soapForm.objective} onChange={(e) => setSoapForm({...soapForm, objective: e.target.value})} placeholder="Physical exam findings, vitals, observations..." rows={3} className="resize-y text-sm" disabled={isReadOnly || !canWriteConsultation} />
                            </div>
                        </div>

                        {/* Assessment & Plan Card */}
                        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-primary">fact_check</span> Assessment & Plan
                            </h3>
                          </div>
                          <div className="p-4 flex flex-col gap-3">
                            <Label className="text-[11px] text-muted-foreground font-semibold">Diagnosis</Label>
                            <Input value={soapForm.diagnosis} onChange={(e) => setSoapForm({...soapForm, diagnosis: e.target.value})} placeholder="Primary diagnosis" className="h-8 text-sm" disabled={isReadOnly || !canWriteConsultation} />
                            <Label className="text-[11px] text-muted-foreground font-semibold">Clinical Assessment</Label>
                            <Textarea value={soapForm.assessment} onChange={(e) => setSoapForm({...soapForm, assessment: e.target.value})} placeholder="Clinical impression, differential diagnosis..." rows={3} className="resize-y text-sm" disabled={isReadOnly || !canWriteConsultation} />
                            <Label className="text-[11px] text-muted-foreground font-semibold">Treatment Plan Notes</Label>
                            <Textarea value={soapForm.plan} onChange={(e) => setSoapForm({...soapForm, plan: e.target.value})} placeholder="Treatment plan, medications, follow-up..." rows={3} className="resize-y text-sm" disabled={isReadOnly || !canWriteConsultation} />
                            {selectedVisit?.roomType === 'emergency' && (
                              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-semibold text-red-700 dark:text-red-300">Emergency - {selectedVisit.room || 'Treatment Room'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Treatment Plans */}
                        <DoctorTreatmentPlanCard
                          visitId={selectedVisit?._id || selectedVisit?.id}
                          patientId={!selectedVisit ? contextPatient?._id : undefined}
                          patientName={!selectedVisit ? [contextPatient?.firstName, contextPatient?.lastName].filter(Boolean).join(' ').trim() : undefined}
                          canEdit={true}
                        />

                        {/* Compact Action Buttons Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); }}>
                            <FlaskConical className="w-3.5 h-3.5" /> Order Labs
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => { setEditingPrescription(null); setPrescriptionItems([]); setPrescriptionModalOpen(true); }}>
                            <Pill className="w-3.5 h-3.5" /> Prescribe
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setTreatmentPlanOpen(true)}>
                            <ClipboardList className="w-3.5 h-3.5" /> Treatment Plan
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setReferralOpen(true)} disabled={!selectedVisit}>
                            <Send className="w-3.5 h-3.5" /> Refer
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setAdmitOpen(true)} disabled={!selectedVisit}>
                            <BedDouble className="w-3.5 h-3.5" /> Admit
                          </Button>
                        </div>

                        {/* Pending Orders Inline */}
                        {(currentVisitOrders.length > 0 || currentVisitPrescriptions.length > 0) && (
                          <div className="border border-border border-dashed rounded-lg p-3 bg-muted/20">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Pending Orders</p>
                            <div className="space-y-1.5">
                              {currentVisitOrders.map((order: any) => (
                                <div key={order._id || order.id} className="flex items-center justify-between gap-3 p-2 bg-white border border-border rounded min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FlaskConical className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-xs font-medium truncate">{(order.order_tests || order.tests || []).map((t: any) => t.testName || t.testCode).join(', ')}</span>
                                  </div>
                                  <Badge variant={(order.paymentStatus || order.payment_status) === 'paid' ? 'default' : 'outline'} className="text-[9px] shrink-0">{(order.paymentStatus || order.payment_status || 'pending')}</Badge>
                                </div>
                              ))}
                              {currentVisitPrescriptions.map((rx: any) => (
                                <div key={rx._id} className="flex items-center justify-between gap-3 p-2 bg-white border border-border rounded min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Pill className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-xs font-medium truncate">{(rx.items || []).map((i: any) => `${i.medicationName} ${i.dosage || ''}`).join(', ')}</span>
                                  </div>
                                  <Badge variant={rx.isPaid ? 'default' : 'secondary'} className="text-[9px] shrink-0">{rx.isPaid ? 'Paid' : 'Pending'}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Lab Results Tab */}
                    <TabsContent value="lab-results" className="p-6 mt-0">
                      {selectedVisit ? (
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <FlaskConical className="w-4 h-4 text-green-600" />
                              Lab Results — {patientDisplayName(selectedVisit)}
                            </h3>
                            {sortedLabResults.length > 0 && (
                              <span className="text-xs text-muted-foreground">{sortedLabResults.length} result{sortedLabResults.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                          {sortedLabResults.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">No lab results yet for this visit.</p>
                              <p className="text-xs mt-1">Results will appear here once the lab releases them.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {sortedLabResults.map((result: LabResult) => (
                                <div key={result._id} className={cn('rounded-lg border p-3 flex items-center justify-between', getFlagColor(result.flag))}>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium truncate">{result.testName}</p>
                                      <span className="text-[10px] text-muted-foreground font-mono">{result.testCode}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <span className="text-lg font-bold">{result.value}{result.unit ? ` ${result.unit}` : ''}</span>
                                      {(result.referenceRange || result.reference_range) && (
                                        <span className="text-[10px] text-muted-foreground">Ref: {result.referenceRange || result.reference_range}</span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className={cn('text-[10px] capitalize shrink-0 ml-2', getFlagColor(result.flag))}>
                                    {getFlagLabel(result.flag)}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground text-sm">Select a patient to view lab results</div>
                      )}
                    </TabsContent>

                    {/* Timeline Tab */}
                    <TabsContent value="timeline" className="p-0 mt-0">
                      {patientId ? (
                        <PatientTimeline
                          patientId={patientId}
                          patientChart={patientChart}
                          patientVisits={patientVisits}
                          patientOrders={currentVisitOrders}
                          patientPrescriptions={currentVisitPrescriptions}
                          chartLoading={chartLoading}
                        />
                      ) : (
                        <div className="text-center py-12 text-muted-foreground text-sm">Select a patient to view timeline</div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Sticky Action Bar */}
                  <div className="sticky bottom-0 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 md:px-6 py-3 rounded-b-xl shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
                    {closureBlockers.length > 0 && (
                      <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
                        {closureBlockers.length === 1 ? closureBlockers[0] : `${closureBlockers.length} blocker(s) before closing`}
                      </div>
                    )}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {selectedVisit ? (
                          <>
                            <span className="font-medium text-foreground">{statusLabel(selectedVisit.status)}</span>
                            {selectedVisit.room && <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Room: {selectedVisit.room}</span>}
                            {isDirty && !isReadOnly && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">Unsaved</span>}
                          </>
                        ) : (
                          <span className="font-medium text-amber-700">View-only patient chart</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" className="rounded-full" onClick={handleSaveVitalsAndSOAP} disabled={updateVisit.isPending || isReadOnly || !canWriteConsultation}>
                          {updateVisit.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                          {isDirty ? 'Save (Ctrl+S)' : 'Save'}
                        </Button>
                        <Button size="sm" className="rounded-full bg-[#0d9488] hover:bg-[#0f766e] text-white" onClick={() => setConfirmCompleteOpen(true)} disabled={completeVisit.isPending || !canCloseEncounter || isReadOnly || !canWriteConsultation} title={!canCloseEncounter ? closureBlockers.join(' ') : undefined}>
                          {completeVisit.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                          Complete & Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Dashboard Home View */
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
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editingPrescription ? 'Edit Prescription' : 'Prescribe Medication'}</DialogTitle>
          </DialogHeader>
          {contextPatient?.allergies?.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-800">Allergy alert</p>
                <p className="text-[11px] text-red-700">Patient allergies: <span className="font-medium">{contextPatient.allergies.join(', ')}</span>. Verify each medication before prescribing.</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Search Medications</Label>
              <Input value={searchMedication} onChange={(e) => setSearchMedication(e.target.value)} placeholder="Search to filter medications..." className="mt-1" />
              <ScrollArea className="h-80 mt-2 border rounded-lg">
                {filteredMedications.map((med: Medication) => (
                  <div key={med._id} className={cn("p-3 border-b last:border-b-0 flex items-center justify-between", (med.stockQuantity || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed bg-muted/20")} onClick={() => (med.stockQuantity || 0) > 0 && addMedicationToPrescription(med)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{med.name}</p>
                        {med.__cafProduct && <Badge variant="outline" className="text-[10px] flex-shrink-0">CAF</Badge>}
                      </div>
                      {med.genericName && <p className="text-xs text-muted-foreground truncate">{med.genericName}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {med.dosageForm && <span>{med.dosageForm}</span>}
                        {med.unit && <span>| {med.unit}</span>}
                        {med.category && <span>| {med.category}</span>}
                        <span className="font-medium text-foreground">Le {(med.unitPrice || 0).toLocaleString()}</span>
                      </div>
                      {med.packSizes && med.packSizes.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Packs: {med.packSizes.map((ps) => `${ps.name} (${ps.unitsPerPack ?? ps.quantityPerPack} ${med.baseUnit || ps.unit}) @ Le ${(ps.sellingPrice || 0).toLocaleString()}`).join(' • ')}</p>
                      )}
                      <p className={cn("text-xs mt-0.5", (med.stockQuantity || 0) > 0 ? "text-emerald-600" : "text-red-600")}>{(med.stockQuantity || 0) > 0 ? `${med.stockQuantity} in stock` : 'Out of stock'}</p>
                    </div>
                    {(med.stockQuantity || 0) > 0 ? <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <Badge variant="destructive" className="flex-shrink-0">No stock</Badge>}
                  </div>
                ))}
              </ScrollArea>
            </div>
            <div>
              <Label className="text-sm font-medium">Prescription Items ({prescriptionItems.length})</Label>
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {prescriptionItems.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Click medications to add them</div>
                ) : (
                  <div className="divide-y">
                    {prescriptionItems.map((item, index) => {
                      // Compute quantity preview from structured fields
                      const unitsPerDose = (() => {
                        const s = (item.strengthPerDose || '').trim().toLowerCase();
                        const m = s.match(/^(\d+(?:\.\d+)?)/);
                        if (!m) return 1;
                        const n = parseFloat(m[1]);
                        const rest = s.slice(m[0].length).trim();
                        const countUnits = ['tablet', 'tablets', 'capsule', 'capsules', 'ampule', 'ampules', 'vial', 'vials', 'patch', 'patches', 'drop', 'drops', 'puff', 'puffs', 'sachet', 'sachets', 'ml'];
                        return countUnits.some((u) => rest.startsWith(u)) ? n : 1;
                      })();
                      const computedQty = unitsPerDose * (item.dosesPerDay || 0) * (item.durationDays || 0);
                      const qtyText = `${computedQty} ${item.baseUnit || 'unit'}`;
                      return (
                        <div key={index} className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">{item.medicationName}</p>
                              {item.sellMode && item.sellMode !== 'individual' && item.packSizes && item.packSizes.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">Packs: {item.packSizes.map((ps: any) => `${ps.name} (${ps.unitsPerPack} ${item.baseUnit || 'unit'}) @ Le ${ps.sellingPrice}`).join(' • ')}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removePrescriptionItem(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Per dose</Label>
                              <Input placeholder="e.g. 500mg or 1 tablet" value={item.strengthPerDose} onChange={(e) => updatePrescriptionItem(index, 'strengthPerDose', e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Doses/day</Label>
                              <Input type="number" min={1} value={item.dosesPerDay} onChange={(e) => updatePrescriptionItem(index, 'dosesPerDay', parseInt(e.target.value) || 1)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Days</Label>
                              <Input type="number" min={1} value={item.durationDays} onChange={(e) => updatePrescriptionItem(index, 'durationDays', parseInt(e.target.value) || 1)} className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded mb-2">
                            Computed quantity: <strong>{qtyText}</strong>
                            {item.unitPrice ? <> · Est. line: Le {(computedQty * item.unitPrice).toLocaleString()}</> : null}
                          </div>
                          <Input placeholder="Patient instructions — leave blank to auto-generate" value={item.instructions} onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)} className="h-8 text-xs" />
                          <Input placeholder="Pharmacist note (internal only, not on label)" value={item.pharmacistNote || ''} onChange={(e) => updatePrescriptionItem(index, 'pharmacistNote', e.target.value)} className="h-8 text-xs mt-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {prescriptionItems.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    Total (estimated): Le {prescriptionItems.reduce((sum, item) => {
                      const unitsPerDose = (() => {
                        const s = (item.strengthPerDose || '').trim().toLowerCase();
                        const m = s.match(/^(\d+(?:\.\d+)?)/);
                        if (!m) return 1;
                        const n = parseFloat(m[1]);
                        const rest = s.slice(m[0].length).trim();
                        const countUnits = ['tablet', 'tablets', 'capsule', 'capsules', 'ampule', 'ampules', 'vial', 'vials'];
                        return countUnits.some((u) => rest.startsWith(u)) ? n : 1;
                      })();
                      const q = unitsPerDose * (item.dosesPerDay || 0) * (item.durationDays || 0);
                      return sum + (q * (item.unitPrice || 0));
                    }, 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Final bill is set at reception dispense based on actual pack / individual selection.</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button onClick={() => editingPrescription ? updatePrescription.mutate() : createPrescription.mutate()} disabled={(editingPrescription ? updatePrescription.isPending : createPrescription.isPending) || prescriptionItems.length === 0 || prescriptionItems.some(i => !i.strengthPerDose || !i.dosesPerDay || !i.durationDays)}>
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
