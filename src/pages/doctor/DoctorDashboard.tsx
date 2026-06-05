import { useState, useEffect, useMemo } from 'react';
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
import { AllergyManager } from '@/components/doctor/AllergyManager';
import { ProblemList } from '@/components/doctor/ProblemList';
import { VitalsTrends } from '@/components/doctor/VitalsTrends';
import { FollowUpScheduler } from '@/components/doctor/FollowUpScheduler';

// Icons
import {
  Loader2, CheckCircle, User, FileText, FlaskConical, Pill,
  ChevronDown, AlertTriangle, Search, Plus, Trash2, Save,
  Send, Heart, ClipboardList, UserCheck, BedDouble, ExternalLink, Activity,
  Pencil, AlertCircle, TestTube
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
  const [activeTab, setActiveTab] = useState('soap');
  const [historyTab, setHistoryTab] = useState('visits');
  const [queueSectionsOpen, setQueueSectionsOpen] = useState({
    waiting: true,
    active: true,
    results: true,
    referrals: true,
  });

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
  const doctorPatientsQuery = useDoctorPatients({
    page: allPatientsPage,
    limit: 25,
    search: allPatientsSearch,
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

  // Edit mode state
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editingPrescription, setEditingPrescription] = useState<any>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
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
  const patientId = selectedVisit?.patientId?._id || selectedVisit?.patientId || '';
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
  const selectedPatient = selectedVisit?.patientId || {};
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
      setActiveTab(selectedVisit.status === 'results_ready' ? 'lab-results' : 'soap');
    }
  }, [selectedVisit?._id]);

  // Handlers
  const handleAcceptPatient = async (visit: Visit) => {
    try {
      const acceptedVisit = await acceptPatient.mutateAsync(visit._id || visit.id || '');
      setSelectedVisit((acceptedVisit as Visit) || visit);
      setActiveTab('soap');
      toast.success(`Accepted patient: ${visit.patientId?.firstName} ${visit.patientId?.lastName}`);
    } catch (error) {
      toast.error('Failed to accept patient');
    }
  };

  const handleSaveVitalsAndSOAP = async () => {
    if (!selectedVisit) return;

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
        },
      });
      queryClient.invalidateQueries({ queryKey: ['patient-chart', selectedVisit.patientId?._id || selectedVisit.patientId] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      toast.success('Notes saved');
    } catch (error) {
      toast.error('Failed to save notes');
    }
  };

  const handleCompleteVisit = async () => {
    if (!selectedVisit) return;

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
      setSelectedVisit(null);
    } catch (error) {
      toast.error('Failed to complete visit');
    }
  };

  const handleCompleteAndNext = async () => {
    if (!selectedVisit) return;
    await handleCompleteVisit();
    const nextInQueue = waitingQueue.find((v: Visit) => v.status === 'in_queue');
    if (nextInQueue) {
      await handleAcceptPatient(nextInQueue);
    }
  };

  // Lab order creation
  const createLabOrder = useMutation({
    mutationFn: async () => {
      if (!selectedVisit || selectedTests.length === 0) return;

      // doctorId on an order is the *referring* doctor (external), not the treating doctor.
      // The treating doctor is captured via orderedBy from the JWT on the backend.
      // Passing profile.id here would fail because it's a Profile ID, not a Doctor document ID.
      const orderData = {
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        orderType: 'lab',
        tests: selectedTests.map(t => ({
          testId: t._id,
          testCode: t.code,
          testName: t.name,
          price: t.price,
        })),
        priority: 'routine',
      };

      return await ordersAPI.create(orderData);
    },
    onSuccess: () => {
      toast.success('Lab order created. Patient should pay at reception.');
      setLabOrderModalOpen(false);
      setSelectedTests([]);
      setEditingOrder(null);
      setSelectedVisit(prev => prev ? { ...prev, status: 'awaiting_lab' } : prev);
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
      if (!selectedVisit || prescriptionItems.length === 0) return;

      return await prescriptionService.create({
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        items: prescriptionItems.map(({ unitPrice, ...item }) => ({
          ...item,
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        totalAmount: prescriptionItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0),
      });
    },
    onSuccess: () => {
      toast.success('Prescription created. Patient should pay at reception.');
      setPrescriptionModalOpen(false);
      setPrescriptionItems([]);
      setEditingPrescription(null);
      setSelectedVisit(prev => prev ? { ...prev, status: 'awaiting_pharmacy' } : prev);
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
        totalAmount: prescriptionItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0),
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
    const allergies: string[] = selectedVisit?.patientId?.allergies || [];
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
      const proceed = window.confirm(`ALLERGY ALERT: Patient is allergic to "${matchedAllergy}". "${med.name}" may contain or relate to this allergen. Prescribe anyway?`);
      if (!proceed) return;
    }
    setPrescriptionItems([
      ...prescriptionItems,
      {
        medicationId: med._id,
        medicationName: med.name,
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        route: 'oral',
        unitPrice: med.unitPrice || 0,
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
  const openEncounterCount = activePatients.length;

  // Global search across all visit queues
  const searchHits = useMemo(() => {
    if (globalSearch.trim().length < 2) return [];
    const q = globalSearch.trim().toLowerCase();
    const allVisits = [...waitingQueue, ...activePatients, ...resultsReady, ...awaitingLabPayment, ...awaitingResults, ...awaitingPharmacy, ...awaitingDispensing];
    const seen = new Set<string>();
    return allVisits.filter((v) => {
      if (seen.has(v._id)) return false;
      seen.add(v._id);
      const name = patientDisplayName(v).toLowerCase();
      const id = (v.visitNumber || '').toLowerCase();
      const patientIdStr = (v.patientId?.patientId || '').toLowerCase();
      return name.includes(q) || id.includes(q) || patientIdStr.includes(q);
    });
  }, [globalSearch, waitingQueue, activePatients, resultsReady, awaitingLabPayment, awaitingResults, awaitingPharmacy, awaitingDispensing]);

  // Get the active visit for the doctor (if any)
  const currentActiveVisit = activePatients.find((v: Visit) => v.status === 'in_consultation') || activePatients[0];
  const canContinueClinicalWork = !!selectedVisit && ['in_consultation', 'results_ready', 'awaiting_doctor_review'].includes(selectedVisit.status);
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
  const toggleQueueSection = (section: keyof typeof queueSectionsOpen) => {
    setQueueSectionsOpen((current) => ({ ...current, [section]: !current[section] }));
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-border z-50 flex items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/harbour-emr-logo.svg" alt="Harbour EMR Logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-primary text-lg">Harbour EMR</span>
          </div>
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
            {[
              { label: 'Consult', value: 'soap' },
              { label: 'History', value: 'history' },
              { label: 'Labs', value: 'lab-results' },
              { label: 'Rx', value: 'orders' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  activeTab === tab.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && searchHits.length > 0) { setSelectedVisit(searchHits[0]); setActiveTab('soap'); setGlobalSearch(''); setSearchOpen(false); } }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              placeholder="Search patients…"
              className="h-8 w-48 pl-8 pr-3 rounded-full border border-border bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchOpen && globalSearch.trim().length >= 2 && (
              <div className="absolute top-9 right-0 w-72 max-h-80 overflow-y-auto bg-white border border-border rounded-lg shadow-lg z-50">
                {searchHits.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No matches</p>
                ) : (
                  searchHits.slice(0, 8).map((v) => (
                    <button
                      key={v._id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-muted/40 border-b last:border-b-0"
                      onMouseDown={() => { setSelectedVisit(v); setActiveTab('soap'); setGlobalSearch(''); setSearchOpen(false); }}
                    >
                      <p className="text-xs font-medium truncate">{patientDisplayName(v)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{v.visitNumber} - {statusLabel(v.status)}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { if (resultsReady.length > 0) { setSelectedVisit(resultsReady[0]); setActiveTab('lab-results'); } }}
            disabled={resultsReady.length === 0}
            className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
            title="Results ready"
          >
            <Activity className="w-4 h-4 text-muted-foreground" />
            {resultsReady.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center px-1">{resultsReady.length}</span>
            )}
          </button>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{profile?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium hidden lg:block truncate max-w-40">{profile?.fullName}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-14 h-full">
        {/* Sidebar */}
        <nav className="fixed left-0 top-14 bottom-0 w-64 z-40 bg-[#fafbfc] border-r border-border hidden md:flex flex-col">
          <div className="p-4 border-b border-border">
            <p className="text-sm font-semibold leading-tight">Doctor Workbench</p>
            <p className="text-[10px] text-muted-foreground truncate">{profile?.fullName || 'Harbour EMR'}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className={CLINICAL_LABEL}>Roster</p>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border bg-white overflow-hidden">
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
                    onClick={() => toggleQueueSection('waiting')}
                  >
                    <span className="text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-amber-500">schedule</span>
                      Waiting
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="h-5 text-[10px]">{waitingQueue.length}</Badge>
                      <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !queueSectionsOpen.waiting && "-rotate-90")} />
                    </span>
                  </button>
                  {queueSectionsOpen.waiting && (
                    <div className="border-t">
                      {waitingQueue.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-3">No waiting patients</p>
                      ) : (
                        waitingQueue.map((visit: Visit) => {
                          const isSelected = selectedVisit?._id === visit._id;
                          return (
                            <div
                              key={visit._id}
                              onClick={() => setSelectedVisit(visit)}
                              className={cn(
                                "p-2.5 cursor-pointer transition-colors border-l-2 border-b last:border-b-0",
                                isSelected ? "bg-primary/10 border-l-primary" : "hover:bg-muted/50 border-l-amber-500"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs font-medium truncate">{patientDisplayName(visit)}</p>
                                    {visit.triageAlert && (
                                      <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" aria-label="Nurse triage alert" />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground truncate">{visit.visitNumber}</p>
                                  {visit.triageAlerts && visit.triageAlerts.length > 0 && (
                                    <p className="text-[10px] text-red-600 truncate font-medium mt-0.5">
                                      {visit.triageAlerts[0]}{visit.triageAlerts.length > 1 ? ` +${visit.triageAlerts.length - 1}` : ''}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 rounded-full text-[11px] px-3 shrink-0 gap-1 font-semibold"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleAcceptPatient(visit);
                                  }}
                                  disabled={acceptPatient.isPending}
                                >
                                  {acceptPatient.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <UserCheck className="h-3 w-3" />
                                  )}
                                  Accept
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-white overflow-hidden">
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
                    onClick={() => toggleQueueSection('active')}
                  >
                    <span className="text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-primary">stethoscope</span>
                      Patients I'm Seeing
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="h-5 text-[10px]">{activePatients.length}</Badge>
                      <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !queueSectionsOpen.active && "-rotate-90")} />
                    </span>
                  </button>
                  {queueSectionsOpen.active && (
                    <div className="border-t">
                      {activePatients.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-3">No active encounters</p>
                      ) : (
                        activePatients.map((visit: Visit) => (
                          <div key={visit._id} onClick={() => { setSelectedVisit(visit); if (visit.status === 'results_ready') setActiveTab('lab-results'); }} className={cn("p-2.5 cursor-pointer transition-colors border-l-2 border-b last:border-b-0", selectedVisit?._id === visit._id ? "bg-primary/10 border-l-primary" : "hover:bg-muted/50 border-l-primary")}>
                            <p className="text-xs font-medium truncate">{patientDisplayName(visit)}</p>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className="text-[10px] text-muted-foreground truncate">{visit.visitNumber}</p>
                              <Badge variant="outline" className="text-[9px] capitalize shrink-0">{statusLabel(visit.status)}</Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-white overflow-hidden">
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
                    onClick={() => toggleQueueSection('results')}
                  >
                    <span className="text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-emerald-600">science</span>
                      Results Ready
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="h-5 text-[10px]">{resultsReady.length}</Badge>
                      <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !queueSectionsOpen.results && "-rotate-90")} />
                    </span>
                  </button>
                  {queueSectionsOpen.results && (
                    <div className="border-t">
                      {resultsReady.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-3">No results pending</p>
                      ) : (
                        resultsReady.map((visit: Visit) => (
                          <div key={visit._id} onClick={() => { setSelectedVisit(visit); setActiveTab('lab-results'); }} className={cn("p-2.5 cursor-pointer transition-colors border-l-2 border-b last:border-b-0", selectedVisit?._id === visit._id ? "bg-primary/10 border-l-primary" : "hover:bg-muted/50 border-l-emerald-500")}>
                            <p className="text-xs font-medium truncate">{patientDisplayName(visit)}</p>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className="text-[10px] text-muted-foreground truncate">{visit.visitNumber}</p>
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] shrink-0">Review</Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setAllPatientsOpen(true); setAllPatientsPage(1); setAllPatientsSearch(''); }}
                className="mt-3 w-full px-3 py-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-xs font-medium text-primary flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                All My Patients
              </button>
            </div>
          </div>
          <div className="p-3 border-t border-border space-y-1">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
              <span className="material-symbols-outlined text-[18px]">help</span>Support
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">
              <span className="material-symbols-outlined text-[18px]">logout</span>Logout
            </button>
          </div>
        </nav>

        {/* Main Workspace */}
        <main className="md:ml-64 flex-1 h-[calc(100vh-56px)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto flex flex-col xl:flex-row gap-6 p-4 md:p-6">
            {/* Left Editor Area */}
            <div className="flex-1 flex flex-col gap-5 min-w-0">
              {selectedVisit ? (
                <>
                  {/* Patient Context Strip */}
                  <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {selectedVisit.patientId?.firstName?.[0]}{selectedVisit.patientId?.lastName?.[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold">{patientDisplayName(selectedVisit)}</h2>
                        <p className="text-[11px] text-muted-foreground font-mono">{selectedVisit.patientId?.patientId || 'N/A'}</p>
                      </div>
                      <div className="hidden sm:block h-8 w-px bg-border mx-1" />
                      <span className="text-xs text-muted-foreground">{patientAgeLabel(selectedVisit.patientId)} · {selectedVisit.patientId?.gender || 'N/A'}</span>
                      <div className="hidden sm:block h-8 w-px bg-border mx-1" />
                      <div className="flex items-center gap-1.5">
                        {selectedVisit.triagePriority && (
                          <span className={cn("w-2 h-2 rounded-full", selectedVisit.triagePriority.includes('emergency') || selectedVisit.triagePriority.includes('urgent') ? "bg-red-500" : "bg-amber-500")} />
                        )}
                        <span className="text-[11px] text-muted-foreground">{selectedVisit.triagePriority ? statusLabel(selectedVisit.triagePriority) : 'Triage'}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate max-w-full md:max-w-[180px]">{chiefComplaintForm || selectedVisit.chiefComplaint || 'No complaint'}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {selectedVisit.patientId?.allergies?.length > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium border border-red-200">
                            {selectedVisit.patientId.allergies.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">NKDA</span>
                        )}
                        {selectedVisit.patientId?.chronicConditions?.slice(0, 2).map((c: string) => (
                          <span key={c} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
                            {c}
                          </span>
                        ))}
                        {selectedVisit.patientId?.chronicConditions?.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{selectedVisit.patientId.chronicConditions.length - 2}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground">Le {selectedWalletBalance.toLocaleString()}</span>
                      <Badge variant="outline" className="text-[10px]">{selectedVisit.visitNumber}</Badge>
                      <Badge className={cn("text-[10px]", visitStatusTone(selectedVisit.status))}>{statusLabel(selectedVisit.status)}</Badge>
                    </div>
                  </div>

                  {selectedVisit.triageAlert && selectedVisit.triageAlerts && selectedVisit.triageAlerts.length > 0 && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-red-800">Nurse Triage Alert</p>
                        <ul className="text-xs text-red-700 list-disc list-inside">
                          {selectedVisit.triageAlerts.map((alert: string, i: number) => (
                            <li key={i}>{alert}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1">
                    <div className="border-b border-border bg-white rounded-t-xl overflow-x-auto">
                      <TabsList className="bg-transparent h-auto p-0 min-w-max px-4">
                        <TabsTrigger value="soap" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">Consult</TabsTrigger>
                        <TabsTrigger value="orders" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">Orders</TabsTrigger>
                        <TabsTrigger value="lab-results" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none relative text-sm">
                          Results
                          {labResults.length > 0 && (
                            <Badge className="ml-1.5 h-4 min-w-4 text-[10px]">{labResults.length}</Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">Summary</TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none text-sm">History</TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Consult Tab — Stitch Layout */}
                    <TabsContent value="soap" className="p-6 mt-0">
                      <div className="flex flex-col gap-5">
                        {/* Triage Vitals - Auto-populated from nurse triage */}
                        {(selectedVisit.temperature || selectedVisit.bloodPressure || selectedVisit.heartRate || selectedVisit.triagePriority) && (
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
                        {selectedVisit.rapidTestResults && selectedVisit.rapidTestResults.length > 0 && (
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
                            />
                            <Label className="text-[11px] text-muted-foreground font-semibold mt-3 block">Patient History (HPI)</Label>
                            <Textarea value={soapForm.subjective} onChange={(e) => setSoapForm({...soapForm, subjective: e.target.value})} placeholder="Patient's description of symptoms, history of present illness..." rows={4} className="mt-1 resize-y text-sm" />
                          </div>
                        </div>

                        {/* Objective + Assessment — 2-column row */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
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
                                  { key: 'temperature', label: 'Temp (C)', placeholder: '36.5', type: 'number' },
                                  { key: 'bloodPressure', label: 'BP (mmHg)', placeholder: '120/80', type: 'text' },
                                  { key: 'heartRate', label: 'HR (bpm)', placeholder: '72', type: 'number' },
                                  { key: 'respiratoryRate', label: 'RR (/min)', placeholder: '16', type: 'number' },
                                  { key: 'weight', label: 'Weight (kg)', placeholder: '70', type: 'number' },
                                  { key: 'height', label: 'Height (cm)', placeholder: '170', type: 'number' },
                                  { key: 'oxygenSaturation', label: 'SpO2 (%)', placeholder: '98', type: 'number' },
                                ].map((field) => (
                                  <div key={field.key}>
                                    <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
                                    <Input type={field.type} value={(vitalsForm as any)[field.key]} onChange={(e) => setVitalsForm({ ...vitalsForm, [field.key]: e.target.value })} placeholder={field.placeholder} className="mt-1 h-8 text-xs font-mono" />
                                  </div>
                                ))}
                              </div>
                              <Label className="text-[11px] text-muted-foreground font-semibold">Exam Notes</Label>
                              <Textarea value={soapForm.objective} onChange={(e) => setSoapForm({...soapForm, objective: e.target.value})} placeholder="Physical exam findings, vitals, observations..." rows={3} className="resize-y text-sm" />
                            </div>
                          </div>

                          {/* Assessment Card */}
                          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-primary">fact_check</span> Assessment
                            </h3>
                          </div>
                            <div className="p-4 flex flex-col gap-3">
                              <Label className="text-[11px] text-muted-foreground font-semibold">Diagnosis</Label>
                              <Input value={soapForm.diagnosis} onChange={(e) => setSoapForm({...soapForm, diagnosis: e.target.value})} placeholder="Primary diagnosis" className="h-8 text-sm" />
                              <Label className="text-[11px] text-muted-foreground font-semibold">Clinical Assessment</Label>
                              <Textarea value={soapForm.assessment} onChange={(e) => setSoapForm({...soapForm, assessment: e.target.value})} placeholder="Clinical impression, differential diagnosis..." rows={4} className="resize-y text-sm" />
                            </div>
                          </div>
                        </div>

                        {/* Plan Card */}
                        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                          <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-primary">assignment_turned_in</span> Plan
                            </h3>
                            <Button size="sm" className="rounded-full h-7 text-xs gap-1" onClick={handleSaveVitalsAndSOAP} disabled={updateVisit.isPending}>
                              <Save className="w-3 h-3" /> Save
                            </Button>
                          </div>
                          <div className="p-4 flex flex-col gap-4">
                            {/* Action Buttons Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <Button variant="outline" className="h-11 justify-center gap-2" onClick={() => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); }} disabled={!canContinueClinicalWork}>
                                <span className="material-symbols-outlined text-primary text-[18px]">science</span> Order Labs
                              </Button>
                              <Button variant="outline" className="h-11 justify-center gap-2" onClick={() => { setEditingPrescription(null); setPrescriptionItems([]); setPrescriptionModalOpen(true); }} disabled={!canContinueClinicalWork}>
                                <span className="material-symbols-outlined text-primary text-[18px]">prescriptions</span> Prescribe
                              </Button>
                              <Button variant="outline" className="h-11 justify-center gap-2" onClick={() => setReferralOpen(true)} disabled={!canContinueClinicalWork}>
                                <span className="material-symbols-outlined text-primary text-[18px]">forward</span> Refer
                              </Button>
                              <Button variant="outline" className="h-11 justify-center gap-2" onClick={() => setAdmitOpen(true)} disabled={!canContinueClinicalWork}>
                                <span className="material-symbols-outlined text-primary text-[18px]">bed</span> Admit
                              </Button>
                            </div>
                            {/* Pending Orders */}
                            {(currentVisitOrders.length > 0 || currentVisitPrescriptions.length > 0) && (
                              <div className="border border-border border-dashed rounded-lg p-3 bg-muted/20">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Pending Orders for Visit</p>
                                {currentVisitOrders.map((order: any) => (
                                  <div key={order._id || order.id} className="flex items-center justify-between gap-3 p-2 bg-white border border-border rounded mb-1.5 last:mb-0 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="material-symbols-outlined text-primary text-[16px]">science</span>
                                      <span className="text-xs font-medium truncate">{(order.order_tests || order.tests || []).map((t: any) => t.testName || t.testCode).join(', ')}</span>
                                    </div>
                                    <Badge variant={(order.paymentStatus || order.payment_status) === 'paid' ? 'default' : 'outline'} className="text-[9px] shrink-0">{(order.paymentStatus || order.payment_status || 'pending')}</Badge>
                                  </div>
                                ))}
                                {currentVisitPrescriptions.map((rx: any) => (
                                  <div key={rx._id} className="flex items-center justify-between gap-3 p-2 bg-white border border-border rounded mb-1.5 last:mb-0 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="material-symbols-outlined text-primary text-[16px]">medication</span>
                                      <span className="text-xs font-medium truncate">{(rx.items || []).map((i: any) => `${i.medicationName} ${i.dosage}`).join(', ')}</span>
                                    </div>
                                    <Badge variant={rx.isPaid ? 'default' : 'secondary'} className="text-[9px] shrink-0">{rx.isPaid ? 'Paid' : 'Pending'}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Label className="text-[11px] text-muted-foreground font-semibold">Treatment Plan Notes</Label>
                            <Textarea value={soapForm.plan} onChange={(e) => setSoapForm({...soapForm, plan: e.target.value})} placeholder="Treatment plan, medications, follow-up..." rows={3} className="resize-y text-sm" />
                            {selectedVisit.roomType === 'emergency' && (
                              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-semibold text-red-700 dark:text-red-300">Emergency - {selectedVisit.room || 'Treatment Room'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Orders Tab */}
                    <TabsContent value="orders" className="p-5 md:p-6 mt-0">
                      {closureBlockers.length > 0 && (
                        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                          <p className="text-xs font-semibold text-amber-800">Before closing</p>
                          <ul className="mt-1 text-xs text-amber-700 space-y-1">
                            {closureBlockers.map((blocker) => (
                              <li key={blocker}>- {blocker}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {currentVisitOrders.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Existing Orders</h4>
                          <div className="space-y-2">
                            {currentVisitOrders.map((order: any) => {
                              const orderTests = order.order_tests || order.tests || [];
                              const orderType = order.orderType || order.order_type;
                              const canEdit = (order.paymentStatus || order.payment_status) === 'pending' && (order.status === 'awaiting_payment');
                              return (
                                <div key={order._id || order.id} className="clinical-panel p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold">{order.orderNumber}</p>
                                        <Badge variant="outline" className="capitalize text-[10px]">{orderType}</Badge>
                                        <Badge variant={(order.status === 'completed') ? 'default' : (order.status === 'cancelled') ? 'destructive' : 'secondary'} className="text-[10px] capitalize">{(order.status || '').replace(/_/g, ' ')}</Badge>
                                        <Badge variant={(order.paymentStatus || order.payment_status) === 'paid' ? 'default' : 'outline'} className="text-[10px]">{(order.paymentStatus || order.payment_status || 'pending').replace(/_/g, ' ')}</Badge>
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        {orderTests.map((test: any, idx: number) => (
                                          <p key={idx} className="text-xs text-muted-foreground">
                                            {test.testName || test.test_name || test.testCode || test.test_code}
                                            {test.panelName || test.panel_name ? ` (${test.panelName || test.panel_name})` : ''}
                                            {test.price ? ` - Le ${test.price.toLocaleString()}` : ''}
                                          </p>
                                        ))}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">Total: Le {(order.total || 0).toLocaleString()} | Priority: {order.priority || 'routine'}</p>
                                    </div>
                                    {canEdit && orderType === 'lab' && (
                                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => startEditOrder(order)} disabled={!canContinueClinicalWork}>
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {currentVisitPrescriptions.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Existing Prescriptions</h4>
                          <div className="space-y-2">
                            {currentVisitPrescriptions.map((rx: any) => {
                              const canEdit = !rx.isPaid && rx.status === 'pending';
                              return (
                                <div key={rx._id} className="clinical-panel p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold">{rx.prescriptionNumber}</p>
                                        <Badge variant={rx.isPaid ? 'default' : 'secondary'} className="text-[10px]">{rx.isPaid ? 'Paid' : 'Awaiting payment'}</Badge>
                                        <Badge variant="outline" className="text-[10px] capitalize">{rx.status}</Badge>
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        {(rx.items || []).map((item: any, idx: number) => (
                                          <p key={idx} className="text-xs text-muted-foreground">
                                            {item.medicationName} - {item.dosage}, {item.frequency}, {item.duration}
                                            {item.quantity ? ` (Qty: ${item.quantity})` : ''}
                                          </p>
                                        ))}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1">Total: Le {(rx.totalAmount || 0).toLocaleString()}</p>
                                    </div>
                                    {canEdit && (
                                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => startEditPrescription(rx)} disabled={!canContinueClinicalWork}>
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <Button variant="outline" className="h-auto justify-start rounded-lg p-4" onClick={() => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); }} disabled={!canContinueClinicalWork}>
                          <FlaskConical className="w-5 h-5 mr-3 text-blue-500" />
                          <span className="text-left"><span className="block font-medium">Order Lab Tests</span><span className="block text-xs text-muted-foreground">Send tests to LIS.</span></span>
                        </Button>
                        <Button variant="outline" className="h-auto justify-start rounded-lg p-4" onClick={() => { setEditingPrescription(null); setPrescriptionItems([]); setPrescriptionModalOpen(true); }} disabled={!canContinueClinicalWork}>
                          <Pill className="w-5 h-5 mr-3 text-purple-500" />
                          <span className="text-left"><span className="block font-medium">Prescribe Medication</span><span className="block text-xs text-muted-foreground">Create medication order.</span></span>
                        </Button>
                        <Button variant="outline" className="h-auto justify-start rounded-lg p-4" onClick={() => setReferralOpen(true)} disabled={!canContinueClinicalWork}>
                          <UserCheck className="w-5 h-5 mr-3 text-cyan-600" />
                          <span className="text-left"><span className="block font-medium">Refer Patient</span><span className="block text-xs text-muted-foreground">Send clinical referral.</span></span>
                        </Button>
                        <Button variant="outline" className="h-auto justify-start rounded-lg p-4" onClick={() => setAdmitOpen(true)} disabled={!canContinueClinicalWork}>
                          <BedDouble className="w-5 h-5 mr-3 text-emerald-600" />
                          <span className="text-left"><span className="block font-medium">Admit Patient</span><span className="block text-xs text-muted-foreground">Start inpatient care.</span></span>
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                        {[
                          { label: 'Awaiting lab payment', value: awaitingLabPayment.length },
                          { label: 'Awaiting results', value: awaitingResults.length },
                          { label: 'Pharmacy workflow', value: awaitingPharmacy.length + awaitingDispensing.length },
                        ].map((item) => (
                          <div key={item.label} className="clinical-panel p-4">
                            <p className="clinical-label">{item.label}</p>
                            <p className="text-2xl font-semibold mt-1">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 flex justify-end">
                        <Button className="rounded-full" onClick={() => setConfirmCompleteOpen(true)} disabled={completeVisit.isPending || !canCloseEncounter} title={!canCloseEncounter ? closureBlockers.join(' ') : undefined}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Close Visit
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Lab Results Tab */}
                    <TabsContent value="lab-results" className="p-6 mt-0">
                      {labResults.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">No lab results available yet</p>
                          <p className="text-xs mt-1">Results will appear here once verified by the lab</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h3 className="font-semibold text-sm">Lab Results</h3>
                              <p className="text-xs text-muted-foreground mt-1">{labResults.length} result{labResults.length === 1 ? '' : 's'} released, {abnormalLabResults.length} flagged.</p>
                            </div>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => { const reportPath = `/lab/reports/${selectedVisit._id || selectedVisit.id}`; navigate(reportPath); }}>
                              <ExternalLink className="w-3 h-3" /> View Full Report
                            </Button>
                          </div>
                          <div className="clinical-panel overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-3 font-medium">Test</th>
                                  <th className="text-center p-3 font-medium">Result</th>
                                  <th className="text-center p-3 font-medium">Flag</th>
                                  <th className="text-center p-3 font-medium">Reference</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {labResults.map((result: LabResult) => (
                                  <tr key={result._id} className="hover:bg-muted/30">
                                    <td className="p-3">
                                      <p className="font-medium">{result.testName}</p>
                                      <p className="text-xs text-muted-foreground">{result.testCode}</p>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className="font-semibold text-lg">{result.value}</span>
                                      {result.unit && <span className="text-muted-foreground ml-1">{result.unit}</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className={cn("px-2 py-1 rounded text-xs font-medium", getFlagColor(result.flag))}>{getFlagLabel(result.flag)}</span>
                                    </td>
                                    <td className="p-3 text-center text-muted-foreground text-xs">{result.referenceRange || result.reference_range || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="p-5 mt-0">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="clinical-panel p-4">
                          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" /> Vitals</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { label: 'Temperature (C)', value: vitalsForm.temperature },
                              { label: 'Blood Pressure', value: vitalsForm.bloodPressure },
                              { label: 'Heart Rate (bpm)', value: vitalsForm.heartRate },
                              { label: 'Resp. Rate (/min)', value: vitalsForm.respiratoryRate },
                              { label: 'Weight (kg)', value: vitalsForm.weight },
                              { label: 'SpO2 (%)', value: vitalsForm.oxygenSaturation },
                            ].map((vital) => (
                              <div key={vital.label} className="p-2 rounded-lg bg-muted/50 border min-w-0">
                                <div className="clinical-label">{vital.label}</div>
                                <div className="clinical-data mt-0.5 break-words">{vital.value || '-'}</div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">Latest nursing triage vitals.</p>
                        </div>
                        <div className="clinical-panel p-4">
                          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-500" /> Chief Complaint</h3>
                          <p className="text-sm text-muted-foreground">{selectedVisit.chiefComplaint || 'Not specified'}</p>
                          {selectedVisit.notes && (
                            <>
                              <Separator className="my-3" />
                              <p className="text-sm text-muted-foreground">{selectedVisit.notes}</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-6 space-y-4">
                        <AllergyManager patientId={selectedVisit.patientId?._id || selectedVisit.patientId} allergies={selectedVisit.patientId?.allergies || []} allergyDetails={selectedVisit.patientId?.allergyDetails || []} />
                        <ProblemList visitId={selectedVisit._id || selectedVisit.id} problems={selectedVisit.problemList || []} />
                        <VitalsTrends vitalsHistory={patientChart?.vitalsHistory || []} />
                        <FollowUpScheduler visitId={selectedVisit._id || selectedVisit.id} followUpDate={selectedVisit.followUpDate} followUpNotes={selectedVisit.followUpNotes} />
                      </div>
                      <div className="clinical-panel mt-6 p-4">
                        {closureBlockers.length > 0 && (
                          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                            <p className="text-xs font-semibold text-amber-800">Cannot close encounter yet</p>
                            <ul className="mt-1 text-xs text-amber-700 space-y-1">{closureBlockers.map((blocker) => (<li key={blocker}>- {blocker}</li>))}</ul>
                          </div>
                        )}
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div><h3 className="font-semibold text-sm">Clinical actions</h3><p className="text-xs text-muted-foreground mt-1 capitalize">{statusLabel(selectedVisit.status)}</p></div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-full" onClick={() => setActiveTab('soap')}><FileText className="w-4 h-4 mr-2" /> Consult</Button>
                            <Button variant="outline" className="rounded-full" onClick={() => setActiveTab('orders')} disabled={!canContinueClinicalWork}><ClipboardList className="w-4 h-4 mr-2" /> Orders</Button>
                            <Button variant="outline" className="rounded-full" onClick={() => setActiveTab('lab-results')} disabled={labResults.length === 0}><FlaskConical className="w-4 h-4 mr-2" /> Results</Button>
                            <Button className="rounded-full" onClick={() => setConfirmCompleteOpen(true)} disabled={completeVisit.isPending || !canCloseEncounter} title={!canCloseEncounter ? closureBlockers.join(' ') : undefined}><CheckCircle className="w-4 h-4 mr-2" /> Close Visit</Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history" className="mt-0">
                      <Tabs value={historyTab} onValueChange={setHistoryTab} className="w-full">
                        <div className="px-5 py-3 border-b bg-muted/10">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div><h3 className="font-semibold text-sm">Patient History</h3><p className="text-xs text-muted-foreground mt-1">Longitudinal record for this patient. Pick a section and it opens in this workspace.</p></div>
                            {chartLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                          </div>
                          <div className="overflow-x-auto">
                            <TabsList className="bg-transparent h-auto p-0 min-w-max">
                              <TabsTrigger value="visits" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Visits</TabsTrigger>
                              <TabsTrigger value="soap" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">SOAP Notes</TabsTrigger>
                              <TabsTrigger value="labs" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Labs</TabsTrigger>
                              <TabsTrigger value="meds" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Medications</TabsTrigger>
                              <TabsTrigger value="admissions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Admissions</TabsTrigger>
                              <TabsTrigger value="vitals" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Vitals</TabsTrigger>
                            </TabsList>
                          </div>
                        </div>
                        <ScrollArea className="h-[560px]">
                          <div className="p-5">
                            <TabsContent value="visits" className="mt-0">
                              {patientVisits.length <= 1 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No previous visits found</div>
                              ) : (
                                <div className="space-y-3">
                                  {patientVisits.filter((v: Visit) => v._id !== selectedVisit._id).map((visit: Visit) => (
                                    <div key={visit._id} className="clinical-panel p-4">
                                      <div className="flex items-start justify-between gap-4">
                                        <div><p className="text-sm font-semibold">{visit.visitNumber}</p><p className="text-xs text-muted-foreground mt-1">{new Date(visit.createdAt).toLocaleDateString()} - {visit.visitType}</p></div>
                                        <Badge variant="outline" className="capitalize">{visit.status?.replace(/_/g, ' ')}</Badge>
                                      </div>
                                      {visit.chiefComplaint && <p className="text-sm mt-3"><span className="font-medium">Complaint:</span> {visit.chiefComplaint}</p>}
                                      {visit.diagnosis && <p className="text-sm mt-2"><span className="font-medium">Diagnosis:</span> {visit.diagnosis}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value="soap" className="mt-0">
                              {(patientChart?.soapNotes || []).length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No SOAP notes found</div>
                              ) : (
                                <div className="space-y-3">
                                  {patientChart.soapNotes.map((note: any) => (
                                    <div key={note._id} className="clinical-panel p-4">
                                      <div className="flex items-start justify-between gap-3 mb-3">
                                        <div><p className="text-sm font-semibold capitalize">{note.noteType?.replace(/_/g, ' ') || 'Clinical note'}</p><p className="text-xs text-muted-foreground">{note.doctorId?.fullName || note.nurseId?.fullName || 'Clinical staff'} - {new Date(note.createdAt).toLocaleDateString()}</p></div>
                                        {note.isSigned && <Badge>Signed</Badge>}
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        {note.chiefComplaint && <div><span className="font-semibold text-blue-600">S:</span> {note.chiefComplaint}</div>}
                                        {note.physicalExamination && <div><span className="font-semibold text-green-600">O:</span> {note.physicalExamination}</div>}
                                        {note.diagnosis && <div><span className="font-semibold text-purple-600">A:</span> {note.diagnosis}</div>}
                                        {note.treatmentPlan && <div><span className="font-semibold text-orange-600">P:</span> {note.treatmentPlan}</div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value="labs" className="mt-0">
                              {(patientChart?.orders || []).length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No lab history found</div>
                              ) : (
                                <div className="space-y-3">
                                  {patientChart.orders.map((order: any) => (
                                    <div key={order._id} className="clinical-panel p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div><p className="text-sm font-semibold">{order.orderNumber}</p><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p></div>
                                        <Badge variant="outline" className="capitalize">{order.status?.replace(/_/g, ' ')}</Badge>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {(order.orderTests || []).map((test: any, index: number) => {
                                          const result = order.results?.find((r: any) => r.orderTestId?.toString() === test._id?.toString());
                                          return (
                                            <div key={`${order._id}-${index}`} className="flex items-center justify-between gap-3 text-sm border-l-2 pl-3">
                                              <span>{test.testName || test.testCode}</span>
                                              {result ? <span className="font-medium">{result.value} {result.unit || ''}</span> : <span className="text-muted-foreground">Pending</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value="meds" className="mt-0">
                              {(patientChart?.prescriptions || []).length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No medication history found</div>
                              ) : (
                                <div className="space-y-3">
                                  {patientChart.prescriptions.map((prescription: any) => (
                                    <div key={prescription._id} className="clinical-panel p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div><p className="text-sm font-semibold">{prescription.prescriptionNumber}</p><p className="text-xs text-muted-foreground">{new Date(prescription.createdAt).toLocaleDateString()}</p></div>
                                        <Badge variant={prescription.isPaid ? 'default' : 'secondary'}>{prescription.isPaid ? 'Paid' : 'Awaiting payment'}</Badge>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {(prescription.items || []).map((item: any, index: number) => (
                                          <div key={`${prescription._id}-${index}`} className="text-sm border-l-2 pl-3"><span className="font-medium">{item.medicationName}</span><span className="text-muted-foreground"> - {item.dosage}, {item.frequency}, {item.duration}</span></div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value="admissions" className="mt-0">
                              {(patientChart?.admissions || []).length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No admissions found</div>
                              ) : (
                                <div className="space-y-3">
                                  {patientChart.admissions.map((admission: any) => (
                                    <div key={admission._id} className="clinical-panel p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div><p className="text-sm font-semibold">{admission.admissionNumber}</p><p className="text-xs text-muted-foreground">{admission.wardType}{admission.bedNumber ? ` - ${admission.bedNumber}` : ''} - {new Date(admission.createdAt).toLocaleDateString()}</p></div>
                                        <Badge className="capitalize">{admission.status}</Badge>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
                                        <div><span className="font-medium">Reason:</span> {admission.admissionReason || 'N/A'}</div>
                                        <div><span className="font-medium">Diagnosis:</span> {admission.diagnosis || admission.dischargeDiagnosis || 'N/A'}</div>
                                        <div><span className="font-medium">MAR entries:</span> {admission.medicationLog?.length || 0}</div>
                                        <div><span className="font-medium">Nursing notes:</span> {admission.nursingNotes?.length || 0}</div>
                                      </div>
                                      {admission.dischargeInstructions && <p className="text-sm mt-3"><span className="font-medium">Discharge/follow-up:</span> {admission.dischargeInstructions}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value="vitals" className="mt-0">
                              {(patientChart?.vitalsHistory || []).length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No vitals history found</div>
                              ) : (
                                <div className="space-y-3">
                                  {patientChart.vitalsHistory.map((vital: any, index: number) => (
                                    <div key={index} className="clinical-panel p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-semibold">{new Date(vital.date).toLocaleDateString()}</p>
                                        <p className="text-xs text-muted-foreground">{vital.recordedBy?.fullName || 'Clinical staff'}</p>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                        {vital.vitalSigns?.bloodPressure && <div>BP: <span className="font-medium">{vital.vitalSigns.bloodPressure}</span></div>}
                                        {vital.vitalSigns?.temperature && <div>Temp: <span className="font-medium">{vital.vitalSigns.temperature}</span></div>}
                                        {vital.vitalSigns?.heartRate && <div>HR: <span className="font-medium">{vital.vitalSigns.heartRate}</span></div>}
                                        {vital.vitalSigns?.respiratoryRate && <div>RR: <span className="font-medium">{vital.vitalSigns.respiratoryRate}</span></div>}
                                        {vital.vitalSigns?.weight && <div>Weight: <span className="font-medium">{vital.vitalSigns.weight}</span></div>}
                                        {vital.vitalSigns?.height && <div>Height: <span className="font-medium">{vital.vitalSigns.height}</span></div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TabsContent>
                          </div>
                        </ScrollArea>
                      </Tabs>
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
                        <span className="font-medium text-foreground">{statusLabel(selectedVisit.status)}</span>
                        {selectedVisit.room && <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Room: {selectedVisit.room}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setActiveTab('soap')}>
                          <FileText className="w-3.5 h-3.5 mr-1.5" /> Notes
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setActiveTab('orders')} disabled={!canContinueClinicalWork}>
                          <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> Orders
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setActiveTab('lab-results')} disabled={labResults.length === 0}>
                          <FlaskConical className="w-3.5 h-3.5 mr-1.5" /> Results
                        </Button>
                        <div className="hidden sm:block w-px h-5 bg-border mx-1" />
                        <Button size="sm" className="rounded-full bg-[#0d9488] hover:bg-[#0f766e] text-white" onClick={() => setConfirmCompleteOpen(true)} disabled={completeVisit.isPending || !canCloseEncounter} title={!canCloseEncounter ? closureBlockers.join(' ') : undefined}>
                          {completeVisit.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
                          Complete & Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Empty State */
                <div className="flex-1 flex items-center justify-center">
                  <div className="max-w-md text-center">
                    <User className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                    <h2 className="text-xl font-semibold">No patient open</h2>
                    <p className="text-sm text-muted-foreground mt-2">Select a patient from the sidebar roster to begin consultation.</p>
                    {waitingQueue.length > 0 && (
                      <Button
                        size="lg"
                        className="mt-5 gap-2"
                        onClick={() => handleAcceptPatient(waitingQueue[0])}
                        disabled={acceptPatient.isPending}
                      >
                        {acceptPatient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        Accept next patient ({patientDisplayName(waitingQueue[0])})
                      </Button>
                    )}
                    {resultsReady.length > 0 && (
                      <Button
                        size="lg"
                        variant="outline"
                        className="mt-3 gap-2"
                        onClick={() => { setSelectedVisit(resultsReady[0]); setActiveTab('lab-results'); }}
                      >
                        <FlaskConical className="h-4 w-4" />
                        Review {resultsReady.length} result{resultsReady.length === 1 ? '' : 's'} ready
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Context Panel */}
            {selectedVisit && (
              <div className="w-[300px] hidden xl:flex flex-col gap-5 shrink-0">
                {/* Triage Alert */}
                {selectedVisit.triageAlert && selectedVisit.triageAlerts && selectedVisit.triageAlerts.length > 0 && (
                  <div className="bg-red-50 border border-red-300 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                    <h4 className={cn(CLINICAL_LABEL, "text-red-700 mb-2 flex items-center gap-1.5")}>
                      <AlertCircle className="w-3.5 h-3.5" /> Nurse Triage Alert
                    </h4>
                    <p className="text-xs text-red-800 font-semibold mb-1.5">{selectedVisit.triageAlert}</p>
                    {selectedVisit.triageAlerts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedVisit.triageAlerts.map((a: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-medium border border-red-200">
                            {a.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Drug-Allergy Quick Check */}
                {selectedVisit.patientId?.allergies?.length > 0 && (
                  <div className="bg-white border border-red-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                    <h4 className={cn(CLINICAL_LABEL, "text-red-700 mb-2 flex items-center gap-1.5")}>
                      <AlertTriangle className="w-3.5 h-3.5" /> Allergies on file
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedVisit.patientId.allergies.map((a: string) => (
                        <span key={a} className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-medium">{a}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Auto-checked when prescribing</p>
                  </div>
                )}

                {/* Chronic Conditions */}
                {selectedVisit.patientId?.chronicConditions?.length > 0 && (
                  <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                    <h4 className={cn(CLINICAL_LABEL, "text-amber-700 mb-2 flex items-center gap-1.5")}>
                      <Activity className="w-3.5 h-3.5" /> Chronic Conditions
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedVisit.patientId.chronicConditions.map((c: string) => (
                        <span key={c} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallet + Quick Stats */}
                <div className="bg-white border border-border rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                  <h4 className={cn(CLINICAL_LABEL, "mb-2")}>Visit Snapshot</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Wallet</span>
                      <span className="text-sm font-mono font-semibold">Le {selectedWalletBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Orders</span>
                      <span className="text-sm font-semibold">{currentVisitOrders.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Prescriptions</span>
                      <span className="text-sm font-semibold">{currentVisitPrescriptions.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Lab results</span>
                      <span className="text-sm font-semibold">{labResults.length}</span>
                    </div>
                    {abnormalLabResults.length > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t">
                        <span className="text-[11px] text-red-600">Abnormal flags</span>
                        <span className="text-sm font-semibold text-red-600">{abnormalLabResults.length}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Closure Status */}
                {closureBlockers.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">Cannot close yet</h4>
                    <ul className="space-y-1">
                      {closureBlockers.map((b) => (
                        <li key={b} className="text-[11px] text-amber-800 flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
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
          {selectedVisit?.patientId?.allergies?.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-800">Allergy alert</p>
                <p className="text-[11px] text-red-700">Patient allergies: <span className="font-medium">{selectedVisit.patientId.allergies.join(', ')}</span>. Verify each medication before prescribing.</p>
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
                        <p className="text-[10px] text-muted-foreground mt-0.5">Packs: {med.packSizes.map((ps) => `${ps.name} (${ps.quantityPerPack} ${ps.unit})`).join(', ')}</p>
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
                    {prescriptionItems.map((item, index) => (
                      <div key={index} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{item.medicationName}</p>
                          <Button variant="ghost" size="sm" onClick={() => removePrescriptionItem(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Dosage (e.g., 500mg)" value={item.dosage} onChange={(e) => updatePrescriptionItem(index, 'dosage', e.target.value)} className="h-8 text-xs" />
                          <Input placeholder="Frequency (e.g., 3x daily)" value={item.frequency} onChange={(e) => updatePrescriptionItem(index, 'frequency', e.target.value)} className="h-8 text-xs" />
                          <Input placeholder="Duration (e.g., 7 days)" value={item.duration} onChange={(e) => updatePrescriptionItem(index, 'duration', e.target.value)} className="h-8 text-xs" />
                          <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updatePrescriptionItem(index, 'quantity', parseInt(e.target.value) || 1)} className="h-8 text-xs" />
                        </div>
                        <Input placeholder="Patient instructions — leave blank to auto-generate from dosage/frequency/route" value={item.instructions} onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)} className="h-8 text-xs mt-2" />
                        <Input placeholder="Pharmacist note (internal only, not on label)" value={item.pharmacistNote || ''} onChange={(e) => updatePrescriptionItem(index, 'pharmacistNote', e.target.value)} className="h-8 text-xs mt-1" />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {prescriptionItems.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Total: Le {prescriptionItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button onClick={() => editingPrescription ? updatePrescription.mutate() : createPrescription.mutate()} disabled={(editingPrescription ? updatePrescription.isPending : createPrescription.isPending) || prescriptionItems.length === 0 || prescriptionItems.some(i => !i.dosage || !i.frequency || !i.duration)}>
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
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={allPatientsSearch}
              onChange={(e) => { setAllPatientsSearch(e.target.value); setAllPatientsPage(1); }}
              placeholder="Search by name, ID, phone, or email..."
              className="pl-8"
            />
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
                            setActiveTab('history');
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
    </div>
  );
}
