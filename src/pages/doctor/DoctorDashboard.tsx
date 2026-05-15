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
import { useDoctorDashboard, useAcceptPatient, useUpdateVisit, useCompleteVisit, usePatientVisits, useReferToSpecialist, useAcceptReferral } from '@/hooks/useVisits';
import { useActiveTests } from '@/hooks/useTestCatalog';
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
import { MetricCard } from '@/components/dashboard/MetricCard';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { PatientSearch } from '@/components/doctor/PatientSearch';
import { AllergyManager } from '@/components/doctor/AllergyManager';
import { ProblemList } from '@/components/doctor/ProblemList';
import { VitalsTrends } from '@/components/doctor/VitalsTrends';
import { FollowUpScheduler } from '@/components/doctor/FollowUpScheduler';

// Icons
import {
  Loader2, Clock, CheckCircle, User, Stethoscope, FileText, FlaskConical, Pill,
  ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Search, Plus, Trash2, Save,
  Send, Heart, Users, ClipboardList, UserCheck, BedDouble, Inbox, ExternalLink
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
  const [activeTab, setActiveTab] = useState('overview');
  const [historyTab, setHistoryTab] = useState('visits');

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
  const acceptReferral = useAcceptReferral();
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
  const createAdmission = useMutation({
    mutationFn: async () => {
      if (!selectedVisit) return;
      return admissionsAPI.create({
        patientId: selectedVisit.patientId?._id || selectedVisit.patientId,
        visitId: selectedVisit._id || selectedVisit.id,
        doctorId: profile?.id,  // Profile ID — admission.doctorId now refs Profile
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

  // Fetch active tests for lab order modal
  const { data: tests = [] } = useActiveTests();

  // Fetch medications for prescription modal
  const { data: medications = [] } = useQuery({
    queryKey: ['medications'],
    queryFn: () => medicationService.findAll(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch patient's previous visits when a patient is selected
  const patientId = selectedVisit?.patientId?._id || selectedVisit?.patientId || '';
  const { data: patientVisits = [] } = usePatientVisits(patientId);
  const { data: patientChart, isLoading: chartLoading } = useQuery({
    queryKey: ['patient-chart', patientId],
    queryFn: () => patientService.getChart(patientId),
    enabled: !!patientId && activeTab === 'history',
    staleTime: 60 * 1000,
  });

  // Fetch lab results for the selected visit - need to find the lab order
  const labOrderId = selectedVisit?.orders?.find((o: any) => o.orderType === 'lab')?._id || 
    selectedVisit?.consultationOrderId;
  const { data: labResults = [] } = useResults(labOrderId);

  // Filter tests based on search
  const filteredTests = useMemo(() => {
    if (!searchTest) return (tests || []).slice(0, 20);
    return (tests || []).filter((t: Test) =>
      t.name?.toLowerCase().includes(searchTest.toLowerCase()) ||
      t.code?.toLowerCase().includes(searchTest.toLowerCase())
    ).slice(0, 20);
  }, [tests, searchTest]);

  // Filter medications based on search
  const filteredMedications = useMemo(() => {
    if (!searchMedication) return (medications || []).slice(0, 20);
    return (medications || []).filter((m: Medication) =>
      m.name?.toLowerCase().includes(searchMedication.toLowerCase()) ||
      m.genericName?.toLowerCase().includes(searchMedication.toLowerCase())
    ).slice(0, 20);
  }, [medications, searchMedication]);

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
    }
  }, [selectedVisit?._id]);

  // Handlers
  const handleAcceptPatient = async (visit: Visit) => {
    try {
      await acceptPatient.mutateAsync(visit._id || visit.id || '');
      setSelectedVisit(visit);
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
        doctorId: profile?.id,  // Profile ID — soap_note.doctorId refs Profile
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

      // doctorId on prescriptions references the doctors collection (external doctors).
      // The prescribing doctor (system user) is captured via orderedBy from the JWT.
      // Do not pass profile.id here — it would fail validation.
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
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create prescription';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const addTestToOrder = (test: Test) => {
    if (!selectedTests.find(t => t._id === test._id)) {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const removeTestFromOrder = (testId: string) => {
    setSelectedTests(selectedTests.filter(t => t._id !== testId));
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

  // Stats from dashboard data
  const stats = dashboardData?.todayStats || { seen: 0, waiting: 0, completed: 0 };
  const waitingQueue = dashboardData?.waitingQueue || [];
  const activePatients = dashboardData?.activePatients || [];
  const resultsReady = dashboardData?.resultsReady || [];
  const incomingReferrals = dashboardData?.incomingReferrals || [];

  // Get the active visit for the doctor (if any)
  const currentActiveVisit = activePatients[0];

  // Auto-select the active patient if available
  useEffect(() => {
    if (currentActiveVisit && !selectedVisit) {
      setSelectedVisit(currentActiveVisit);
    }
  }, [currentActiveVisit?._id]);

  if (isLoading) {
    return (
      <RoleLayout title="Doctor Dashboard" subtitle="Manage your consultations" role="doctor" userName={profile?.fullName}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout title="Doctor Dashboard" subtitle="Manage your consultations" role="doctor" userName={profile?.fullName}>
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Waiting in Queue"
          value={stats.waiting}
          icon={Users}
          variant={stats.waiting > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Seen Today"
          value={stats.seen}
          icon={Stethoscope}
        />
        <MetricCard
          title="Results Ready"
          value={resultsReady.length}
          icon={FlaskConical}
          variant={resultsReady.length > 0 ? 'critical' : 'default'}
        />
        <MetricCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle}
        />
      </div>

      {/* Main Layout: Queue + Patient Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Patient Queue */}
        <div className="lg:col-span-1 space-y-4">
          {/* Waiting Queue */}
          <div className="bg-card border rounded-xl shadow-sm">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Waiting Queue
              </h3>
              <Badge variant="secondary">{waitingQueue.length}</Badge>
            </div>
            <ScrollArea className="max-h-80">
              {waitingQueue.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No patients waiting
                </div>
              ) : (
                <div className="divide-y">
                  {waitingQueue.map((visit: Visit) => (
                    <div
                      key={visit._id || visit.id}
                      className={cn(
                        "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                        selectedVisit?._id === visit._id && "bg-primary/5 border-l-2 border-primary"
                      )}
                      onClick={() => setSelectedVisit(visit)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {visit.patientId?.firstName} {visit.patientId?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {visit.visitNumber} - {visit.patientId?.patientId}
                          </p>
                          {visit.chiefComplaint && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-48">
                              {visit.chiefComplaint}
                            </p>
                          )}
                        </div>
                        {visit.status === 'in_queue' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptPatient(visit);
                            }}
                            disabled={acceptPatient.isPending}
                          >
                            Accept
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Results Ready */}
          {resultsReady.length > 0 && (
            <div className="bg-card border rounded-xl shadow-sm border-l-4 border-l-green-500">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Results Ready
                </h3>
                <Badge variant="default" className="bg-green-500">{resultsReady.length}</Badge>
              </div>
              <div className="divide-y">
                {resultsReady.map((visit: Visit) => (
                  <div
                    key={visit._id || visit.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                      selectedVisit?._id === visit._id && "bg-green-50"
                    )}
                    onClick={() => {
                      setSelectedVisit(visit);
                      setActiveTab('lab-results');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {visit.patientId?.firstName} {visit.patientId?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{visit.visitNumber}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incoming Referrals (for specialists) */}
          {incomingReferrals.length > 0 && (
            <div className="bg-card border rounded-xl shadow-sm border-l-4 border-l-purple-500">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-purple-500" />
                  Incoming Referrals
                </h3>
                <Badge className="bg-purple-500">{incomingReferrals.length}</Badge>
              </div>
              <div className="divide-y">
                {incomingReferrals.map((visit: any) => (
                  <div key={visit._id} className="p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">
                          {visit.patientId?.firstName} {visit.patientId?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{visit.visitNumber}</p>
                        {visit.doctorId && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Referred by: {visit.doctorId.fullName}
                          </p>
                        )}
                        {visit.referralReason && (
                          <p className="text-xs text-purple-700 mt-1 italic line-clamp-2">
                            "{visit.referralReason}"
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                        onClick={async () => {
                          try {
                            await acceptReferral.mutateAsync(visit._id);
                            setSelectedVisit(visit);
                            toast.success('Referral accepted');
                          } catch {
                            toast.error('Failed to accept referral');
                          }
                        }}
                        disabled={acceptReferral.isPending}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Active Patient Workspace */}
        <div className="lg:col-span-2">
          {selectedVisit ? (
            <div className="bg-card border rounded-xl shadow-sm">
              {/* Patient Header */}
              <div className="px-5 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {selectedVisit.patientId?.firstName} {selectedVisit.patientId?.lastName}
                    </h2>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{selectedVisit.patientId?.patientId}</span>
                      <span>-</span>
                      <span>{selectedVisit.patientId?.gender || 'N/A'}</span>
                      <span>-</span>
                      <span>{selectedVisit.patientId?.age || selectedVisit.patientId?.dateOfBirth ? `${selectedVisit.patientId?.age || ''} yrs` : 'Age N/A'}</span>
                    </div>
                    {selectedVisit.patientId?.allergies?.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs text-red-600 font-medium">Allergies: {selectedVisit.patientId.allergies.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedVisit.visitNumber}</Badge>
                    <Badge className={cn(
                      selectedVisit.status === 'in_consultation' && 'bg-blue-500',
                      selectedVisit.status === 'results_ready' && 'bg-green-500',
                      selectedVisit.status === 'awaiting_lab' && 'bg-amber-500',
                      selectedVisit.status === 'awaiting_pharmacy' && 'bg-purple-500',
                    )}>
                      {selectedVisit.status?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-5 pt-3 border-b">
                  <TabsList className="bg-transparent h-auto p-0">
                    <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Overview</TabsTrigger>
                    <TabsTrigger value="soap" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">SOAP Notes</TabsTrigger>
                    <TabsTrigger value="lab-results" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none relative">
                      Lab Results
                      {labResults.length > 0 && (
                        <Badge className="ml-1.5 h-4 min-w-4 text-[10px]">{labResults.length}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">History</TabsTrigger>
                  </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="p-5 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vitals Card */}
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        Vitals
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Temperature (°C)', value: vitalsForm.temperature, icon: '🌡' },
                          { label: 'Blood Pressure', value: vitalsForm.bloodPressure, icon: '❤' },
                          { label: 'Heart Rate (bpm)', value: vitalsForm.heartRate, icon: '💓' },
                          { label: 'Resp. Rate (/min)', value: vitalsForm.respiratoryRate, icon: '🫁' },
                          { label: 'Weight (kg)', value: vitalsForm.weight, icon: '⚖' },
                          { label: 'SpO2 (%)', value: vitalsForm.oxygenSaturation, icon: '🔵' },
                        ].map((vital) => (
                          <div key={vital.label} className="p-2 rounded-lg bg-muted/50 border">
                            <div className="text-xs text-muted-foreground">{vital.label}</div>
                            <div className="text-sm font-medium mt-0.5">{vital.value || '—'}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Vitals entered by nurse. Contact nursing staff to update.</p>
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
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={handleAddSoapNote}
                      disabled={!selectedVisit}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Add SOAP Note
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLabOrderModalOpen(true)}
                      disabled={selectedVisit.status !== 'in_consultation' && selectedVisit.status !== 'results_ready'}
                    >
                      <FlaskConical className="w-4 h-4 mr-2" />
                      Order Lab Tests
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPrescriptionModalOpen(true)}
                      disabled={selectedVisit.status !== 'in_consultation' && selectedVisit.status !== 'results_ready'}
                    >
                      <Pill className="w-4 h-4 mr-2" />
                      Prescribe Medication
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSaveVitalsAndSOAP}
                      disabled={updateVisit.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save SOAP Note
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setReferralOpen(true)}
                      disabled={selectedVisit.status !== 'in_consultation' && selectedVisit.status !== 'results_ready'}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Refer to Specialist
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setAdmitOpen(true)}
                      disabled={selectedVisit.status !== 'in_consultation' && selectedVisit.status !== 'results_ready'}
                    >
                      <BedDouble className="w-4 h-4 mr-2" />
                      Admit Patient
                    </Button>
                    <Button
                      onClick={handleCompleteVisit}
                      disabled={completeVisit.isPending || selectedVisit.status === 'awaiting_lab' || selectedVisit.status === 'awaiting_results'}
                      className="ml-auto"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Visit
                    </Button>
                  </div>
                </TabsContent>

                {/* SOAP Notes Tab */}
                <TabsContent value="soap" className="p-5 mt-0">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 border rounded-lg p-4 bg-muted/20">
                      <div>
                        <h3 className="font-semibold text-sm">SOAP Note Editor</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Save creates a clinical timeline note for follow-up, admission review, and future visits.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleAddSoapNote}>
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        New Note
                      </Button>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-blue-600">S - Subjective</Label>
                      <Textarea
                        value={soapForm.subjective}
                        onChange={(e) => setSoapForm({...soapForm, subjective: e.target.value})}
                        placeholder="Patient's description of symptoms, history of present illness..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-green-600">O - Objective</Label>
                      <Textarea
                        value={soapForm.objective}
                        onChange={(e) => setSoapForm({...soapForm, objective: e.target.value})}
                        placeholder="Physical exam findings, vitals, observations..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-purple-600">A - Assessment</Label>
                      <Textarea
                        value={soapForm.assessment}
                        onChange={(e) => setSoapForm({...soapForm, assessment: e.target.value})}
                        placeholder="Clinical impression, differential diagnosis..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-orange-600">P - Plan</Label>
                      <Textarea
                        value={soapForm.plan}
                        onChange={(e) => setSoapForm({...soapForm, plan: e.target.value})}
                        placeholder="Treatment plan, medications, follow-up..."
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Diagnosis</Label>
                      <Input
                        value={soapForm.diagnosis}
                        onChange={(e) => setSoapForm({...soapForm, diagnosis: e.target.value})}
                        placeholder="Primary diagnosis"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={handleSaveVitalsAndSOAP} disabled={updateVisit.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        Save SOAP Note
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Lab Results Tab */}
                <TabsContent value="lab-results" className="p-5 mt-0">
                  {labResults.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No lab results available yet</p>
                      <p className="text-xs mt-1">Results will appear here once verified by the lab</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Lab Results</h3>
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
            <div className="bg-card border rounded-xl shadow-sm flex flex-col items-center justify-center h-80 text-muted-foreground">
              <User className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No Patient Selected</p>
              <p className="text-sm mt-1">Select a patient from the queue to begin consultation</p>
            </div>
          )}
        </div>
      </div>

      {/* Lab Order Modal */}
      <Dialog open={labOrderModalOpen} onOpenChange={setLabOrderModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Order Lab Tests</DialogTitle>
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
                {filteredTests.map((test: Test) => (
                  <div
                    key={test._id}
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
                ))}
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
                      <div key={test._id} className="p-3 flex items-center justify-between">
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
                        <Button variant="ghost" size="sm" onClick={() => removeTestFromOrder(test._id)}>
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
            <Button variant="outline" onClick={() => setLabOrderModalOpen(false)}>Cancel</Button>
            <Button onClick={() => createLabOrder.mutate()} disabled={createLabOrder.isPending || selectedTests.length === 0}>
              {createLabOrder.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prescription Modal */}
      <Dialog open={prescriptionModalOpen} onOpenChange={setPrescriptionModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Prescribe Medication</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Medication Search */}
            <div>
              <Label className="text-sm font-medium">Search Medications</Label>
              <Input
                value={searchMedication}
                onChange={(e) => setSearchMedication(e.target.value)}
                placeholder="Search by medication name..."
                className="mt-1"
              />
              <ScrollArea className="h-48 mt-2 border rounded-lg">
                {filteredMedications.map((med: Medication) => (
                  <div
                    key={med._id}
                    className={cn(
                      "p-3 border-b last:border-b-0 flex items-center justify-between",
                      (med.stockQuantity || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "opacity-60 cursor-not-allowed bg-muted/20",
                    )}
                    onClick={() => (med.stockQuantity || 0) > 0 && addMedicationToPrescription(med)}
                  >
                    <div>
                      <p className="font-medium text-sm">{med.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {med.genericName} - {med.dosageForm} - Le {med.unitPrice?.toLocaleString()}
                      </p>
                      <p className={cn("text-xs mt-0.5", (med.stockQuantity || 0) > 0 ? "text-emerald-600" : "text-red-600")}>
                        {(med.stockQuantity || 0) > 0 ? `${med.stockQuantity} in stock` : 'Out of stock'}
                      </p>
                    </div>
                    {(med.stockQuantity || 0) > 0 ? <Plus className="w-4 h-4 text-muted-foreground" /> : <Badge variant="destructive">No stock</Badge>}
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
            <Button variant="outline" onClick={() => setPrescriptionModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createPrescription.mutate()}
              disabled={createPrescription.isPending || prescriptionItems.length === 0 || prescriptionItems.some(i => !i.dosage || !i.frequency || !i.duration)}
            >
              {createPrescription.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Create Prescription
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

