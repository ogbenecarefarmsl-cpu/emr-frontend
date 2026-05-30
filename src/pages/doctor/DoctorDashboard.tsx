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
import { useDoctorDashboard, useAcceptPatient, useUpdateVisit, useCompleteVisit, usePatientVisits, useReferToSpecialist } from '@/hooks/useVisits';
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
import { RoleLayout } from '@/components/layout/RoleLayout';
import { PatientSearch } from '@/components/doctor/PatientSearch';
import { AllergyManager } from '@/components/doctor/AllergyManager';
import { ProblemList } from '@/components/doctor/ProblemList';
import { VitalsTrends } from '@/components/doctor/VitalsTrends';
import { FollowUpScheduler } from '@/components/doctor/FollowUpScheduler';

// Icons
import {
  Loader2, Clock, CheckCircle, User, Stethoscope, FileText, FlaskConical, Pill,
  ChevronDown, AlertTriangle, ArrowUp, ArrowDown, Search, Plus, Trash2, Save,
  Send, Heart, Users, ClipboardList, UserCheck, BedDouble, ExternalLink, Activity,
  Pencil
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

export default function DoctorDashboard() {
  const { profile } = useAuth();
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

  // Search medications — hits backend /medications/search which includes CAF products
  const { data: searchResults = [] } = useQuery({
    queryKey: ['medications', 'search', searchMedication],
    queryFn: () => medicationService.search(searchMedication),
    enabled: searchMedication.length >= 2,
    staleTime: 30 * 1000,
  });

  // Filter medications based on search — use live search results when typing, else show all
  const filteredMedications = useMemo(() => {
    if (searchMedication.length >= 2) return searchResults;
    return medications || [];
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
          subjectiveNotes: soapForm.subjective || undefined,
          objectiveNotes: soapForm.objective || undefined,
          assessmentNotes: soapForm.assessment || undefined,
          planNotes: soapForm.plan || undefined,
          diagnosis: soapForm.diagnosis || undefined,
        },
      });
      await soapNoteService.create({
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        doctorId: profile?.id,  // Profile ID - soap_note.doctorId refs Profile
        noteType: SoapNoteTypeEnum.CONSULTATION,
        chiefComplaint: soapForm.subjective || selectedVisit.chiefComplaint || undefined,
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
        diagnosis: soapForm.assessment || soapForm.diagnosis || undefined,
        treatmentPlan: soapForm.plan || undefined,
        followUpInstructions: soapForm.plan || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['patient-chart', selectedVisit.patientId?._id || selectedVisit.patientId] });
      toast.success('Notes saved successfully');
    } catch (error) {
      toast.error('Failed to save notes');
    }
  };

  const handleAddSoapNote = () => {
    setSoapForm({
      subjective: selectedVisit?.chiefComplaint || '',
      objective: '',
      assessment: '',
      plan: '',
      diagnosis: selectedVisit?.diagnosis || '',
    });
    setActiveTab('soap');
  };

  const handleCompleteVisit = async () => {
    if (!selectedVisit) return;

    try {
      await completeVisit.mutateAsync(selectedVisit._id || selectedVisit.id || '');
      toast.success('Visit completed');
      setSelectedVisit(null);
    } catch (error) {
      toast.error('Failed to complete visit');
    }
  };

  const handleCompleteAndNext = async () => {
    if (!selectedVisit) return;

    try {
      await completeVisit.mutateAsync(selectedVisit._id || selectedVisit.id || '');
      toast.success('Visit completed');
      setSelectedVisit(null);
      const nextInQueue = waitingQueue.find((v: Visit) => v.status === 'in_queue');
      if (nextInQueue) {
        await handleAcceptPatient(nextInQueue);
      }
    } catch (error) {
      toast.error('Failed to complete visit');
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

  // Auto-select the active patient if available
  useEffect(() => {
    if (currentActiveVisit && !selectedVisit) {
      setSelectedVisit(currentActiveVisit);
    }
  }, [currentActiveVisit?._id]);

  if (isLoading) {
    return (
      <RoleLayout title="Doctor Workbench" subtitle="Today's patients, clinical notes, results and orders" role="doctor" userName={profile?.fullName}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout title="Doctor Workbench" subtitle="Today's patients, clinical notes, results and orders" role="doctor" userName={profile?.fullName}>
      <div className="flex gap-0 -mt-2 -mx-2" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Sidebar Queue — always visible */}
        <div className="w-[300px] xl:w-[340px] shrink-0 border-r bg-card overflow-y-auto flex flex-col">
          <div className="px-4 py-3 border-b sticky top-0 bg-card z-10">
            <h2 className="font-semibold text-sm">Patient Queue</h2>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {[
                { label: 'Waiting', value: waitingQueue.length, color: 'text-amber-600 bg-amber-50' },
                { label: 'Active', value: activePatients.length, color: 'text-blue-600 bg-blue-50' },
                { label: 'Results', value: resultsReady.length, color: 'text-emerald-600 bg-emerald-50' },
              ].map((item) => (
                <div key={item.label} className={cn("rounded-md px-2 py-1 text-center", item.color)}>
                  <p className="text-[10px] font-medium uppercase">{item.label}</p>
                  <p className="text-base font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Waiting Section */}
          <div className="border-b">
            <button
              type="button"
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
              onClick={() => toggleQueueSection('waiting')}
            >
              <h3 className="font-semibold text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Waiting
                {waitingQueue.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 ml-0.5" />}
              </h3>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="h-5 text-[10px]">{waitingQueue.length}</Badge>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !queueSectionsOpen.waiting && "-rotate-90")} />
              </div>
            </button>
            {queueSectionsOpen.waiting && (
              <div className="max-h-[200px] overflow-y-auto">
                {waitingQueue.length === 0 ? (
                  <div className="px-4 py-4 text-center text-muted-foreground text-xs">No waiting patients</div>
                ) : (
                  <div className="px-2 pb-2 space-y-0.5">
                    {waitingQueue.map((visit: Visit) => (
                      <div
                        key={visit._id || visit.id}
                        className={cn(
                          "px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-muted/60",
                          selectedVisit?._id === visit._id && "bg-primary/10 ring-1 ring-primary/30"
                        )}
                        onClick={() => setSelectedVisit(visit)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{patientDisplayName(visit)}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{visit.visitNumber} · {visit.patientId?.patientId}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-6 text-[10px] px-2 ml-2 shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleAcceptPatient(visit); }}
                            disabled={acceptPatient.isPending}
                          >
                            See
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Section */}
          <div className="border-b">
            <button
              type="button"
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
              onClick={() => toggleQueueSection('active')}
            >
              <h3 className="font-semibold text-xs flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                My Encounters
                {activePatients.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 ml-0.5" />}
              </h3>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="h-5 text-[10px]">{activePatients.length}</Badge>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !queueSectionsOpen.active && "-rotate-90")} />
              </div>
            </button>
            {queueSectionsOpen.active && (
              <div className="max-h-[240px] overflow-y-auto">
                {activePatients.length === 0 ? (
                  <div className="px-4 py-4 text-center text-muted-foreground text-xs">No active encounters</div>
                ) : (
                  <div className="px-2 pb-2 space-y-0.5">
                    {activePatients.map((visit: Visit) => (
                      <div
                        key={visit._id || visit.id}
                        className={cn(
                          "px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-muted/60",
                          selectedVisit?._id === visit._id && "bg-primary/10 ring-1 ring-primary/30"
                        )}
                        onClick={() => {
                          setSelectedVisit(visit);
                          if (visit.status === 'results_ready') setActiveTab('lab-results');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{patientDisplayName(visit)}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{visit.visitNumber}</p>
                          </div>
                          <Badge variant="outline" className="capitalize text-[9px] px-1.5 py-0 shrink-0 ml-2">
                            {statusLabel(visit.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="border-b">
            <button
              type="button"
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
              onClick={() => toggleQueueSection('results')}
            >
              <h3 className="font-semibold text-xs flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-emerald-500" />
                Results Ready
                {resultsReady.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 ml-0.5" />}
              </h3>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="h-5 text-[10px]">{resultsReady.length}</Badge>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !queueSectionsOpen.results && "-rotate-90")} />
              </div>
            </button>
            {queueSectionsOpen.results && (
              <div className="max-h-[200px] overflow-y-auto">
                {resultsReady.length === 0 ? (
                  <div className="px-4 py-4 text-center text-muted-foreground text-xs">No results pending</div>
                ) : (
                  <div className="px-2 pb-2 space-y-0.5">
                    {resultsReady.map((visit: Visit) => (
                      <div
                        key={visit._id || visit.id}
                        className={cn(
                          "px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-muted/60",
                          selectedVisit?._id === visit._id && "bg-primary/10 ring-1 ring-primary/30"
                        )}
                        onClick={() => {
                          setSelectedVisit(visit);
                          setActiveTab('lab-results');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{patientDisplayName(visit)}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{visit.visitNumber}</p>
                          </div>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0 shrink-0 ml-2">
                            Review
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Referrals Section */}
          {awaitingLabPayment.length + awaitingPharmacy.length + awaitingDispensing.length > 0 && (
            <div className="border-b">
              <button
                type="button"
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
                onClick={() => toggleQueueSection('referrals')}
              >
                <h3 className="font-semibold text-xs flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-600" />
                  Referrals
                </h3>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", !queueSectionsOpen.referrals && "-rotate-90")} />
              </button>
              {queueSectionsOpen.referrals && (
                <div className="px-4 pb-3 space-y-2">
                  {awaitingLabPayment.length > 0 && (
                    <div className="rounded-md bg-amber-50 px-3 py-2">
                      <p className="text-[10px] font-medium text-amber-800">Awaiting Lab Payment</p>
                      <p className="text-lg font-bold text-amber-700">{awaitingLabPayment.length}</p>
                    </div>
                  )}
                  {(awaitingPharmacy.length + awaitingDispensing.length) > 0 && (
                    <div className="rounded-md bg-purple-50 px-3 py-2">
                      <p className="text-[10px] font-medium text-purple-800">Pharmacy Workflow</p>
                      <p className="text-lg font-bold text-purple-700">{awaitingPharmacy.length + awaitingDispensing.length}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Metrics */}
          <div className="mt-auto px-4 py-3 border-t bg-muted/20">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Waiting</p>
                <p className="text-lg font-bold text-amber-600">{stats.waiting}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Closed</p>
                <p className="text-lg font-bold text-emerald-600">{stats.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content — Patient Workspace */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedVisit ? (
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
              {/* Patient Header */}
              <div className="px-6 py-5 border-b bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold tracking-normal">{patientDisplayName(selectedVisit)}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span>{selectedVisit.patientId?.patientId || selectedVisit.patientId?.mrn || 'No hospital number'}</span>
                      <span>{selectedVisit.patientId?.gender || 'N/A'}</span>
                      <span>{patientAgeLabel(selectedVisit.patientId)}</span>
                      {selectedVisit.patientId?.phone && <span>{selectedVisit.patientId.phone}</span>}
                    </div>
                    {selectedVisit.patientId?.allergies?.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs text-red-600 font-medium">Allergies: {selectedVisit.patientId.allergies.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Badge variant="outline">{selectedVisit.visitNumber}</Badge>
                    <Badge className={visitStatusTone(selectedVisit.status)}>
                      {statusLabel(selectedVisit.status)}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                  {[
                    { label: 'Visit type', value: selectedVisit.visitType || 'General' },
                    { label: 'Category', value: selectedPatient.patientCategory || selectedPatient.category || 'Private' },
                    { label: 'Wallet', value: `NGN ${selectedWalletBalance.toLocaleString()}` },
                    { label: 'Triage', value: selectedVisit.triagePriority ? statusLabel(selectedVisit.triagePriority) : 'Not recorded' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border bg-background/80 px-3 py-2 min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-medium leading-snug break-words">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-6 pt-3 border-b overflow-x-auto">
                  <TabsList className="bg-transparent h-auto p-0 min-w-max">
                    <TabsTrigger value="soap" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Consult</TabsTrigger>
                    <TabsTrigger value="orders" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Orders</TabsTrigger>
                    <TabsTrigger value="lab-results" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none relative">
                      Results
                      {labResults.length > 0 && (
                        <Badge className="ml-1.5 h-4 min-w-4 text-[10px]">{labResults.length}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Summary</TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">History</TabsTrigger>
                  </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="p-5 mt-0">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Vitals Card */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        Vitals
                      </h3>
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
                            <div className="text-xs text-muted-foreground">{vital.label}</div>
                            <div className="text-sm font-medium mt-0.5 break-words">{vital.value || '-'}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Latest nursing triage vitals.</p>
                    </div>

                    {/* Chief Complaint Card */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-blue-500" />
                        Chief Complaint
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedVisit.chiefComplaint || 'Not specified'}
                      </p>
                      {selectedVisit.notes && (
                        <>
                          <Separator className="my-3" />
                          <p className="text-sm text-muted-foreground">{selectedVisit.notes}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Clinical Components */}
                  <div className="mt-6 space-y-4">
                    <AllergyManager
                      patientId={selectedVisit.patientId?._id || selectedVisit.patientId}
                      allergies={selectedVisit.patientId?.allergies || []}
                      allergyDetails={selectedVisit.patientId?.allergyDetails || []}
                    />
                    <ProblemList
                      visitId={selectedVisit._id || selectedVisit.id}
                      problems={selectedVisit.problemList || []}
                    />
                    <VitalsTrends vitalsHistory={patientChart?.vitalsHistory || []} />
                    <FollowUpScheduler
                      visitId={selectedVisit._id || selectedVisit.id}
                      followUpDate={selectedVisit.followUpDate}
                      followUpNotes={selectedVisit.followUpNotes}
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-6 rounded-xl border bg-muted/20 p-4">
                    {closureBlockers.length > 0 && (
                      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-800">Cannot close encounter yet</p>
                        <ul className="mt-1 text-xs text-amber-700 space-y-1">
                          {closureBlockers.map((blocker) => (
                            <li key={blocker}>- {blocker}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">Clinical actions</h3>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">{statusLabel(selectedVisit.status)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setActiveTab('soap')}>
                          <FileText className="w-4 h-4 mr-2" />
                          Consult
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('orders')} disabled={!canContinueClinicalWork}>
                          <ClipboardList className="w-4 h-4 mr-2" />
                          Orders
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('lab-results')} disabled={labResults.length === 0}>
                          <FlaskConical className="w-4 h-4 mr-2" />
                          Results
                        </Button>
                        <Button
                          onClick={handleCompleteAndNext}
                          disabled={completeVisit.isPending || !canCloseEncounter}
                          title={!canCloseEncounter ? closureBlockers.join(' ') : undefined}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Close Visit
                        </Button>
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

                  {/* Existing Orders for this visit */}
                  {currentVisitOrders.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Existing Orders</h4>
                      <div className="space-y-2">
                        {currentVisitOrders.map((order: any) => {
                          const orderTests = order.order_tests || order.tests || [];
                          const orderType = order.orderType || order.order_type;
                          const canEdit = (order.paymentStatus || order.payment_status) === 'pending' &&
                            (order.status === 'awaiting_payment');
                          return (
                            <div key={order._id || order.id} className="border rounded-lg p-4 bg-card">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold">{order.orderNumber}</p>
                                    <Badge variant="outline" className="capitalize text-[10px]">{orderType}</Badge>
                                    <Badge variant={
                                      (order.status === 'completed') ? 'default' :
                                      (order.status === 'cancelled') ? 'destructive' :
                                      'secondary'
                                    } className="text-[10px] capitalize">
                                      {(order.status || '').replace(/_/g, ' ')}
                                    </Badge>
                                    <Badge variant={
                                      (order.paymentStatus || order.payment_status) === 'paid' ? 'default' : 'outline'
                                    } className="text-[10px]">
                                      {(order.paymentStatus || order.payment_status || 'pending').replace(/_/g, ' ')}
                                    </Badge>
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
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Total: Le {(order.total || 0).toLocaleString()} | Priority: {order.priority || 'routine'}
                                  </p>
                                </div>
                                {canEdit && orderType === 'lab' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => startEditOrder(order)}
                                    disabled={!canContinueClinicalWork}
                                  >
                                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Existing Prescriptions for this visit */}
                  {currentVisitPrescriptions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Existing Prescriptions</h4>
                      <div className="space-y-2">
                        {currentVisitPrescriptions.map((rx: any) => {
                          const canEdit = !rx.isPaid && rx.status === 'pending';
                          return (
                            <div key={rx._id} className="border rounded-lg p-4 bg-card">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold">{rx.prescriptionNumber}</p>
                                    <Badge variant={rx.isPaid ? 'default' : 'secondary'} className="text-[10px]">
                                      {rx.isPaid ? 'Paid' : 'Awaiting payment'}
                                    </Badge>
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
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Total: Le {(rx.totalAmount || 0).toLocaleString()}
                                  </p>
                                </div>
                                {canEdit && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => startEditPrescription(rx)}
                                    disabled={!canContinueClinicalWork}
                                  >
                                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                    Edit
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
                    <Button
                      variant="outline"
                      className="h-auto justify-start p-4"
                      onClick={() => { setEditingOrder(null); setSelectedTests([]); setLabOrderModalOpen(true); }}
                      disabled={!canContinueClinicalWork}
                    >
                      <FlaskConical className="w-5 h-5 mr-3 text-blue-500" />
                      <span className="text-left">
                        <span className="block font-medium">Order Lab Tests</span>
                        <span className="block text-xs text-muted-foreground">Send tests to LIS.</span>
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto justify-start p-4"
                      onClick={() => { setEditingPrescription(null); setPrescriptionItems([]); setPrescriptionModalOpen(true); }}
                      disabled={!canContinueClinicalWork}
                    >
                      <Pill className="w-5 h-5 mr-3 text-purple-500" />
                      <span className="text-left">
                        <span className="block font-medium">Prescribe Medication</span>
                        <span className="block text-xs text-muted-foreground">Create medication order.</span>
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto justify-start p-4"
                      onClick={() => setReferralOpen(true)}
                      disabled={!canContinueClinicalWork}
                    >
                      <UserCheck className="w-5 h-5 mr-3 text-cyan-600" />
                      <span className="text-left">
                        <span className="block font-medium">Refer Patient</span>
                        <span className="block text-xs text-muted-foreground">Send clinical referral.</span>
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto justify-start p-4"
                      onClick={() => setAdmitOpen(true)}
                      disabled={!canContinueClinicalWork}
                    >
                      <BedDouble className="w-5 h-5 mr-3 text-emerald-600" />
                      <span className="text-left">
                        <span className="block font-medium">Admit Patient</span>
                        <span className="block text-xs text-muted-foreground">Start inpatient care.</span>
                      </span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                    {[
                      { label: 'Awaiting lab payment', value: awaitingLabPayment.length },
                      { label: 'Awaiting results', value: awaitingResults.length },
                      { label: 'Pharmacy workflow', value: awaitingPharmacy.length + awaitingDispensing.length },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-2xl font-semibold mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleCompleteAndNext}
                      disabled={completeVisit.isPending || !canCloseEncounter}
                      title={!canCloseEncounter ? closureBlockers.join(' ') : undefined}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Close Visit
                    </Button>
                  </div>
                </TabsContent>

                {/* Consultation Tab */}
                <TabsContent value="soap" className="p-6 mt-0">
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 border rounded-lg p-4 bg-muted/20 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">Consultation Note</h3>
                        <p className="text-xs text-muted-foreground mt-1">{selectedVisit.chiefComplaint || 'No chief complaint recorded'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleAddSoapNote}>
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          New Note
                        </Button>
                        <Button size="sm" onClick={handleSaveVitalsAndSOAP} disabled={updateVisit.isPending}>
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          Save
                        </Button>
                      </div>
                    </div>

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

                    <div className="rounded-lg border p-4 bg-background">
                      <Label className="text-sm font-semibold">Diagnosis</Label>
                      <Input
                        value={soapForm.diagnosis}
                        onChange={(e) => setSoapForm({...soapForm, diagnosis: e.target.value})}
                        placeholder="Primary diagnosis"
                        className="mt-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4 bg-background">
                        <Label className="text-sm font-semibold text-blue-600">S - Subjective</Label>
                        <Textarea
                          value={soapForm.subjective}
                          onChange={(e) => setSoapForm({...soapForm, subjective: e.target.value})}
                          placeholder="Patient's description of symptoms, history of present illness..."
                          rows={7}
                          className="mt-2 resize-y"
                        />
                      </div>
                      <div className="rounded-lg border p-4 bg-background">
                        <Label className="text-sm font-semibold text-green-600">O - Objective</Label>
                        <Textarea
                          value={soapForm.objective}
                          onChange={(e) => setSoapForm({...soapForm, objective: e.target.value})}
                          placeholder="Physical exam findings, vitals, observations..."
                          rows={7}
                          className="mt-2 resize-y"
                        />
                      </div>
                      <div className="rounded-lg border p-4 bg-background">
                        <Label className="text-sm font-semibold text-purple-600">A - Assessment</Label>
                        <Textarea
                          value={soapForm.assessment}
                          onChange={(e) => setSoapForm({...soapForm, assessment: e.target.value})}
                          placeholder="Clinical impression, differential diagnosis..."
                          rows={6}
                          className="mt-2 resize-y"
                        />
                      </div>
                      <div className="rounded-lg border p-4 bg-background">
                        <Label className="text-sm font-semibold text-orange-600">P - Plan</Label>
                        <Textarea
                          value={soapForm.plan}
                          onChange={(e) => setSoapForm({...soapForm, plan: e.target.value})}
                          placeholder="Treatment plan, medications, follow-up..."
                          rows={6}
                          className="mt-2 resize-y"
                        />
                      </div>
                    </div>

                    {/* Emergency room indicator */}
                    {selectedVisit.roomType === 'emergency' && (
                      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                          Emergency - {selectedVisit.room || 'Treatment Room'}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-3">
                      <Button variant="outline" onClick={() => setActiveTab('orders')} disabled={!canContinueClinicalWork}>
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Orders
                      </Button>
                      <Button onClick={handleSaveVitalsAndSOAP} disabled={updateVisit.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Note
                      </Button>
                    </div>
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {labResults.length} result{labResults.length === 1 ? '' : 's'} released, {abnormalLabResults.length} flagged.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            const reportPath = `/lab/reports/${selectedVisit._id || selectedVisit.id}`;
                            navigate(reportPath);
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Full Report
                        </Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
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
                                  <span className={cn("px-2 py-1 rounded text-xs font-medium", getFlagColor(result.flag))}>
                                    {getFlagLabel(result.flag)}
                                  </span>
                                </td>
                                <td className="p-3 text-center text-muted-foreground text-xs">
                                  {result.referenceRange || result.reference_range || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="mt-0">
                  <Tabs value={historyTab} onValueChange={setHistoryTab} className="w-full">
                    <div className="px-5 py-3 border-b bg-muted/10">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-sm">Patient History</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Longitudinal record for this patient. Pick a section and it opens in this workspace.
                          </p>
                        </div>
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
                              {patientVisits
                                .filter((v: Visit) => v._id !== selectedVisit._id)
                                .map((visit: Visit) => (
                                  <div key={visit._id} className="border rounded-lg p-4 bg-card">
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="text-sm font-semibold">{visit.visitNumber}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(visit.createdAt).toLocaleDateString()} - {visit.visitType}
                                        </p>
                                      </div>
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
                                <div key={note._id} className="border rounded-lg p-4 bg-card">
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                      <p className="text-sm font-semibold capitalize">{note.noteType?.replace(/_/g, ' ') || 'Clinical note'}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {note.doctorId?.fullName || note.doctorId?.fullName || note.nurseId?.fullName || 'Clinical staff'} - {new Date(note.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
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
                                <div key={order._id} className="border rounded-lg p-4 bg-card">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold">{order.orderNumber}</p>
                                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <Badge variant="outline" className="capitalize">{order.status?.replace(/_/g, ' ')}</Badge>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {(order.orderTests || []).map((test: any, index: number) => {
                                      const result = order.results?.find((r: any) => r.orderTestId?.toString() === test._id?.toString());
                                      return (
                                        <div key={`${order._id}-${index}`} className="flex items-center justify-between gap-3 text-sm border-l-2 pl-3">
                                          <span>{test.testName || test.testCode}</span>
                                          {result ? (
                                            <span className="font-medium">{result.value} {result.unit || ''}</span>
                                          ) : (
                                            <span className="text-muted-foreground">Pending</span>
                                          )}
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
                                <div key={prescription._id} className="border rounded-lg p-4 bg-card">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold">{prescription.prescriptionNumber}</p>
                                      <p className="text-xs text-muted-foreground">{new Date(prescription.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <Badge variant={prescription.isPaid ? 'default' : 'secondary'}>{prescription.isPaid ? 'Paid' : 'Awaiting payment'}</Badge>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {(prescription.items || []).map((item: any, index: number) => (
                                      <div key={`${prescription._id}-${index}`} className="text-sm border-l-2 pl-3">
                                        <span className="font-medium">{item.medicationName}</span>
                                        <span className="text-muted-foreground"> - {item.dosage}, {item.frequency}, {item.duration}</span>
                                      </div>
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
                                <div key={admission._id} className="border rounded-lg p-4 bg-card">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold">{admission.admissionNumber}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {admission.wardType}{admission.bedNumber ? ` - ${admission.bedNumber}` : ''} - {new Date(admission.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <Badge className="capitalize">{admission.status}</Badge>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
                                    <div><span className="font-medium">Reason:</span> {admission.admissionReason || 'N/A'}</div>
                                    <div><span className="font-medium">Diagnosis:</span> {admission.diagnosis || admission.dischargeDiagnosis || 'N/A'}</div>
                                    <div><span className="font-medium">MAR entries:</span> {admission.medicationLog?.length || 0}</div>
                                    <div><span className="font-medium">Nursing notes:</span> {admission.nursingNotes?.length || 0}</div>
                                  </div>
                                  {admission.dischargeInstructions && (
                                    <p className="text-sm mt-3"><span className="font-medium">Discharge/follow-up:</span> {admission.dischargeInstructions}</p>
                                  )}
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
                                <div key={index} className="border rounded-lg p-4 bg-card">
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-semibold">{new Date(vital.date).toLocaleDateString()}</p>
                                    <p className="text-xs text-muted-foreground">{vital.recordedBy?.fullName || vital.recordedBy?.fullName || 'Clinical staff'}</p>
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
            </div>
          ) : (
            <div className="bg-card border rounded-xl shadow-sm p-8">
              <div className="max-w-2xl mx-auto text-center">
                <User className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
                <h2 className="text-2xl font-semibold">No patient open</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Open a waiting patient, continue an active encounter, or review returned results.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                  <Button variant="outline" className="h-auto py-4" onClick={() => {
                    setQueueSectionsOpen((current) => ({ ...current, waiting: true }));
                  }}>
                    <Clock className="w-4 h-4 mr-2" />
                    Waiting Patients
                  </Button>
                  <Button variant="outline" className="h-auto py-4" onClick={() => {
                    setQueueSectionsOpen((current) => ({ ...current, active: true }));
                  }}>
                    <Stethoscope className="w-4 h-4 mr-2" />
                    Patients I'm Seeing
                  </Button>
                  <Button variant="outline" className="h-auto py-4" onClick={() => {
                    setQueueSectionsOpen((current) => ({ ...current, results: true }));
                  }}>
                    <FlaskConical className="w-4 h-4 mr-2" />
                    Results Ready
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lab Order Modal */}
      <Dialog open={labOrderModalOpen} onOpenChange={(open) => { if (!open) cancelEdit(); setLabOrderModalOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Edit Lab Order' : 'Order Lab Tests'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test Search */}
            <div>
              <Label className="text-sm font-medium">Search Tests</Label>
              <Input
                value={searchTest}
                onChange={(e) => setSearchTest(e.target.value)}
                placeholder="Search by test name or code..."
                className="mt-1"
              />
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {testsLoading ? (
                  <div className="h-full p-6 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading LIS catalog
                  </div>
                ) : testsError ? (
                  <div className="p-6 text-center text-sm text-red-600">
                    Could not load LIS catalog.
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(testsLoadError as any)?.response?.data?.message || (testsLoadError as any)?.message || 'Check backend LIS connection.'}
                    </p>
                  </div>
                ) : filteredTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No LIS tests or panels found
                  </div>
                ) : (
                  filteredTests.map((test: Test) => (
                    <div
                      key={test._id || test.code}
                      className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 flex items-center justify-between"
                      onClick={() => addTestToOrder(test)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{test.name}</p>
                          {test.isPanel && (
                            <Badge variant="outline" className="text-[10px] h-5">Panel</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {test.code} - Le {test.price?.toLocaleString()}
                          {test.isPanel && test.panelComponents && (
                            <span className="ml-1">({test.panelComponents.length} components)</span>
                          )}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>

            {/* Selected Tests */}
            <div>
              <Label className="text-sm font-medium">Selected Tests ({selectedTests.length})</Label>
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {selectedTests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Click tests to add them
                  </div>
                ) : (
                  <div className="divide-y">
                    {selectedTests.map((test) => (
                      <div key={test._id || test.code} className="p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{test.name}</p>
                            {test.isPanel && (
                              <Badge variant="outline" className="text-[10px] h-5">Panel</Badge>
                            )}
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
            <Button
              onClick={() => editingOrder ? updateLabOrder.mutate() : createLabOrder.mutate()}
              disabled={(editingOrder ? updateLabOrder.isPending : createLabOrder.isPending) || selectedTests.length === 0}
            >
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Medication Search */}
            <div>
              <Label className="text-sm font-medium">Search Medications</Label>
              <Input
                value={searchMedication}
                onChange={(e) => setSearchMedication(e.target.value)}
                placeholder="Search to filter medications..."
                className="mt-1"
              />
              <ScrollArea className="h-80 mt-2 border rounded-lg">
                {filteredMedications.map((med: Medication) => (
                  <div
                    key={med._id}
                    className={cn(
                      "p-3 border-b last:border-b-0 flex items-center justify-between",
                      (med.stockQuantity || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed bg-muted/20",
                    )}
                    onClick={() => (med.stockQuantity || 0) > 0 && addMedicationToPrescription(med)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{med.name}</p>
                        {med.__cafProduct && <Badge variant="outline" className="text-[10px] flex-shrink-0">CAF</Badge>}
                      </div>
                      {med.genericName && (
                        <p className="text-xs text-muted-foreground truncate">{med.genericName}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {med.dosageForm && <span>{med.dosageForm}</span>}
                        {med.unit && <span>| {med.unit}</span>}
                        {med.category && <span>| {med.category}</span>}
                        <span className="font-medium text-foreground">Le {(med.unitPrice || 0).toLocaleString()}</span>
                      </div>
                      {med.packSizes && med.packSizes.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Packs: {med.packSizes.map((ps) => `${ps.name} (${ps.quantityPerPack} ${ps.unit})`).join(', ')}
                        </p>
                      )}
                      <p className={cn("text-xs mt-0.5", (med.stockQuantity || 0) > 0 ? "text-emerald-600" : "text-red-600")}>
                        {(med.stockQuantity || 0) > 0 ? `${med.stockQuantity} in stock` : 'Out of stock'}
                      </p>
                    </div>
                    {(med.stockQuantity || 0) > 0 ? <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <Badge variant="destructive" className="flex-shrink-0">No stock</Badge>}
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Prescription Items */}
            <div>
              <Label className="text-sm font-medium">Prescription Items ({prescriptionItems.length})</Label>
              <ScrollArea className="h-64 mt-2 border rounded-lg">
                {prescriptionItems.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    Click medications to add them
                  </div>
                ) : (
                  <div className="divide-y">
                    {prescriptionItems.map((item, index) => (
                      <div key={index} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{item.medicationName}</p>
                          <Button variant="ghost" size="sm" onClick={() => removePrescriptionItem(index)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Dosage (e.g., 500mg)"
                            value={item.dosage}
                            onChange={(e) => updatePrescriptionItem(index, 'dosage', e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Input
                            placeholder="Frequency (e.g., 3x daily)"
                            value={item.frequency}
                            onChange={(e) => updatePrescriptionItem(index, 'frequency', e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Input
                            placeholder="Duration (e.g., 7 days)"
                            value={item.duration}
                            onChange={(e) => updatePrescriptionItem(index, 'duration', e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updatePrescriptionItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <Input
                          placeholder="Patient instructions — leave blank to auto-generate from dosage/frequency/route"
                          value={item.instructions}
                          onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)}
                          className="h-8 text-xs mt-2"
                        />
                        <Input
                          placeholder="Pharmacist note (internal only, not on label)"
                          value={item.pharmacistNote || ''}
                          onChange={(e) => updatePrescriptionItem(index, 'pharmacistNote', e.target.value)}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {prescriptionItems.length > 0 && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    Total: Le {prescriptionItems.reduce((sum, item) => sum + (item.quantity * (item.unitPrice || 0)), 0).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button
              onClick={() => editingPrescription ? updatePrescription.mutate() : createPrescription.mutate()}
              disabled={
                (editingPrescription ? updatePrescription.isPending : createPrescription.isPending) ||
                prescriptionItems.length === 0 ||
                prescriptionItems.some(i => !i.dosage || !i.frequency || !i.duration)
              }
            >
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
              <Select
                value={referralForm.specialistId}
                onValueChange={(v) => setReferralForm({ ...referralForm, specialistId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select specialist" />
                </SelectTrigger>
                <SelectContent>
                  {specialists.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      No specialists registered. Add them in Admin - Doctors.
                    </div>
                  ) : (
                    specialists.map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.fullName} - {s.specialty?.replace(/_/g, ' ')}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason for Referral *</Label>
              <Input
                value={referralForm.reason}
                onChange={(e) => setReferralForm({ ...referralForm, reason: e.target.value })}
                placeholder="e.g., Suspected cardiac arrhythmia"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={referralForm.notes}
                onChange={(e) => setReferralForm({ ...referralForm, notes: e.target.value })}
                rows={3}
                placeholder="Relevant history, findings, and recommended next steps..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferralOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!selectedVisit) return;
                try {
                  await referToSpecialist.mutateAsync({
                    visitId: selectedVisit._id || selectedVisit.id || '',
                    data: referralForm,
                  });
                  toast.success('Patient referred to specialist');
                  setReferralOpen(false);
                  setReferralForm({ specialistId: '', reason: '', notes: '' });
                  setSelectedVisit(null);
                } catch {
                  toast.error('Failed to refer patient');
                }
              }}
              disabled={referToSpecialist.isPending || !referralForm.specialistId || !referralForm.reason}
            >
              {referToSpecialist.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              Refer
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
                <Select
                  value={admitForm.wardType}
                  onValueChange={(v) => setAdmitForm({ ...admitForm, wardType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              <div>
                <Label>Bed Number</Label>
                <Input
                  value={admitForm.bedNumber}
                  onChange={(e) => setAdmitForm({ ...admitForm, bedNumber: e.target.value })}
                  placeholder="e.g., B-12"
                />
              </div>
            </div>
            <div>
              <Label>Admission Reason *</Label>
              <Input
                value={admitForm.admissionReason}
                onChange={(e) => setAdmitForm({ ...admitForm, admissionReason: e.target.value })}
                placeholder="Primary reason for admission"
              />
            </div>
            <div>
              <Label>Working Diagnosis</Label>
              <Input
                value={admitForm.diagnosis}
                onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={admitForm.notes}
                onChange={(e) => setAdmitForm({ ...admitForm, notes: e.target.value })}
                rows={3}
                placeholder="Handoff notes for the nursing team..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createAdmission.mutate()}
              disabled={createAdmission.isPending || !admitForm.admissionReason}
            >
              {createAdmission.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BedDouble className="w-4 h-4 mr-2" />}
              Admit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}

