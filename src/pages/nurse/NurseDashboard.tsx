import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useCompleteTriage, useAwaitingTriage } from '@/hooks/useVisits';
import { useAdmissionsDashboard, useActiveAdmissions, useRecordMedication } from '@/hooks/useAdmissions';
import { useDoctors } from '@/hooks/useDoctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, FileText, Heart, HeartPulse,
  Loader2, LogOut, MessageSquare, Pill, Printer, Search, Settings, Stethoscope,
  Thermometer, UserPlus, X, AlertCircle, BedDouble, ChevronRight, ClipboardCheck,
  ShieldAlert, Bell, Bed,
} from 'lucide-react';
import {
  ESI_LEVELS,
  checkAbnormalVitals,
  patientName,
  triagePriorityFromEsi,
} from '@/components/nurse/nurseUtils';

const NAV_TABS = [
  { id: 'triage', label: 'Triage & Vitals' },
  { id: 'mar', label: 'MAR Schedule' },
  { id: 'observation', label: 'Observation' },
  { id: 'procedures', label: 'Procedures' },
] as const;

type NavTab = (typeof NAV_TABS)[number]['id'];

const PRIORITY_STYLES: Record<string, { bg: string; border: string; dot: string }> = {
  emergency: { bg: 'bg-red-50', border: 'border-l-red-600', dot: 'bg-red-600' },
  urgent:    { bg: 'bg-orange-50', border: 'border-l-orange-500', dot: 'bg-orange-500' },
  high:      { bg: 'bg-yellow-50', border: 'border-l-yellow-500', dot: 'bg-yellow-500' },
  normal:    { bg: 'bg-blue-50', border: 'border-l-blue-500', dot: 'bg-blue-500' },
  low:       { bg: 'bg-green-50', border: 'border-l-green-500', dot: 'bg-green-500' },
};

function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '??';
}

function esIColor(esi?: string) {
  const map: Record<string, string> = { '1': '#ef4444', '2': '#f97316', '3': '#eab308', '4': '#3b82f6', '5': '#22c55e' };
  return map[esi || '3'] || '#3b82f6';
}

// ─────────────────────────── Triage & Vitals Screen ───────────────────────────

function TriageVitalsScreen({ onSwitch }: { onSwitch: (tab: NavTab) => void }) {
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickAlert, setQuickAlert] = useState(false);
  const [triageForm, setTriageForm] = useState({
    temperature: '', heartRate: '', bloodPressureSystolic: '', bloodPressureDiastolic: '',
    respiratoryRate: '', weight: '', oxygenSaturation: '', height: '',
  });
  const [triageEsiLevel, setTriageEsiLevel] = useState('3');
  const [triageNotes, setTriageNotes] = useState('');
  const [assignedDoctor, setAssignedDoctor] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');

  const { data: triageQueue = [], isLoading: queueLoading } = useAwaitingTriage();
  const { data: doctors = [] } = useDoctors();
  const completeTriage = useCompleteTriage();

  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return triageQueue;
    const q = searchQuery.toLowerCase();
    return triageQueue.filter((v: any) => {
      const p = v.patient;
      const name = `${p?.firstName || ''} ${p?.lastName || ''}`.toLowerCase();
      const id = (p?.patientId || p?._id || '').toLowerCase();
      const complaint = (v.chiefComplaint || '').toLowerCase();
      return name.includes(q) || id.includes(q) || complaint.includes(q);
    });
  }, [triageQueue, searchQuery]);

  useEffect(() => {
    if (selectedVisit) {
      const v = triageQueue.find((t: any) => t._id === selectedVisit._id);
      if (v) {
        setChiefComplaint(v.chiefComplaint || '');
        if (v.vitals) {
          setTriageForm({
            temperature: v.vitals.temperature?.toString() || '',
            heartRate: v.vitals.heartRate?.toString() || '',
            bloodPressureSystolic: v.vitals.bloodPressureSystolic?.toString() || '',
            bloodPressureDiastolic: v.vitals.bloodPressureDiastolic?.toString() || '',
            respiratoryRate: v.vitals.respiratoryRate?.toString() || '',
            weight: v.vitals.weight?.toString() || '',
            oxygenSaturation: v.vitals.oxygenSaturation?.toString() || '',
            height: v.vitals.height?.toString() || '',
          });
        }
      }
    }
  }, [triageQueue, selectedVisit]);

  const abnormalAlerts = useMemo(() => checkAbnormalVitals(triageForm), [triageForm]);

  const handleSaveVitals = async () => {
    if (!selectedVisit) return;
    try {
      const vitals: Record<string, any> = {};
      Object.entries(triageForm).forEach(([k, v]) => { if (v) vitals[k] = parseFloat(v); });
      await completeTriage.mutateAsync({
        visitId: selectedVisit._id,
        vitals,
        triagePriority: triagePriorityFromEsi(triageEsiLevel),
        triageNotes,
        chiefComplaint,
        assignedDoctor: assignedDoctor || undefined,
      });
      toast.success('Triage completed — visit sent to doctor queue');
      setSelectedVisit(null);
      resetForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save vitals');
    }
  };

  const resetForm = () => {
    setTriageForm({ temperature: '', heartRate: '', bloodPressureSystolic: '', bloodPressureDiastolic: '',
      respiratoryRate: '', weight: '', oxygenSaturation: '', height: '' });
    setTriageEsiLevel('3');
    setTriageNotes('');
    setAssignedDoctor('');
    setChiefComplaint('');
  };

  const esiLevel = ESI_LEVELS.find(l => l.value === triageEsiLevel);

  return (
    <div className="flex h-full">
      {/* ── Left Panel: Triage Queue ── */}
      <div className="w-[380px] flex-shrink-0 border-r border-outline flex flex-col bg-white">
        <div className="p-4 border-b border-outline">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> Triage Queue
            </h2>
            <Badge variant={triageQueue.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
              {triageQueue.length} awaiting
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patient, ID, or complaint..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/40"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {queueLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mb-2" />
                <p className="text-sm">Loading queue...</p>
              </div>
            )}
            {!queueLoading && filteredQueue.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
                <p className="text-sm font-medium">All clear — no patients waiting</p>
              </div>
            )}
            {filteredQueue.map((visit: any) => {
              const patient = visit.patient || {};
              const isSelected = selectedVisit?._id === visit._id;
              const esi = visit.triagePriority;
              const pStyle = PRIORITY_STYLES[esi || 'normal'] || PRIORITY_STYLES.normal;
              return (
                <button
                  key={visit._id}
                  type="button"
                  onClick={() => { setSelectedVisit(visit); setChiefComplaint(visit.chiefComplaint || ''); }}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border-l-4 transition-all',
                    pStyle.border,
                    isSelected
                      ? 'bg-primary/5 border border-primary/30 shadow-sm'
                      : 'bg-white border border-outline/50 hover:bg-muted/30 hover:shadow-sm',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                      {getInitials(patient.firstName, patient.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {patientName(patient)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{patient.patientId || '—'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-2">
                        {visit.chiefComplaint || 'No complaint recorded'}
                      </p>
                      {patient.allergies?.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                          <span className="text-[10px] text-red-600 truncate">
                            {patient.allergies.slice(0, 2).join(', ')}
                            {patient.allergies.length > 2 && ` +${patient.allergies.length - 2}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: esIColor(esi) }} />
                      {isSelected && <ChevronRight className="w-4 h-4 text-primary" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-outline">
          <Button
            className="w-full bg-[#006194] hover:bg-[#004d76] text-white"
            onClick={() => onSwitch('mar')}
          >
            <Pill className="w-4 h-4 mr-2" /> View MAR Schedule
          </Button>
        </div>
      </div>

      {/* ── Center: Patient Header + Vitals Entry ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-low">
        {selectedVisit ? (
          <>
            {/* Patient Header Bar */}
            <div className="bg-white border-b border-outline px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {getInitials(selectedVisit.patient?.firstName, selectedVisit.patient?.lastName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground truncate">
                      {patientName(selectedVisit.patient)}
                    </h2>
                    <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 border-0">
                      #{selectedVisit.patient?.patientId || '—'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    {selectedVisit.chiefComplaint || 'No complaint'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedVisit(null); resetForm(); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Vitals Entry Form */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Chief Complaint */}
                <div className="bg-white rounded-2xl border border-outline p-5">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" /> Chief Complaint
                  </Label>
                  <Textarea
                    value={chiefComplaint}
                    onChange={e => setChiefComplaint(e.target.value)}
                    placeholder="Describe the patient's chief complaint..."
                    className="min-h-[70px] text-sm border-outline"
                  />
                </div>

                {/* Vitals Grid */}
                <div className="bg-white rounded-2xl border border-outline p-5">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                    <HeartPulse className="w-4 h-4 text-muted-foreground" /> Vital Signs
                  </Label>
                  <div className="grid grid-cols-3 gap-4">
                    <VitalInput icon={Thermometer} label="Temperature" unit="°C" value={triageForm.temperature}
                      onChange={v => setTriageForm(p => ({ ...p, temperature: v }))}
                      abnormal={abnormalAlerts.some(a => a.toLowerCase().includes('temp'))} />
                    <VitalInput icon={Heart} label="Heart Rate" unit="bpm" value={triageForm.heartRate}
                      onChange={v => setTriageForm(p => ({ ...p, heartRate: v }))}
                      abnormal={abnormalAlerts.some(a => a.toLowerCase().includes('tachycard') || a.toLowerCase().includes('bradycard'))} />
                    <VitalInput icon={Activity} label="SpO₂" unit="%" value={triageForm.oxygenSaturation}
                      onChange={v => setTriageForm(p => ({ ...p, oxygenSaturation: v }))}
                      abnormal={abnormalAlerts.some(a => a.toLowerCase().includes('spo'))} />
                    <VitalInput icon={Activity} label="Systolic BP" unit="mmHg" value={triageForm.bloodPressureSystolic}
                      onChange={v => setTriageForm(p => ({ ...p, bloodPressureSystolic: v }))} />
                    <VitalInput icon={Activity} label="Diastolic BP" unit="mmHg" value={triageForm.bloodPressureDiastolic}
                      onChange={v => setTriageForm(p => ({ ...p, bloodPressureDiastolic: v }))} />
                    <VitalInput icon={Activity} label="Respiratory Rate" unit="/min" value={triageForm.respiratoryRate}
                      onChange={v => setTriageForm(p => ({ ...p, respiratoryRate: v }))}
                      abnormal={abnormalAlerts.some(a => a.toLowerCase().includes('rr') || a.toLowerCase().includes('tachypnea'))} />
                    <VitalInput icon={Activity} label="Weight" unit="kg" value={triageForm.weight}
                      onChange={v => setTriageForm(p => ({ ...p, weight: v }))} />
                    <VitalInput icon={Activity} label="Height" unit="cm" value={triageForm.height}
                      onChange={v => setTriageForm(p => ({ ...p, height: v }))} />
                  </div>

                  {abnormalAlerts.length > 0 && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                      {abnormalAlerts.map((alert, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-red-700">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">{alert}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ESI Level */}
                <div className="bg-white rounded-2xl border border-outline p-5">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-muted-foreground" /> ESI Level
                  </Label>
                  <div className="flex gap-2">
                    {ESI_LEVELS.map(level => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setTriageEsiLevel(level.value)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-semibold text-white transition-all',
                          level.color,
                          triageEsiLevel === level.value
                            ? 'ring-2 ring-offset-2 ring-primary shadow-md scale-[1.03]'
                            : 'opacity-60 hover:opacity-100',
                        )}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                  {esiLevel && (
                    <p className="mt-2 text-xs text-muted-foreground">{esiLevel.desc}</p>
                  )}
                </div>

                {/* Doctor Assignment */}
                <div className="bg-white rounded-2xl border border-outline p-5">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                    <Stethoscope className="w-4 h-4 text-muted-foreground" /> Assign Doctor
                  </Label>
                  <Select value={assignedDoctor} onValueChange={setAssignedDoctor}>
                    <SelectTrigger className="h-10 text-sm border-outline">
                      <SelectValue placeholder="Select a doctor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doc: any) => (
                        <SelectItem key={doc._id} value={doc._id} className="text-sm">
                          Dr. {doc.fullName || doc.name || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Triage Notes */}
                <div className="bg-white rounded-2xl border border-outline p-5">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-muted-foreground" /> Triage Notes
                  </Label>
                  <Textarea
                    value={triageNotes}
                    onChange={e => setTriageNotes(e.target.value)}
                    placeholder="Additional notes for the doctor..."
                    className="min-h-[80px] text-sm border-outline"
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Bottom Action Bar */}
            <div className="border-t border-outline bg-white px-6 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {abnormalAlerts.length > 0
                    ? `${abnormalAlerts.length} abnormal vital${abnormalAlerts.length > 1 ? 's' : ''} detected`
                    : 'No abnormal vitals'}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedVisit(null); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#006194] hover:bg-[#004d76] text-white"
                    onClick={handleSaveVitals}
                    disabled={completeTriage.isPending}
                  >
                    {completeTriage.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Complete Triage
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-4">
              <Stethoscope className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Select a patient to begin triage</h3>
            <p className="text-sm text-muted-foreground">Choose a patient from the queue on the left to record vitals and assign ESI level</p>
          </div>
        )}
      </div>

      {/* ── Right Panel: Quick Actions ── */}
      <div className="w-[260px] flex-shrink-0 border-l border-outline bg-white flex flex-col">
        <div className="p-4 border-b border-outline">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" /> Quick Actions
          </h3>
        </div>
        <div className="p-4 space-y-3 flex-1">
          {selectedVisit ? (
            <>
              <Button variant="outline" className="w-full justify-start gap-2 h-11" onClick={() => onSwitch('mar')}>
                <Pill className="w-4 h-4" /> View MAR Schedule
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-11" onClick={() => setQuickAlert(true)}>
                <Bell className="w-4 h-4" /> Alert Doctor
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-11">
                <Printer className="w-4 h-4" /> Print Vitals Label
              </Button>
            </>
          ) : (
            <>
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Select a patient to enable actions</p>
              </div>
            </>
          )}
        </div>

        {/* Ward Load Summary */}
        <div className="p-4 border-t border-outline">
          <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Queue Summary</h4>
          <div className="space-y-2">
            {ESI_LEVELS.map(level => {
              const count = triageQueue.filter((v: any) => v.triagePriority === level.priority).length;
              return (
                <div key={level.value} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: esIColor(level.value) }} />
                  <span className="flex-1 text-muted-foreground">{level.label}</span>
                  <span className="font-mono text-xs font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alert Doctor Dialog */}
      <Dialog open={quickAlert} onOpenChange={setQuickAlert}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Alert Doctor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedVisit
              ? `Notify the assigned doctor about ${patientName(selectedVisit.patient)}?`
              : 'Select a patient first.'}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuickAlert(false)}>Cancel</Button>
            <Button size="sm" className="bg-[#006194] text-white" onClick={() => { toast.success('Doctor notified'); setQuickAlert(false); }}>
              Send Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────────────────── MAR Schedule Screen ────────────────────────────

function MarScheduleScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow'>('today');
  const [marDialogOpen, setMarDialogOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [administerNotes, setAdministerNotes] = useState('');

  const { data: activeAdmissions = [], isLoading: admissionsLoading } = useActiveAdmissions();
  const recordMedication = useRecordMedication(selectedAdmission?._id || '');

  const filteredAdmissions = useMemo(() => {
    if (!searchQuery.trim()) return activeAdmissions;
    const q = searchQuery.toLowerCase();
    return activeAdmissions.filter((a: any) => {
      const p = a.patient;
      const name = `${p?.firstName || ''} ${p?.lastName || ''}`.toLowerCase();
      return name.includes(q) || (a.admissionNumber || '').toLowerCase().includes(q);
    });
  }, [activeAdmissions, searchQuery]);

  const getMedications = (admission: any) => {
    const meds = admission.marOrders || admission.medicationOrders || [];
    return meds.filter((m: any) => m.status !== 'given' && m.status !== 'administered');
  };

  const handleAdminister = async () => {
    if (!selectedMed) return;
    try {
      await recordMedication.mutateAsync({
        medicationName: selectedMed.medicationName || selectedMed.name,
        dosage: selectedMed.dosage || '',
        route: selectedMed.route || 'PO',
        prescriptionId: selectedMed.prescriptionId,
        notes: administerNotes || undefined,
      });
      toast.success('Medication administered');
      setMarDialogOpen(false);
      setSelectedMed(null);
      setSelectedAdmission(null);
      setAdministerNotes('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record medication');
    }
  };

  const openMarDialog = (admission: any, med: any) => {
    setSelectedAdmission(admission);
    setSelectedMed(med);
    setAdministerNotes('');
    setMarDialogOpen(true);
  };

  const now = new Date();
  const currentHour = now.getHours();

  return (
    <div className="flex flex-col h-full bg-surface-low">
      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-outline px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#894d00]/10 flex items-center justify-center">
              <Pill className="w-5 h-5 text-[#894d00]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">MAR Schedule</h1>
              <p className="text-xs text-muted-foreground">
                {filteredAdmissions.length} active admission{filteredAdmissions.length !== 1 ? 's' : ''} · {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Day Tabs + Search */}
        <div className="flex items-center gap-3">
          <div className="flex bg-muted/50 rounded-xl p-0.5">
            {(['today', 'tomorrow'] as const).map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize',
                  selectedDay === day ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/40"
            />
          </div>
        </div>
      </div>

      {/* ── Timeline Grid ── */}
      <ScrollArea className="flex-1">
        {admissionsLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading admissions...
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
            <p className="font-medium">No active admissions</p>
            <p className="text-sm mt-1">All patients are up to date</p>
          </div>
        ) : (
          <div className="bg-white mx-4 my-4 rounded-xl border border-outline overflow-hidden">
            {/* Hour Headers */}
            <div className="flex border-b border-outline sticky top-0 bg-white z-10">
              <div className="w-[220px] flex-shrink-0 px-4 py-2.5 border-r border-outline">
                <span className="text-xs font-semibold text-muted-foreground">Patient</span>
              </div>
              <div className="flex-1 flex overflow-x-auto">
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = currentHour - 3 + i;
                  const displayHour = ((hour % 24) + 24) % 24;
                  const isPast = displayHour < currentHour;
                  const isCurrent = displayHour === currentHour;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex-1 min-w-[60px] px-2 py-2.5 border-r border-outline text-center',
                        isCurrent && 'bg-primary/5',
                      )}
                    >
                      <p className={cn('text-xs font-mono', isCurrent ? 'font-bold text-primary' : isPast ? 'text-muted-foreground' : 'text-foreground')}>
                        {String(displayHour).padStart(2, '0')}:00
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Patient Rows */}
            {filteredAdmissions.map((admission: any) => {
              const patient = admission.patient || {};
              const meds = getMedications(admission);
              const firstName = patient.firstName || '';
              const lastName = patient.lastName || '';
              const ward = admission.wardType || 'Unassigned';
              const bed = admission.bedNumber ? `Bed ${admission.bedNumber}` : '';

              return (
                <div key={admission._id} className="flex border-b border-outline last:border-0 hover:bg-muted/20 transition-colors">
                  {/* Patient Info */}
                  <div className="w-[220px] flex-shrink-0 px-4 py-3 border-r border-outline flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#006194]/10 flex items-center justify-center text-xs font-bold text-[#006194] flex-shrink-0">
                      {getInitials(firstName, lastName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{lastName}, {firstName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {ward}{bed ? ` · ${bed}` : ''} · #{admission.admissionNumber || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Medication Slots */}
                  <div className="flex-1 flex items-center overflow-x-auto">
                    {meds.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-3">
                        <span className="text-xs text-muted-foreground">No medications scheduled</span>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 flex-wrap">
                        {meds.map((med: any, idx: number) => {
                          const isDue = med.nextDue && new Date(med.nextDue) <= now;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => openMarDialog(admission, med)}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                                isDue
                                  ? 'bg-[#894d00]/5 border-[#894d00]/20 text-[#894d00] hover:bg-[#894d00]/10'
                                  : 'bg-muted/30 border-outline/50 text-muted-foreground hover:bg-muted/50',
                              )}
                            >
                              <Pill className="w-3 h-3" />
                              {med.medicationName || med.name || 'Med'}
                              {isDue && <span className="text-[10px] font-bold">DUE</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* ── MAR Administer Dialog ── */}
      <Dialog open={marDialogOpen} onOpenChange={setMarDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Administer Medication</DialogTitle>
          </DialogHeader>
          {selectedMed && selectedAdmission && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4 border border-outline">
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="text-sm font-semibold">{patientName(selectedAdmission.patient)}</p>
                <p className="text-xs text-muted-foreground mt-2">Medication</p>
                <p className="text-sm font-semibold">{selectedMed.medicationName || selectedMed.name}</p>
                <div className="flex gap-4 mt-2">
                  <div><p className="text-xs text-muted-foreground">Dose</p><p className="text-sm">{selectedMed.dosage || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Route</p><p className="text-sm">{selectedMed.route || 'PO'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Frequency</p><p className="text-sm">{selectedMed.frequency || '—'}</p></div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  value={administerNotes}
                  onChange={e => setAdministerNotes(e.target.value)}
                  placeholder="Any notes about administration..."
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMarDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-[#894d00] hover:bg-[#6b3a00] text-white"
              onClick={handleAdminister}
              disabled={recordMedication.isPending}
            >
              {recordMedication.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Administer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────── Shared: VitalInput Component ────────────────────────

function VitalInput({
  icon: Icon, label, unit, value, onChange, abnormal,
}: {
  icon: any; label: string; unit: string; value: string; onChange: (v: string) => void; abnormal?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step="0.1"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={unit}
          className={cn(
            'h-9 text-sm font-mono pr-10 border-outline',
            abnormal && 'border-red-400 bg-red-50 text-red-700 font-bold',
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
          {unit}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────── Main Dashboard Component ───────────────────────────

export default function NurseDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<NavTab>('triage');
  const { data: triageQueue = [] } = useAwaitingTriage();
  const { data: dashboard } = useAdmissionsDashboard(false);
  const stats = dashboard?.stats || { activeTotal: 0, todayAdmissions: 0, todayDischarges: 0, byWard: [] };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex flex-col bg-surface-low overflow-hidden">
      {/* ── Top App Bar ── */}
      <header className="bg-white border-b border-outline h-14 flex items-center px-6 flex-shrink-0 z-50">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#006194] flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight hidden sm:block">SierraEMR</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono hidden md:block">v2.4</span>

          <nav className="flex items-center gap-1 ml-6">
            {NAV_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#894d00]/10 flex items-center justify-center text-xs font-bold text-[#894d00]">
            {getInitials(profile?.fullName?.split(' ')[0], profile?.fullName?.split(' ')[1])}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-foreground leading-tight">{profile?.fullName}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Nurse</p>
          </div>
          <Button variant="ghost" size="sm" className="ml-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'triage' && <TriageVitalsScreen onSwitch={setActiveTab} />}
        {activeTab === 'mar' && <MarScheduleScreen />}
        {activeTab === 'observation' && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Bed className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Observation workspace</p>
              <p className="text-sm mt-1">Short-stay monitoring and repeat vitals</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/nurse/observation')}>
                Open Observation Ward
              </Button>
            </div>
          </div>
        )}
        {activeTab === 'procedures' && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Procedures workspace</p>
              <p className="text-sm mt-1">Ordered procedures, room prep, and procedure notes</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/nurse/procedures')}>
                Open Procedures
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


