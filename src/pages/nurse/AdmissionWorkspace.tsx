import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { prescriptionService } from '@/services/prescriptionService';
import { soapNoteService } from '@/services/soapNoteService';
import {
  useAdmission,
  useFluidBalance,
  useRecordVitals,
  useRecordMedication,
  useRecordFluid,
  useAddNursingNote,
  useAddShiftHandover,
  useAddCarePlanItem,
  useResolveCarePlanItem,
  useReportIncident,
  useTransferAdmission,
  useDischargeAdmission,
  useStartOxygenTherapy,
  useStopOxygenTherapy,
} from '@/hooks/useAdmissions';
import { useMyServicePrices } from '@/hooks/useServicePrices';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { VitalsTrends } from '@/components/doctor/VitalsTrends';

import {
  Activity, Pill, Droplet, FileText, ClipboardList, AlertTriangle,
  LogOut, ArrowRightLeft, Heart, Plus, Loader2, Save, Send, User,
  CheckCircle, Clock, Stethoscope, BedDouble, Handshake, Printer,
  Wind, Square,
} from 'lucide-react';

interface Props {
  admissionId: string;
  onClose?: () => void;
  onDischarged?: () => void;
}

type TabKey = 'overview' | 'clinical' | 'vitals' | 'meds' | 'fluids' | 'notes' | 'handover' | 'care-plan' | 'incidents';

export function AdmissionWorkspace({ admissionId, onClose, onDischarged }: Props) {
  const { data: admission, isLoading } = useAdmission(admissionId);
  const { data: fluidBalance } = useFluidBalance(admissionId);

  const recordVitals = useRecordVitals(admissionId);
  const recordMedication = useRecordMedication(admissionId);
  const recordFluid = useRecordFluid(admissionId);
  const addNote = useAddNursingNote(admissionId);
  const addHandover = useAddShiftHandover(admissionId);
  const addCarePlan = useAddCarePlanItem(admissionId);
  const resolveCarePlan = useResolveCarePlanItem(admissionId);
  const reportIncident = useReportIncident(admissionId);
  const transfer = useTransferAdmission(admissionId);
  const discharge = useDischargeAdmission(admissionId);
  const startOxygen = useStartOxygenTherapy(admissionId);
  const stopOxygen = useStopOxygenTherapy(admissionId);
  const { data: servicePrices = [] } = useMyServicePrices();

  const [tab, setTab] = useState<TabKey>('overview');

  // Modal states
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [medsOpen, setMedsOpen] = useState(false);
  const [fluidOpen, setFluidOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [carePlanOpen, setCarePlanOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [oxygenOpen, setOxygenOpen] = useState(false);

  // Forms
  const [vitalsForm, setVitalsForm] = useState({
    temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '',
    oxygenSaturation: '', painScale: '', bloodGlucose: '', consciousnessLevel: '', notes: '',
  });
  const [medForm, setMedForm] = useState({
    medicationName: '', dosage: '', route: 'PO', prescriptionId: '', medicationId: '', refused: false, refusalReason: '', notes: '',
  });
  const [fluidForm, setFluidForm] = useState({
    direction: 'intake' as 'intake' | 'output',
    fluidType: '', volumeMl: '', route: '', notes: '',
  });
  const [noteForm, setNoteForm] = useState({ subjective: '', objective: '', assessment: '', plan: '', narrative: '' });
  const [handoverForm, setHandoverForm] = useState({
    shift: 'morning',
    conditionSummary: '',
    latestVitalsSummary: '',
    pendingLabs: '',
    medicationsDue: '',
    fluidBalanceConcern: '',
    risksAndAllergies: '',
    tasksForNextShift: '',
    receivingNurse: '',
    notes: '',
  });
  const [carePlanForm, setCarePlanForm] = useState({
    problem: '', goal: '', interventions: '', evaluation: '',
  });
  const [incidentForm, setIncidentForm] = useState({
    incidentType: 'fall', description: '', severity: 'minor', actionTaken: '',
  });
  const [transferForm, setTransferForm] = useState({ wardType: '', bedNumber: '', notes: '' });
  const [dischargeForm, setDischargeForm] = useState({ dischargeDiagnosis: '', dischargeInstructions: '', dischargeNotes: '' });
  const [oxygenForm, setOxygenForm] = useState({ litersPerMinute: 5, hoursPerDay: 8, days: 7, notes: '' });
  const patientId = admission?.patientId?._id;
  const visitId = admission?.visitId;
  const oxygenHourlyRate = Array.isArray(servicePrices)
    ? Number(servicePrices.find((price: any) => price.code === 'oxygen_hour')?.amount || 200)
    : 200;

  const { data: patientPrescriptions = [] } = useQuery({
    queryKey: ['prescriptions', 'patient', patientId],
    queryFn: () => prescriptionService.findByPatient(patientId),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });

  // Fetch SOAP notes directly by visitId as a safety net.
  // The admission object already includes clinicalNotes from the backend,
  // but if the doctor wrote notes after the admission was loaded, this
  // separate query ensures the nurse always sees the latest notes.
  const { data: visitSoapNotes = [] } = useQuery({
    queryKey: ['soap-notes', 'visit', visitId],
    queryFn: () => soapNoteService.findByVisit(visitId!),
    enabled: !!visitId,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  // Also fetch by patient for any notes not linked to this visit
  const { data: patientSoapNotes = [] } = useQuery({
    queryKey: ['soap-notes', 'patient', patientId],
    queryFn: () => soapNoteService.findByPatient(patientId!),
    enabled: !!patientId,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  if (isLoading || !admission) {
    return (
      <div className="bg-card border rounded-xl shadow-sm flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const patient = admission.patientId;
  const vitalsLog = admission.vitalsLog || [];
  const medsLog = admission.medicationLog || [];
  const fluidsLog = admission.fluidBalance || [];
  const nursingNotes = admission.nursingNotes || [];

  // Merge clinical notes from three sources and deduplicate by _id:
  // 1. admission.clinicalNotes — fetched server-side when admission was loaded
  // 2. visitSoapNotes — direct query by visitId (catches notes added after load)
  // 3. patientSoapNotes — all notes for this patient (catches ward round notes)
  const allNotesMap = new Map<string, any>();
  for (const n of [...(admission.clinicalNotes || []), ...visitSoapNotes, ...patientSoapNotes]) {
    if (n?._id) allNotesMap.set(n._id.toString(), n);
  }
  const clinicalNotes = Array.from(allNotesMap.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const carePlan = admission.carePlan || [];
  const incidents = admission.incidents || [];
  const shiftHandovers = admission.shiftHandovers || [];

  // Helpers
  const latestVitals = vitalsLog[vitalsLog.length - 1];
  const activeCarePlanItems = carePlan.filter((c: any) => c.status === 'active');
  const prescribedMedicationItems = patientPrescriptions
    .filter((rx: any) => rx.status !== 'cancelled')
    .flatMap((rx: any) => (rx.items || []).map((item: any) => ({ ...item, prescriptionId: rx._id, prescriptionNumber: rx.prescriptionNumber })));

  const fmtTime = (d: string | Date) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Submit handlers
  const submitVitals = async () => {
    try {
      await recordVitals.mutateAsync({
        temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
        bloodPressure: vitalsForm.bloodPressure || undefined,
        heartRate: vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : undefined,
        respiratoryRate: vitalsForm.respiratoryRate ? parseInt(vitalsForm.respiratoryRate) : undefined,
        oxygenSaturation: vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation) : undefined,
        painScale: vitalsForm.painScale ? parseInt(vitalsForm.painScale) : undefined,
        bloodGlucose: vitalsForm.bloodGlucose ? parseFloat(vitalsForm.bloodGlucose) : undefined,
        consciousnessLevel: vitalsForm.consciousnessLevel || undefined,
        notes: vitalsForm.notes || undefined,
      });
      toast.success('Vitals recorded');
      setVitalsOpen(false);
      setVitalsForm({ temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '', oxygenSaturation: '', painScale: '', bloodGlucose: '', consciousnessLevel: '', notes: '' });
    } catch { toast.error('Failed to record vitals'); }
  };

  const submitMed = async () => {
    try {
      await recordMedication.mutateAsync(medForm);
      toast.success(medForm.refused ? 'Refusal recorded' : 'Medication administered');
      setMedsOpen(false);
      setMedForm({ medicationName: '', dosage: '', route: 'PO', prescriptionId: '', medicationId: '', refused: false, refusalReason: '', notes: '' });
    } catch { toast.error('Failed to record administration'); }
  };

  const submitFluid = async () => {
    try {
      await recordFluid.mutateAsync({
        direction: fluidForm.direction,
        fluidType: fluidForm.fluidType,
        volumeMl: parseInt(fluidForm.volumeMl),
        route: fluidForm.route || undefined,
        notes: fluidForm.notes || undefined,
      });
      toast.success('Fluid entry recorded');
      setFluidOpen(false);
      setFluidForm({ direction: fluidForm.direction, fluidType: '', volumeMl: '', route: '', notes: '' });
    } catch { toast.error('Failed to record fluid'); }
  };

  const submitNote = async () => {
    try {
      await addNote.mutateAsync(noteForm);
      toast.success('Nursing note saved');
      setNoteOpen(false);
      setNoteForm({ subjective: '', objective: '', assessment: '', plan: '', narrative: '' });
    } catch { toast.error('Failed to save note'); }
  };

  const submitHandover = async () => {
    try {
      await addHandover.mutateAsync(handoverForm);
      toast.success('Shift handover saved');
      setHandoverOpen(false);
      setHandoverForm({
        shift: handoverForm.shift,
        conditionSummary: '',
        latestVitalsSummary: '',
        pendingLabs: '',
        medicationsDue: '',
        fluidBalanceConcern: '',
        risksAndAllergies: '',
        tasksForNextShift: '',
        receivingNurse: '',
        notes: '',
      });
    } catch { toast.error('Failed to save handover'); }
  };

  const submitCarePlan = async () => {
    try {
      await addCarePlan.mutateAsync({
        problem: carePlanForm.problem,
        goal: carePlanForm.goal || undefined,
        interventions: carePlanForm.interventions.split('\n').map(s => s.trim()).filter(Boolean),
        evaluation: carePlanForm.evaluation || undefined,
      });
      toast.success('Care plan item added');
      setCarePlanOpen(false);
      setCarePlanForm({ problem: '', goal: '', interventions: '', evaluation: '' });
    } catch { toast.error('Failed to add care plan'); }
  };

  const submitIncident = async () => {
    try {
      await reportIncident.mutateAsync(incidentForm);
      toast.success('Incident reported');
      setIncidentOpen(false);
      setIncidentForm({ incidentType: 'fall', description: '', severity: 'minor', actionTaken: '' });
    } catch { toast.error('Failed to report incident'); }
  };

  const submitTransfer = async () => {
    try {
      await transfer.mutateAsync({
        wardType: transferForm.wardType || undefined,
        bedNumber: transferForm.bedNumber || undefined,
        notes: transferForm.notes || undefined,
      });
      toast.success('Patient transferred');
      setTransferOpen(false);
    } catch { toast.error('Failed to transfer'); }
  };

  const submitDischarge = async () => {
    try {
      await discharge.mutateAsync(dischargeForm);
      toast.success('Patient discharged');
      setDischargeOpen(false);
      onDischarged?.();
    } catch { toast.error('Failed to discharge'); }
  };

  const submitOxygen = async () => {
    try {
      const totalHours = oxygenForm.hoursPerDay * oxygenForm.days;
      const totalCost = totalHours * oxygenHourlyRate;
      await startOxygen.mutateAsync({
        litersPerMinute: oxygenForm.litersPerMinute,
        hoursPerDay: oxygenForm.hoursPerDay,
        days: oxygenForm.days,
        notes: oxygenForm.notes || undefined,
      });
      toast.success(`Oxygen therapy started — Le ${totalCost.toLocaleString()} (${totalHours}h × Le ${oxygenHourlyRate.toLocaleString()}/h)`);
      setOxygenOpen(false);
      setOxygenForm({ litersPerMinute: 5, hoursPerDay: 8, days: 7, notes: '' });
    } catch { toast.error('Failed to start oxygen therapy'); }
  };

  const handleStopOxygen = async (index: number) => {
    try {
      await stopOxygen.mutateAsync(index);
      toast.success('Oxygen therapy stopped');
    } catch { toast.error('Failed to stop oxygen therapy'); }
  };

  const oxygenTherapies = admission?.oxygenTherapy || [];
  const activeOxygen = oxygenTherapies.filter((t: any) => t.status === 'active');
  const totalOxygenCost = oxygenTherapies.reduce((sum: number, t: any) => sum + (t.totalCost || 0), 0);

  return (
    <div className="bg-card border rounded-xl shadow-sm">
      {/* Header: patient banner */}
      <div className="px-5 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {patient?.firstName} {patient?.lastName}
              </h2>
              <Badge variant="outline">{admission.admissionNumber}</Badge>
              <Badge className="bg-primary/80 capitalize">
                {admission.wardType}{admission.bedNumber ? ` · ${admission.bedNumber}` : ''}
              </Badge>
              {admission.codeStatus && admission.codeStatus !== 'full_code' && (
                <Badge variant="destructive" className="uppercase">{admission.codeStatus}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{patient?.patientId}</span>
              <span>·</span>
              <span>{patient?.gender || 'N/A'}</span>
              <span>·</span>
              <span>{patient?.age ? `${patient.age} yrs` : 'Age N/A'}</span>
              <span>·</span>
              <span>Admitted {fmtTime(admission.admittedAt)}</span>
            </div>
            {(admission.allergies?.length > 0 || patient?.allergies?.length > 0) && (
              <div className="flex items-center gap-1 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs text-red-600 font-medium">
                  Allergies: {[...(admission.allergies || []), ...(patient?.allergies || [])].filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                </span>
              </div>
            )}
            {admission.precautions?.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-amber-700 font-medium">
                  Precautions: {admission.precautions.join(', ')}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
              Transfer
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDischargeOpen(true)}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Discharge
            </Button>
            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <div className="px-5 pt-3 border-b overflow-x-auto">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Activity className="w-3.5 h-3.5 mr-1.5" />Overview
            </TabsTrigger>
            <TabsTrigger value="vitals" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Heart className="w-3.5 h-3.5 mr-1.5" />Vitals
              {vitalsLog.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 text-[10px]">{vitalsLog.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="clinical" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Stethoscope className="w-3.5 h-3.5 mr-1.5" />Clinical Notes
              {clinicalNotes.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 text-[10px]">{clinicalNotes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="meds" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Pill className="w-3.5 h-3.5 mr-1.5" />MAR
              {medsLog.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 text-[10px]">{medsLog.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="fluids" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Droplet className="w-3.5 h-3.5 mr-1.5" />Fluids
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <FileText className="w-3.5 h-3.5 mr-1.5" />Notes
              {nursingNotes.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 text-[10px]">{nursingNotes.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="handover" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Handshake className="w-3.5 h-3.5 mr-1.5" />Handover
              {shiftHandovers.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 text-[10px]">{shiftHandovers.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="care-plan" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />Care Plan
              {activeCarePlanItems.length > 0 && <Badge className="ml-1.5 h-4 min-w-4 text-[10px] bg-amber-500">{activeCarePlanItems.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="incidents" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Incidents
              {incidents.length > 0 && <Badge variant="destructive" className="ml-1.5 h-4 min-w-4 text-[10px]">{incidents.length}</Badge>}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ---------- Overview ---------- */}
        <TabsContent value="overview" className="p-5 mt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground">Admission Reason</p>
              <p className="text-sm font-medium mt-1">{admission.admissionReason}</p>
              {admission.diagnosis && (
                <>
                  <p className="text-xs text-muted-foreground mt-3">Diagnosis</p>
                  <p className="text-sm mt-1">{admission.diagnosis}</p>
                </>
              )}
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground">Latest Vitals</p>
              {latestVitals ? (
                <div className="mt-2 space-y-1 text-sm">
                  {latestVitals.temperature != null && <div>T: <span className="font-medium">{latestVitals.temperature}°C</span></div>}
                  {latestVitals.bloodPressure && <div>BP: <span className="font-medium">{latestVitals.bloodPressure}</span></div>}
                  {latestVitals.heartRate != null && <div>HR: <span className="font-medium">{latestVitals.heartRate} bpm</span></div>}
                  {latestVitals.oxygenSaturation != null && <div>SpO2: <span className="font-medium">{latestVitals.oxygenSaturation}%</span></div>}
                  <p className="text-xs text-muted-foreground mt-1">{fmtTime(latestVitals.recordedAt)}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">No vitals recorded</p>
              )}
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <p className="text-xs text-muted-foreground">Fluid Balance (24h)</p>
              {fluidBalance ? (
                <div className="mt-2 space-y-1 text-sm">
                  <div>Intake: <span className="font-medium text-green-600">+{fluidBalance.totalIntakeMl} mL</span></div>
                  <div>Output: <span className="font-medium text-blue-600">-{fluidBalance.totalOutputMl} mL</span></div>
                  <Separator className="my-1" />
                  <div>Net: <span className={cn('font-semibold', (fluidBalance.netMl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {(fluidBalance.netMl ?? 0) >= 0 ? '+' : ''}{fluidBalance.netMl} mL
                  </span></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">No entries</p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setVitalsOpen(true)}><Heart className="w-3.5 h-3.5 mr-1.5" />Record Vitals</Button>
            <Button size="sm" variant="outline" onClick={() => setMedsOpen(true)}><Pill className="w-3.5 h-3.5 mr-1.5" />Administer Med</Button>
            <Button size="sm" variant="outline" onClick={() => setFluidOpen(true)}><Droplet className="w-3.5 h-3.5 mr-1.5" />Record Fluid</Button>
            <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}><FileText className="w-3.5 h-3.5 mr-1.5" />Add Note</Button>
            <Button size="sm" variant="outline" onClick={() => setHandoverOpen(true)}><Handshake className="w-3.5 h-3.5 mr-1.5" />Shift Handover</Button>
            <Button size="sm" variant="outline" onClick={() => setCarePlanOpen(true)}><ClipboardList className="w-3.5 h-3.5 mr-1.5" />Add Care Plan</Button>
            <Button size="sm" variant="outline" onClick={() => setIncidentOpen(true)}><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Report Incident</Button>
            <Button size="sm" variant="outline" onClick={() => setOxygenOpen(true)}><Wind className="w-3.5 h-3.5 mr-1.5" />Oxygen Therapy</Button>
          </div>

          {/* Oxygen therapy summary */}
          {oxygenTherapies.length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-blue-500" />Oxygen Therapy
                  {activeOxygen.length > 0 && <Badge className="bg-blue-500 ml-1">{activeOxygen.length} active</Badge>}
                </p>
                <span className="text-sm font-medium">Total: Le {totalOxygenCost.toLocaleString()}</span>
              </div>
              <div className="space-y-2">
                {oxygenTherapies.map((t: any, i: number) => (
                  <div key={i} className={cn('flex items-center justify-between text-sm p-2 rounded', t.status === 'active' ? 'bg-blue-50' : 'bg-muted/50')}>
                    <div>
                      <span className="font-medium">{t.litersPerMinute} L/min</span>
                      <span className="text-muted-foreground mx-1.5">·</span>
                      <span>{t.hoursPerDay}h/day × {t.days} days</span>
                      <span className="text-muted-foreground mx-1.5">·</span>
                      <span className="font-medium">Le {(t.totalCost || 0).toLocaleString()}</span>
                      {t.status === 'stopped' && <Badge variant="secondary" className="ml-2">Stopped</Badge>}
                    </div>
                    {t.status === 'active' && (
                      <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => handleStopOxygen(i)}>
                        <Square className="w-3 h-3 mr-1" />Stop
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalOxygenCost > 0 && (
            <div className="border rounded-lg p-4 bg-amber-50">
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-amber-600" />Charges Summary
              </p>
              <div className="space-y-1 text-sm">
                {oxygenTherapies.filter((t: any) => t.status === 'active').length > 0 && (
                  <div className="flex justify-between">
                    <span>Oxygen Therapy ({oxygenTherapies.filter((t: any) => t.status === 'active').length} active)</span>
                    <span className="font-medium">Le {oxygenTherapies.filter((t: any) => t.status === 'active').reduce((s: number, t: any) => s + (t.totalCost || 0), 0).toLocaleString()}</span>
                  </div>
                )}
                {oxygenTherapies.filter((t: any) => t.status !== 'active').length > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Oxygen Therapy (completed/stopped)</span>
                    <span>Le {oxygenTherapies.filter((t: any) => t.status !== 'active').reduce((s: number, t: any) => s + (t.totalCost || 0), 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
                  <span>Total O2 Cost</span>
                  <span>Le {totalOxygenCost.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Charges will be billed at reception upon discharge. O2 rate: Le {oxygenHourlyRate.toLocaleString()}/hour.</p>
            </div>
          )}

          {activeCarePlanItems.length > 0 && (
            <div className="border rounded-lg p-4">
              <p className="text-sm font-semibold mb-2">Active Care Plan</p>
              <ul className="space-y-2">
                {activeCarePlanItems.slice(0, 3).map((item: any, i: number) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{item.problem}</span>
                    {item.goal && <span className="text-muted-foreground"> — goal: {item.goal}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* ---------- Clinical Notes Timeline ---------- */}
        <TabsContent value="clinical" className="p-5 mt-0 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Doctor and Nurse Clinical Notes</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Consultation SOAP, ward round notes, and nursing SOAP notes for this admission visit.
            </p>
          </div>
          {clinicalNotes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No clinical notes saved for this admission yet</div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3 pr-2">
                {clinicalNotes.map((note: any) => (
                  <div key={note._id} className="border rounded-lg p-4 bg-muted/10">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{String(note.noteType || '').replace(/_/g, ' ')}</Badge>
                        <p className="text-xs text-muted-foreground">
                          {note.doctorId?.fullName || note.nurseId?.fullName || note.nurseId?.fullName || 'Clinical staff'}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{fmtTime(note.createdAt)}</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      {note.chiefComplaint && <div><span className="font-semibold text-blue-600">S:</span> {note.chiefComplaint}</div>}
                      {note.historyPresentIllness && note.historyPresentIllness !== note.chiefComplaint && (
                        <div><span className="font-semibold text-blue-600">History:</span> {note.historyPresentIllness}</div>
                      )}
                      {note.physicalExamination && <div><span className="font-semibold text-green-600">O:</span> {note.physicalExamination}</div>}
                      {note.diagnosis && <div><span className="font-semibold text-purple-600">A:</span> {note.diagnosis}</div>}
                      {note.treatmentPlan && <div><span className="font-semibold text-orange-600">P:</span> {note.treatmentPlan}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ---------- Vitals ---------- */}
        <TabsContent value="vitals" className="p-5 mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Vital Signs Log</h3>
            <Button size="sm" onClick={() => setVitalsOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Record
            </Button>
          </div>
          {vitalsLog.length > 0 && (
            <VitalsTrends vitalsHistory={vitalsLog.map((v: any) => ({ ...v, date: v.recordedAt }))} />
          )}
          {vitalsLog.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No vitals recorded yet</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead>BP</TableHead>
                    <TableHead>HR</TableHead>
                    <TableHead>RR</TableHead>
                    <TableHead>SpO2</TableHead>
                    <TableHead>Pain</TableHead>
                    <TableHead>Glucose</TableHead>
                    <TableHead>LOC</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...vitalsLog].reverse().map((v: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(v.recordedAt)}</TableCell>
                      <TableCell>{v.temperature != null ? `${v.temperature}°` : '—'}</TableCell>
                      <TableCell>{v.bloodPressure || '—'}</TableCell>
                      <TableCell>{v.heartRate ?? '—'}</TableCell>
                      <TableCell>{v.respiratoryRate ?? '—'}</TableCell>
                      <TableCell>{v.oxygenSaturation != null ? `${v.oxygenSaturation}%` : '—'}</TableCell>
                      <TableCell>{v.painScale ?? '—'}</TableCell>
                      <TableCell>{v.bloodGlucose ?? '—'}</TableCell>
                      <TableCell>{v.consciousnessLevel || '—'}</TableCell>
                      <TableCell className="text-xs">{v.recordedBy?.fullName || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------- Medication Administration Record ---------- */}
        <TabsContent value="meds" className="p-5 mt-0">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">Medication Administration Record (MAR)</h3>
            <Button size="sm" onClick={() => setMedsOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Administer
            </Button>
          </div>
          {medsLog.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No medications administered yet</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Dose</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...medsLog].reverse().map((m: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(m.administeredAt)}</TableCell>
                      <TableCell className="font-medium">{m.medicationName}</TableCell>
                      <TableCell>{m.dosage}</TableCell>
                      <TableCell><Badge variant="outline">{m.route || '—'}</Badge></TableCell>
                      <TableCell>
                        {m.refused ? (
                          <Badge variant="destructive">Refused</Badge>
                        ) : (
                          <Badge className="bg-green-500">Given</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate">
                        {m.refused ? m.refusalReason : m.notes || '—'}
                      </TableCell>
                      <TableCell className="text-xs">{m.administeredBy?.fullName || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------- Fluid Balance ---------- */}
        <TabsContent value="fluids" className="p-5 mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Intake / Output Chart</h3>
            <Button size="sm" onClick={() => setFluidOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Entry
            </Button>
          </div>

          {fluidBalance && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-4 bg-green-50">
                  <p className="text-xs text-green-700">Total Intake</p>
                  <p className="text-xl font-semibold text-green-700">+{fluidBalance.totalIntakeMl} mL</p>
                </div>
                <div className="border rounded-lg p-4 bg-blue-50">
                  <p className="text-xs text-blue-700">Total Output</p>
                  <p className="text-xl font-semibold text-blue-700">-{fluidBalance.totalOutputMl} mL</p>
                </div>
                <div className={cn(
                  'border rounded-lg p-4',
                  (fluidBalance.netMl ?? 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50',
                )}>
                  <p className={cn('text-xs', (fluidBalance.netMl ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700')}>Net Balance</p>
                  <p className={cn(
                    'text-xl font-semibold',
                    (fluidBalance.netMl ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-700',
                  )}>
                    {(fluidBalance.netMl ?? 0) >= 0 ? '+' : ''}{fluidBalance.netMl} mL
                  </p>
                </div>
              </div>
              {(() => {
                const max = Math.max(Number(fluidBalance.totalIntakeMl || 0), Number(fluidBalance.totalOutputMl || 0), 1);
                const intakePct = (Number(fluidBalance.totalIntakeMl || 0) / max) * 100;
                const outputPct = (Number(fluidBalance.totalOutputMl || 0) / max) * 100;
                return (
                  <div className="border rounded-lg p-4 bg-muted/10">
                    <p className="text-xs text-muted-foreground mb-2">Intake vs Output</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-green-700 mb-0.5">
                          <span>Intake</span><span>{fluidBalance.totalIntakeMl} mL</span>
                        </div>
                        <div className="h-2 bg-green-100 rounded overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${intakePct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-blue-700 mb-0.5">
                          <span>Output</span><span>{fluidBalance.totalOutputMl} mL</span>
                        </div>
                        <div className="h-2 bg-blue-100 rounded overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${outputPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {fluidsLog.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No fluid entries yet</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Fluid</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...fluidsLog].reverse().map((f: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(f.recordedAt)}</TableCell>
                      <TableCell>
                        <Badge className={cn(f.direction === 'intake' ? 'bg-green-500' : 'bg-blue-500')}>
                          {f.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{f.fluidType}</TableCell>
                      <TableCell className="text-right font-medium">
                        {f.direction === 'intake' ? '+' : '-'}{f.volumeMl} mL
                      </TableCell>
                      <TableCell>{f.route || '—'}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{f.notes || '—'}</TableCell>
                      <TableCell className="text-xs">{f.recordedBy?.fullName || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------- Nursing Notes (SOAP) ---------- */}
        <TabsContent value="notes" className="p-5 mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Nursing Notes</h3>
            <Button size="sm" onClick={() => setNoteOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Note
            </Button>
          </div>
          {nursingNotes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No notes yet</div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3 pr-2">
                {[...nursingNotes].reverse().map((n: any, i: number) => (
                  <div key={i} className="border rounded-lg p-4 bg-muted/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">{fmtTime(n.authoredAt)}</p>
                      <p className="text-xs font-medium">{n.authoredBy?.fullName || ''}</p>
                    </div>
                    {n.narrative ? (
                      <p className="text-sm whitespace-pre-line">{n.narrative}</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {n.subjective && <div><span className="font-semibold text-blue-600">S:</span> {n.subjective}</div>}
                        {n.objective && <div><span className="font-semibold text-green-600">O:</span> {n.objective}</div>}
                        {n.assessment && <div><span className="font-semibold text-purple-600">A:</span> {n.assessment}</div>}
                        {n.plan && <div><span className="font-semibold text-orange-600">P:</span> {n.plan}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ---------- Shift Handover ---------- */}
        <TabsContent value="handover" className="p-5 mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-sm">Shift Handover</h3>
              <p className="text-xs text-muted-foreground mt-1">Structured handoff for the next nursing team.</p>
            </div>
            <div className="flex gap-2">
              {shiftHandovers.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => {
                  const printable = document.getElementById('handover-print-area');
                  if (!printable) return;
                  const win = window.open('', '_blank', 'width=800,height=900');
                  if (!win) return;
                  win.document.write(`<!doctype html><html><head><title>Handover - ${patientName(patient)} - ${admission?.admissionNumber}</title>
                    <style>
                      body{font-family:Arial,sans-serif;padding:24px;color:#000}
                      h1{font-size:18px;margin:0 0 4px 0}
                      h2{font-size:14px;margin:18px 0 4px 0;border-bottom:1px solid #ccc;padding-bottom:2px}
                      .meta{font-size:11px;color:#555;margin-bottom:12px}
                      .handover{border:1px solid #ddd;padding:12px;margin-bottom:12px;border-radius:4px;page-break-inside:avoid}
                      .label{font-weight:bold}
                      .row{margin:2px 0}
                      .badge{display:inline-block;padding:2px 6px;background:#eef;color:#225;border-radius:3px;font-size:10px;text-transform:uppercase}
                    </style></head><body>
                    <h1>Shift Handover Note</h1>
                    <div class="meta">${patientName(patient)} - ${admission?.admissionNumber} - ${admissionLocation(admission)} - Printed ${new Date().toLocaleString()}</div>
                    ${printable.innerHTML}
                    </body></html>`);
                  win.document.close();
                  win.focus();
                  setTimeout(() => { win.print(); }, 300);
                }}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />Print
                </Button>
              )}
              <Button size="sm" onClick={() => setHandoverOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Add Handover
              </Button>
            </div>
          </div>
          <div id="handover-print-area">
            {shiftHandovers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No shift handovers recorded yet</div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3 pr-2">
                  {[...shiftHandovers].reverse().map((h: any, i: number) => (
                    <div key={i} className="border rounded-lg p-4 bg-muted/10">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className="capitalize">{h.shift}</Badge>
                          <p className="text-xs text-muted-foreground">To: {h.receivingNurse || 'Next shift'}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{fmtTime(h.handedOverAt)}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {h.conditionSummary && <div><span className="font-semibold">Condition:</span> {h.conditionSummary}</div>}
                        {h.latestVitalsSummary && <div><span className="font-semibold">Vitals:</span> {h.latestVitalsSummary}</div>}
                        {h.pendingLabs && <div><span className="font-semibold">Pending labs:</span> {h.pendingLabs}</div>}
                        {h.medicationsDue && <div><span className="font-semibold">Meds due:</span> {h.medicationsDue}</div>}
                        {h.fluidBalanceConcern && <div><span className="font-semibold">Fluids:</span> {h.fluidBalanceConcern}</div>}
                        {h.risksAndAllergies && <div><span className="font-semibold">Risks/allergies:</span> {h.risksAndAllergies}</div>}
                      </div>
                      {h.tasksForNextShift && <p className="text-sm mt-3"><span className="font-semibold">Tasks:</span> {h.tasksForNextShift}</p>}
                      {h.notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{h.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-3">Handed over by {h.handedOverBy?.fullName || 'Nurse'}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        {/* ---------- Care Plan ---------- */}
        <TabsContent value="care-plan" className="p-5 mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Nursing Care Plan</h3>
            <Button size="sm" onClick={() => setCarePlanOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Item
            </Button>
          </div>
          {carePlan.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No care plan items yet</div>
          ) : (
            <div className="space-y-3">
              {carePlan.map((item: any, i: number) => (
                <div key={i} className={cn(
                  'border rounded-lg p-4',
                  item.status === 'resolved' && 'bg-muted/30 opacity-70',
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{item.problem}</p>
                        <Badge variant={item.status === 'resolved' ? 'outline' : 'default'} className={cn(
                          item.status === 'active' && 'bg-amber-500',
                          item.status === 'ongoing' && 'bg-blue-500',
                        )}>{item.status}</Badge>
                      </div>
                      {item.goal && <p className="text-sm text-muted-foreground mt-1">Goal: {item.goal}</p>}
                      {item.interventions?.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-sm">
                          {item.interventions.map((intv: string, j: number) => (
                            <li key={j} className="text-muted-foreground">• {intv}</li>
                          ))}
                        </ul>
                      )}
                      {item.evaluation && (
                        <p className="text-sm mt-2 italic text-muted-foreground">Evaluation: {item.evaluation}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Added {fmtTime(item.createdAt)} by {item.createdBy?.fullName || '—'}
                      </p>
                    </div>
                    {item.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                        onClick={async () => {
                          const evaluation = prompt('Evaluation (optional):') || undefined;
                          try {
                            await resolveCarePlan.mutateAsync({ index: i, evaluation });
                            toast.success('Item resolved');
                          } catch { toast.error('Failed'); }
                        }}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Resolve
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------- Incidents ---------- */}
        <TabsContent value="incidents" className="p-5 mt-0 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Incident Reports</h3>
            <Button size="sm" variant="destructive" onClick={() => setIncidentOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Report Incident
            </Button>
          </div>
          {incidents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No incidents reported</div>
          ) : (
            <div className="space-y-3">
              {[...incidents].reverse().map((inc: any, i: number) => (
                <div key={i} className={cn(
                  'border-l-4 border rounded-lg p-4',
                  inc.severity === 'severe' && 'border-l-red-600 bg-red-50',
                  inc.severity === 'moderate' && 'border-l-amber-500 bg-amber-50',
                  inc.severity === 'minor' && 'border-l-blue-500 bg-blue-50',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        inc.severity === 'severe' && 'bg-red-600',
                        inc.severity === 'moderate' && 'bg-amber-500',
                        inc.severity === 'minor' && 'bg-blue-500',
                      )}>{inc.severity}</Badge>
                      <span className="text-sm font-semibold capitalize">{inc.incidentType.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtTime(inc.occurredAt)}</p>
                  </div>
                  <p className="text-sm">{inc.description}</p>
                  {inc.actionTaken && (
                    <p className="text-sm text-muted-foreground mt-2">Action: {inc.actionTaken}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Reported by {inc.reportedBy?.fullName || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------- Modals ---------- */}
      {/* Vitals */}
      <Dialog open={vitalsOpen} onOpenChange={setVitalsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Record Vital Signs</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Temperature (°C)</Label><Input value={vitalsForm.temperature} onChange={(e) => setVitalsForm({...vitalsForm, temperature: e.target.value})} placeholder="36.5" className="h-8" /></div>
            <div><Label className="text-xs">Blood Pressure</Label><Input value={vitalsForm.bloodPressure} onChange={(e) => setVitalsForm({...vitalsForm, bloodPressure: e.target.value})} placeholder="120/80" className="h-8" /></div>
            <div><Label className="text-xs">Heart Rate</Label><Input value={vitalsForm.heartRate} onChange={(e) => setVitalsForm({...vitalsForm, heartRate: e.target.value})} placeholder="72" className="h-8" /></div>
            <div><Label className="text-xs">Resp. Rate</Label><Input value={vitalsForm.respiratoryRate} onChange={(e) => setVitalsForm({...vitalsForm, respiratoryRate: e.target.value})} placeholder="16" className="h-8" /></div>
            <div><Label className="text-xs">SpO2 (%)</Label><Input value={vitalsForm.oxygenSaturation} onChange={(e) => setVitalsForm({...vitalsForm, oxygenSaturation: e.target.value})} placeholder="98" className="h-8" /></div>
            <div><Label className="text-xs">Pain (0-10)</Label><Input value={vitalsForm.painScale} onChange={(e) => setVitalsForm({...vitalsForm, painScale: e.target.value})} placeholder="0" className="h-8" /></div>
            <div><Label className="text-xs">Blood Glucose (mmol/L)</Label><Input value={vitalsForm.bloodGlucose} onChange={(e) => setVitalsForm({...vitalsForm, bloodGlucose: e.target.value})} placeholder="5.5" className="h-8" /></div>
            <div>
              <Label className="text-xs">LOC (AVPU or GCS)</Label>
              <Select value={vitalsForm.consciousnessLevel} onValueChange={(v) => setVitalsForm({...vitalsForm, consciousnessLevel: v})}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Alert" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alert">Alert</SelectItem>
                  <SelectItem value="Voice">Voice responsive</SelectItem>
                  <SelectItem value="Pain">Pain responsive</SelectItem>
                  <SelectItem value="Unresponsive">Unresponsive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={vitalsForm.notes} onChange={(e) => setVitalsForm({...vitalsForm, notes: e.target.value})} rows={2} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVitalsOpen(false)}>Cancel</Button>
            <Button onClick={submitVitals} disabled={recordVitals.isPending}>
              {recordVitals.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medications */}
      <Dialog open={medsOpen} onOpenChange={setMedsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Administer Medication</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {prescribedMedicationItems.length > 0 && (
              <div>
                <Label>Medication Chart From Prescriptions</Label>
                <div className="mt-2 max-h-36 overflow-y-auto border rounded-lg divide-y">
                  {prescribedMedicationItems.map((item: any, index: number) => (
                    <button
                      key={`${item.prescriptionId}-${index}`}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/50"
                      onClick={() => setMedForm({
                        ...medForm,
                        medicationName: item.medicationName,
                        dosage: item.dosage,
                        prescriptionId: item.prescriptionId,
                        medicationId: typeof item.medicationId === 'object' ? item.medicationId?._id : item.medicationId || '',
                      })}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.medicationName}</p>
                          <p className="text-xs text-muted-foreground">{item.dosage} - {item.frequency} - {item.duration}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{item.prescriptionNumber}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div><Label>Medication</Label><Input value={medForm.medicationName} onChange={(e) => setMedForm({...medForm, medicationName: e.target.value})} placeholder="e.g., Paracetamol 500mg" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dose</Label><Input value={medForm.dosage} onChange={(e) => setMedForm({...medForm, dosage: e.target.value})} placeholder="500mg" /></div>
              <div>
                <Label>Route</Label>
                <Select value={medForm.route} onValueChange={(v) => setMedForm({...medForm, route: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PO">PO (oral)</SelectItem>
                    <SelectItem value="IV">IV</SelectItem>
                    <SelectItem value="IM">IM</SelectItem>
                    <SelectItem value="SC">SC</SelectItem>
                    <SelectItem value="PR">PR (rectal)</SelectItem>
                    <SelectItem value="topical">Topical</SelectItem>
                    <SelectItem value="inhalation">Inhalation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <input type="checkbox" id="refused" checked={medForm.refused} onChange={(e) => setMedForm({...medForm, refused: e.target.checked})} />
              <Label htmlFor="refused" className="cursor-pointer">Patient refused / not given</Label>
            </div>
            {medForm.refused && (
              <div><Label>Reason for refusal</Label><Input value={medForm.refusalReason} onChange={(e) => setMedForm({...medForm, refusalReason: e.target.value})} /></div>
            )}
            <div><Label>Notes</Label><Textarea value={medForm.notes} onChange={(e) => setMedForm({...medForm, notes: e.target.value})} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedsOpen(false)}>Cancel</Button>
            <Button onClick={submitMed} disabled={recordMedication.isPending || !medForm.medicationName || !medForm.dosage}>
              {recordMedication.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pill className="w-4 h-4 mr-2" />}Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fluid */}
      <Dialog open={fluidOpen} onOpenChange={setFluidOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Fluid</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Direction</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={() => setFluidForm({...fluidForm, direction: 'intake'})} className={cn('px-4 py-2 rounded-lg border-2 text-sm font-medium', fluidForm.direction === 'intake' ? 'bg-green-500 text-white border-transparent' : 'border-border')}>Intake</button>
                <button type="button" onClick={() => setFluidForm({...fluidForm, direction: 'output'})} className={cn('px-4 py-2 rounded-lg border-2 text-sm font-medium', fluidForm.direction === 'output' ? 'bg-blue-500 text-white border-transparent' : 'border-border')}>Output</button>
              </div>
            </div>
            <div><Label>Fluid Type</Label><Input value={fluidForm.fluidType} onChange={(e) => setFluidForm({...fluidForm, fluidType: e.target.value})} placeholder={fluidForm.direction === 'intake' ? 'e.g., Normal saline IV, oral water' : 'e.g., urine, vomitus'} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Volume (mL)</Label><Input type="number" value={fluidForm.volumeMl} onChange={(e) => setFluidForm({...fluidForm, volumeMl: e.target.value})} placeholder="250" /></div>
              <div><Label>Route</Label><Input value={fluidForm.route} onChange={(e) => setFluidForm({...fluidForm, route: e.target.value})} placeholder="PO / IV / urinary" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={fluidForm.notes} onChange={(e) => setFluidForm({...fluidForm, notes: e.target.value})} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFluidOpen(false)}>Cancel</Button>
            <Button onClick={submitFluid} disabled={recordFluid.isPending || !fluidForm.fluidType || !fluidForm.volumeMl}>
              {recordFluid.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Droplet className="w-4 h-4 mr-2" />}Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nursing note */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nursing Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Use SOAP format or narrative. Either is saved.</p>
            <div><Label className="text-blue-600">S — Subjective</Label><Textarea value={noteForm.subjective} onChange={(e) => setNoteForm({...noteForm, subjective: e.target.value})} rows={2} placeholder="What patient reports/complains of..." /></div>
            <div><Label className="text-green-600">O — Objective</Label><Textarea value={noteForm.objective} onChange={(e) => setNoteForm({...noteForm, objective: e.target.value})} rows={2} placeholder="Observable findings, vitals trend, behaviour..." /></div>
            <div><Label className="text-purple-600">A — Assessment</Label><Textarea value={noteForm.assessment} onChange={(e) => setNoteForm({...noteForm, assessment: e.target.value})} rows={2} placeholder="Clinical judgment, priority..." /></div>
            <div><Label className="text-orange-600">P — Plan</Label><Textarea value={noteForm.plan} onChange={(e) => setNoteForm({...noteForm, plan: e.target.value})} rows={2} placeholder="Interventions, monitoring plan..." /></div>
            <Separator />
            <div><Label>Or narrative note</Label><Textarea value={noteForm.narrative} onChange={(e) => setNoteForm({...noteForm, narrative: e.target.value})} rows={3} placeholder="Free-text narrative..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button onClick={submitNote} disabled={addNote.isPending}>
              {addNote.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Handover */}
      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Shift Handover</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Shift</Label>
                <Select value={handoverForm.shift} onValueChange={(v) => setHandoverForm({ ...handoverForm, shift: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Receiving Nurse / Team</Label><Input value={handoverForm.receivingNurse} onChange={(e) => setHandoverForm({ ...handoverForm, receivingNurse: e.target.value })} placeholder="Next nurse/team" /></div>
            </div>
            <div><Label>Condition Summary</Label><Textarea value={handoverForm.conditionSummary} onChange={(e) => setHandoverForm({ ...handoverForm, conditionSummary: e.target.value })} rows={2} placeholder="Current condition, response to treatment..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Latest Vitals</Label><Textarea value={handoverForm.latestVitalsSummary} onChange={(e) => setHandoverForm({ ...handoverForm, latestVitalsSummary: e.target.value })} rows={2} /></div>
              <div><Label>Pending Labs / Results</Label><Textarea value={handoverForm.pendingLabs} onChange={(e) => setHandoverForm({ ...handoverForm, pendingLabs: e.target.value })} rows={2} /></div>
              <div><Label>Medications Due</Label><Textarea value={handoverForm.medicationsDue} onChange={(e) => setHandoverForm({ ...handoverForm, medicationsDue: e.target.value })} rows={2} /></div>
              <div><Label>Fluid Balance Concern</Label><Textarea value={handoverForm.fluidBalanceConcern} onChange={(e) => setHandoverForm({ ...handoverForm, fluidBalanceConcern: e.target.value })} rows={2} /></div>
            </div>
            <div><Label>Risks / Allergies</Label><Textarea value={handoverForm.risksAndAllergies} onChange={(e) => setHandoverForm({ ...handoverForm, risksAndAllergies: e.target.value })} rows={2} placeholder="Falls risk, allergy warning, isolation, oxygen..." /></div>
            <div><Label>Tasks For Next Shift</Label><Textarea value={handoverForm.tasksForNextShift} onChange={(e) => setHandoverForm({ ...handoverForm, tasksForNextShift: e.target.value })} rows={3} placeholder="What must be done or watched next..." /></div>
            <div><Label>Additional Notes</Label><Textarea value={handoverForm.notes} onChange={(e) => setHandoverForm({ ...handoverForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoverOpen(false)}>Cancel</Button>
            <Button onClick={submitHandover} disabled={addHandover.isPending || !handoverForm.shift}>
              {addHandover.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Handshake className="w-4 h-4 mr-2" />}Save Handover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Care plan */}
      <Dialog open={carePlanOpen} onOpenChange={setCarePlanOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Add Care Plan Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Problem / Diagnosis *</Label><Input value={carePlanForm.problem} onChange={(e) => setCarePlanForm({...carePlanForm, problem: e.target.value})} placeholder="e.g., Risk of pressure ulcer" /></div>
            <div><Label>Goal</Label><Input value={carePlanForm.goal} onChange={(e) => setCarePlanForm({...carePlanForm, goal: e.target.value})} placeholder="e.g., Skin remains intact throughout admission" /></div>
            <div><Label>Interventions (one per line)</Label>
              <Textarea
                value={carePlanForm.interventions}
                onChange={(e) => setCarePlanForm({...carePlanForm, interventions: e.target.value})}
                rows={4}
                placeholder={'Turn patient every 2h\nInspect skin daily\nKeep linens dry'}
              /></div>
            <div><Label>Evaluation</Label><Input value={carePlanForm.evaluation} onChange={(e) => setCarePlanForm({...carePlanForm, evaluation: e.target.value})} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCarePlanOpen(false)}>Cancel</Button>
            <Button onClick={submitCarePlan} disabled={addCarePlan.isPending || !carePlanForm.problem}>
              {addCarePlan.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident */}
      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={incidentForm.incidentType} onValueChange={(v) => setIncidentForm({...incidentForm, incidentType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fall">Fall</SelectItem>
                    <SelectItem value="medication_error">Medication error</SelectItem>
                    <SelectItem value="pressure_ulcer">Pressure ulcer</SelectItem>
                    <SelectItem value="equipment_failure">Equipment failure</SelectItem>
                    <SelectItem value="aggression">Aggression</SelectItem>
                    <SelectItem value="elopement">Elopement</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={incidentForm.severity} onValueChange={(v) => setIncidentForm({...incidentForm, severity: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description *</Label><Textarea value={incidentForm.description} onChange={(e) => setIncidentForm({...incidentForm, description: e.target.value})} rows={3} /></div>
            <div><Label>Action Taken</Label><Textarea value={incidentForm.actionTaken} onChange={(e) => setIncidentForm({...incidentForm, actionTaken: e.target.value})} rows={2} placeholder="Who was informed, what was done..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitIncident} disabled={reportIncident.isPending || !incidentForm.description}>
              {reportIncident.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transfer Patient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New Ward (optional)</Label>
              <Select value={transferForm.wardType} onValueChange={(v) => setTransferForm({...transferForm, wardType: v})}>
                <SelectTrigger><SelectValue placeholder="Keep current" /></SelectTrigger>
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
            <div><Label>New Bed Number</Label><Input value={transferForm.bedNumber} onChange={(e) => setTransferForm({...transferForm, bedNumber: e.target.value})} /></div>
            <div><Label>Reason / Handoff</Label><Textarea value={transferForm.notes} onChange={(e) => setTransferForm({...transferForm, notes: e.target.value})} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={submitTransfer} disabled={transfer.isPending}>
              {transfer.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge */}
      <Dialog open={dischargeOpen} onOpenChange={setDischargeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Discharge Patient</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Discharge Diagnosis</Label><Input value={dischargeForm.dischargeDiagnosis} onChange={(e) => setDischargeForm({...dischargeForm, dischargeDiagnosis: e.target.value})} /></div>
            <div><Label>Discharge Instructions (for patient)</Label><Textarea value={dischargeForm.dischargeInstructions} onChange={(e) => setDischargeForm({...dischargeForm, dischargeInstructions: e.target.value})} rows={4} placeholder="Medication, follow-up, activity restrictions, warning signs..." /></div>
            <div><Label>Internal Notes</Label><Textarea value={dischargeForm.dischargeNotes} onChange={(e) => setDischargeForm({...dischargeForm, dischargeNotes: e.target.value})} rows={2} /></div>
            {totalOxygenCost > 0 && (
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                  <Wind className="w-4 h-4" />Oxygen Therapy Charges: Le {totalOxygenCost.toLocaleString()}
                </p>
                <p className="text-xs text-amber-700 mt-1">Bill at reception upon discharge. O2 rate: Le {oxygenHourlyRate.toLocaleString()}/hour.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDischargeOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitDischarge} disabled={discharge.isPending}>
              {discharge.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}Discharge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Oxygen Therapy */}
      <Dialog open={oxygenOpen} onOpenChange={setOxygenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-blue-500" />Start Oxygen Therapy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Flow Rate (L/min)</Label>
                <Input type="number" min="0.1" step="0.1" value={oxygenForm.litersPerMinute} onChange={(e) => setOxygenForm({...oxygenForm, litersPerMinute: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Hours/Day</Label>
                <Input type="number" min="1" max="24" step="0.5" value={oxygenForm.hoursPerDay} onChange={(e) => setOxygenForm({...oxygenForm, hoursPerDay: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Days</Label>
                <Input type="number" min="0.5" step="0.5" value={oxygenForm.days} onChange={(e) => setOxygenForm({...oxygenForm, days: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <div className="flex justify-between">
                <span>Total hours: <strong>{oxygenForm.hoursPerDay * oxygenForm.days}h</strong></span>
                <span>Rate: <strong>Le {oxygenHourlyRate.toLocaleString()}/hour</strong></span>
              </div>
              <div className="text-lg font-bold text-blue-700 mt-1">
                Estimated cost: Le {(oxygenForm.hoursPerDay * oxygenForm.days * oxygenHourlyRate).toLocaleString()}
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={oxygenForm.notes} onChange={(e) => setOxygenForm({...oxygenForm, notes: e.target.value})} rows={2} placeholder="e.g., Post-surgical O2 support, pneumonia..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOxygenOpen(false)}>Cancel</Button>
            <Button onClick={submitOxygen} disabled={startOxygen.isPending || oxygenForm.litersPerMinute <= 0 || oxygenForm.hoursPerDay <= 0 || oxygenForm.hoursPerDay > 24 || oxygenForm.days <= 0}>
              {startOxygen.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wind className="w-4 h-4 mr-2" />}Start O2 Therapy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
