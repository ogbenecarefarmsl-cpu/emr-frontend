import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useAwaitingTriage, useCompleteTriage } from '@/hooks/useVisits';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';
import { AdmissionWorkspace } from './AdmissionWorkspace';

// UI
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Icons
import {
  Heart, AlertTriangle, BedDouble, Users, ClipboardCheck, Clock,
  Send, Loader2, Inbox, Stethoscope, LogOut as LogOutIcon,
  ChevronRight, Activity, Thermometer, Pill, AlertCircle,
} from 'lucide-react';

const ESI_LEVELS = [
  { value: '1', label: 'ESI 1', color: 'bg-red-600', desc: 'Resuscitation — immediate life-saving' },
  { value: '2', label: 'ESI 2', color: 'bg-orange-500', desc: 'Emergent — high risk, confused/lethargic' },
  { value: '3', label: 'ESI 3', color: 'bg-yellow-500', desc: 'Urgent — multiple resources needed' },
  { value: '4', label: 'ESI 4', color: 'bg-blue-500', desc: 'Less urgent — one resource needed' },
  { value: '5', label: 'ESI 5', color: 'bg-green-500', desc: 'Non-urgent — no resources needed' },
];

const VITAL_THRESHOLDS = {
  temperature: { low: 35.5, high: 38.0, criticalHigh: 39.5 },
  heartRate: { low: 50, high: 100, criticalHigh: 130, criticalLow: 40 },
  respiratoryRate: { low: 10, high: 20, criticalHigh: 30, criticalLow: 8 },
  oxygenSaturation: { low: 95, criticalLow: 90 },
  bloodPressureSystolic: { low: 90, high: 140, criticalHigh: 180, criticalLow: 70 },
};

function checkAbnormalVitals(vitals: Record<string, string>) {
  const alerts: string[] = [];
  const temp = parseFloat(vitals.temperature);
  if (!isNaN(temp)) {
    if (temp >= VITAL_THRESHOLDS.temperature.criticalHigh) alerts.push(`Critical fever: ${temp}°C`);
    else if (temp > VITAL_THRESHOLDS.temperature.high) alerts.push(`Elevated temp: ${temp}°C`);
    else if (temp < VITAL_THRESHOLDS.temperature.low) alerts.push(`Hypothermia: ${temp}°C`);
  }
  const hr = parseInt(vitals.heartRate);
  if (!isNaN(hr)) {
    if (hr >= VITAL_THRESHOLDS.heartRate.criticalHigh) alerts.push(`Critical tachycardia: ${hr} bpm`);
    else if (hr > VITAL_THRESHOLDS.heartRate.high) alerts.push(`Tachycardia: ${hr} bpm`);
    else if (hr <= VITAL_THRESHOLDS.heartRate.criticalLow) alerts.push(`Critical bradycardia: ${hr} bpm`);
    else if (hr < VITAL_THRESHOLDS.heartRate.low) alerts.push(`Bradycardia: ${hr} bpm`);
  }
  const rr = parseInt(vitals.respiratoryRate);
  if (!isNaN(rr)) {
    if (rr >= VITAL_THRESHOLDS.respiratoryRate.criticalHigh) alerts.push(`Tachypnea: ${rr}/min`);
    else if (rr > VITAL_THRESHOLDS.respiratoryRate.high) alerts.push(`Elevated RR: ${rr}/min`);
    else if (rr <= VITAL_THRESHOLDS.respiratoryRate.criticalLow) alerts.push(`Critical bradypnea: ${rr}/min`);
  }
  const spo2 = parseInt(vitals.oxygenSaturation);
  if (!isNaN(spo2)) {
    if (spo2 <= VITAL_THRESHOLDS.oxygenSaturation.criticalLow) alerts.push(`Critical SpO2: ${spo2}%`);
    else if (spo2 < VITAL_THRESHOLDS.oxygenSaturation.low) alerts.push(`Low SpO2: ${spo2}%`);
  }
  return alerts;
}

export default function NurseDashboard() {
  const { profile } = useAuth();

  const { data: triageQueue = [], isLoading: loadingTriage } = useAwaitingTriage();
  const completeTriage = useCompleteTriage();

  const { data: dashboard, isLoading: loadingDash } = useAdmissionsDashboard(false);
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const stats = dashboard?.stats || { activeTotal: 0, todayAdmissions: 0, todayDischarges: 0, byWard: [] };

  // Selected admission for workspace
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'admissions' | 'triage' | 'mar'>('admissions');

  // Triage modal state
  const [triageVisit, setTriageVisit] = useState<any>(null);
  const [triageOpen, setTriageOpen] = useState(false);
  const [vitals, setVitals] = useState({
    temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '',
    weight: '', height: '', oxygenSaturation: '',
  });
  const [triageEsiLevel, setTriageEsiLevel] = useState('3');
  const [triageNotes, setTriageNotes] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [marOpen, setMarOpen] = useState(false);
  const [selectedMarAdmission, setSelectedMarAdmission] = useState<any>(null);
  const [marMedications, setMarMedications] = useState<any[]>([]);

  const openTriage = (visit: any) => {
    setTriageVisit(visit);
    setChiefComplaint(visit.chiefComplaint || '');
    setTriageEsiLevel('3');
    setTriageNotes('');
    setVitals({
      temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '',
      weight: '', height: '', oxygenSaturation: '',
    });
    setTriageOpen(true);
  };

  const submitTriage = async () => {
    if (!triageVisit) return;
    try {
      await completeTriage.mutateAsync({
        visitId: triageVisit._id,
        data: {
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
          bloodPressure: vitals.bloodPressure || undefined,
          heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : undefined,
          respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
          weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
          height: vitals.height ? parseFloat(vitals.height) : undefined,
          oxygenSaturation: vitals.oxygenSaturation ? parseInt(vitals.oxygenSaturation) : undefined,
          triagePriority: `esi_${triageEsiLevel}`,
          triageNotes: triageNotes || undefined,
          chiefComplaint: chiefComplaint || undefined,
        },
      });
      toast.success('Triage complete — patient sent to doctor queue');
      setTriageOpen(false);
      setTriageVisit(null);
    } catch {
      toast.error('Failed to complete triage');
    }
  };

  const icuCount = stats.byWard?.find((w: any) => w._id === 'icu')?.count || 0;

  return (
    <RoleLayout
      title="Nurse Station"
      subtitle="Triage, admissions, vitals, fluid balance, medication rounds and care plans"
      role="nurse"
      userName={profile?.fullName}
    >
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MetricCard
          title="Awaiting Triage"
          value={triageQueue.length}
          icon={ClipboardCheck}
          variant={triageQueue.length > 0 ? 'warning' : 'default'}
        />
        <MetricCard title="Active Admissions" value={stats.activeTotal} icon={BedDouble} />
        <MetricCard title="ICU Patients" value={icuCount} icon={Activity} variant={icuCount > 0 ? 'critical' : 'default'} />
        <MetricCard title="Admitted Today" value={stats.todayAdmissions} icon={Inbox} />
        <MetricCard title="Discharged Today" value={stats.todayDischarges} icon={LogOutIcon} />
      </div>

      {/* Main Layout: left list, right workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Queue panels */}
        <div className="lg:col-span-1 space-y-4">
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="admissions">
                Admissions
                {activeAdmissions.length > 0 && <Badge variant="secondary" className="ml-1.5">{activeAdmissions.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="triage">
                Triage
                {triageQueue.length > 0 && <Badge className="ml-1.5 bg-amber-500">{triageQueue.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="mar">
                MAR
                <Pill className="w-3.5 h-3.5 ml-1" />
              </TabsTrigger>
            </TabsList>

            {/* Admissions list */}
            <TabsContent value="admissions" className="mt-3">
              <div className="bg-card border rounded-xl shadow-sm">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <BedDouble className="w-4 h-4 text-primary" />
                    Active Admissions
                  </h3>
                </div>
                <ScrollArea className="max-h-[calc(100vh-340px)]">
                  {loadingDash ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : activeAdmissions.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm px-4">
                      No active admissions
                    </div>
                  ) : (
                    <div className="divide-y">
                      {activeAdmissions.map((adm: any) => (
                        <div
                          key={adm._id}
                          className={cn(
                            'p-3 hover:bg-muted/50 cursor-pointer transition-colors',
                            selectedAdmissionId === adm._id && 'bg-primary/5 border-l-2 border-primary',
                          )}
                          onClick={() => setSelectedAdmissionId(adm._id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">
                                  {adm.patientId?.firstName} {adm.patientId?.lastName}
                                </p>
                                {adm.codeStatus && adm.codeStatus !== 'full_code' && (
                                  <Badge variant="destructive" className="text-[9px] h-4 uppercase px-1">{adm.codeStatus}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{adm.admissionNumber}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Badge variant="outline" className="text-[10px] h-4 capitalize">
                                  {adm.wardType}{adm.bedNumber ? ` · ${adm.bedNumber}` : ''}
                                </Badge>
                                {adm.wardType === 'icu' && (
                                  <Badge className="text-[10px] h-4 bg-red-500">ICU</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {adm.admissionReason}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Triage list */}
            <TabsContent value="triage" className="mt-3">
              <div className="bg-card border rounded-xl shadow-sm">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Awaiting Triage
                  </h3>
                </div>
                <ScrollArea className="max-h-[calc(100vh-340px)]">
                  {loadingTriage ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : triageQueue.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      No patients waiting for triage
                    </div>
                  ) : (
                    <div className="divide-y">
                      {triageQueue.map((visit: any) => (
                        <div key={visit._id} className="p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {visit.patientId?.firstName} {visit.patientId?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {visit.visitNumber} · {visit.patientId?.patientId}
                              </p>
                              {visit.chiefComplaint && (
                                <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-2">
                                  "{visit.chiefComplaint}"
                                </p>
                              )}
                              {visit.patientId?.allergies?.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                  <span className="text-xs text-red-600 font-medium truncate">
                                    {visit.patientId.allergies.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Button size="sm" className="flex-shrink-0" onClick={() => openTriage(visit)}>
                              Triage
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            {/* MAR - Medication Administration Record */}
            <TabsContent value="mar" className="mt-3">
              <div className="bg-card border rounded-xl shadow-sm">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Pill className="w-4 h-4 text-primary" />
                    Medication Administration Record
                  </h3>
                </div>
                <ScrollArea className="max-h-[calc(100vh-340px)]">
                  {activeAdmissions.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm px-4">
                      No active admissions — MAR is available for admitted patients
                    </div>
                  ) : (
                    <div className="divide-y">
                      {activeAdmissions.map((adm: any) => {
                        const scheduledMeds = adm.medicationOrders || adm.marOrders || [];
                        const dueNow = scheduledMeds.filter((m: any) => {
                          if (!m.nextDue) return false;
                          return new Date(m.nextDue) <= new Date();
                        });
                        return (
                          <div key={adm._id} className="p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  {adm.patientId?.firstName} {adm.patientId?.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{adm.admissionNumber} · {adm.wardType}{adm.bedNumber ? ` · ${adm.bedNumber}` : ''}</p>
                                {dueNow.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3 h-3 text-amber-500" />
                                    <span className="text-xs text-amber-600 font-medium">{dueNow.length} medication(s) due now</span>
                                  </div>
                                )}
                                {scheduledMeds.length === 0 && (
                                  <p className="text-xs text-muted-foreground italic mt-1">No active medication orders</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-shrink-0"
                                onClick={() => {
                                  setSelectedMarAdmission(adm);
                                  setMarMedications(scheduledMeds);
                                  setMarOpen(true);
                                }}
                              >
                                View MAR
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT: Admission Workspace */}
        <div className="lg:col-span-2">
          {selectedAdmissionId ? (
            <AdmissionWorkspace
              admissionId={selectedAdmissionId}
              onClose={() => setSelectedAdmissionId(null)}
              onDischarged={() => setSelectedAdmissionId(null)}
            />
          ) : (
            <div className="bg-card border rounded-xl shadow-sm flex flex-col items-center justify-center h-96 text-muted-foreground p-6 text-center">
              <Stethoscope className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No Admission Selected</p>
              <p className="text-sm mt-1 max-w-sm">
                Select an active admission from the left to open the patient chart with vitals, MAR, fluid balance, nursing notes, and care plan.
              </p>
              {triageQueue.length > 0 && (
                <Button variant="outline" className="mt-4" onClick={() => setMainTab('triage')}>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  {triageQueue.length} patient{triageQueue.length > 1 ? 's' : ''} waiting for triage
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Triage Modal ---------- */}
      <Dialog open={triageOpen} onOpenChange={setTriageOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Triage: {triageVisit?.patientId?.firstName} {triageVisit?.patientId?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Chief Complaint</Label>
              <Textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="What brings the patient in today?"
                rows={2}
                className="mt-1"
              />
            </div>

            {/* Abnormal vitals alerts */}
            {(() => {
              const alerts = checkAbnormalVitals(vitals);
              if (alerts.length === 0) return null;
              return (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Abnormal Vitals Detected</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm">
                      {alerts.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              );
            })()}

            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                Vital Signs
              </Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div><Label className="text-xs text-muted-foreground">Temperature (°C)</Label><Input value={vitals.temperature} onChange={(e) => setVitals({...vitals, temperature: e.target.value})} placeholder="36.5" className="h-8" /></div>
                <div><Label className="text-xs text-muted-foreground">Blood Pressure</Label><Input value={vitals.bloodPressure} onChange={(e) => setVitals({...vitals, bloodPressure: e.target.value})} placeholder="120/80" className="h-8" /></div>
                <div><Label className="text-xs text-muted-foreground">Heart Rate</Label><Input value={vitals.heartRate} onChange={(e) => setVitals({...vitals, heartRate: e.target.value})} placeholder="72" className="h-8" /></div>
                <div><Label className="text-xs text-muted-foreground">Resp. Rate</Label><Input value={vitals.respiratoryRate} onChange={(e) => setVitals({...vitals, respiratoryRate: e.target.value})} placeholder="16" className="h-8" /></div>
                <div><Label className="text-xs text-muted-foreground">Weight (kg)</Label><Input value={vitals.weight} onChange={(e) => setVitals({...vitals, weight: e.target.value})} placeholder="70" className="h-8" /></div>
                <div><Label className="text-xs text-muted-foreground">Height (cm)</Label><Input value={vitals.height} onChange={(e) => setVitals({...vitals, height: e.target.value})} placeholder="170" className="h-8" /></div>
                <div><Label className="text-xs text-muted-foreground">SpO2 (%)</Label><Input value={vitals.oxygenSaturation} onChange={(e) => setVitals({...vitals, oxygenSaturation: e.target.value})} placeholder="98" className="h-8" /></div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                ESI Level (Emergency Severity Index)
              </Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {ESI_LEVELS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setTriageEsiLevel(p.value)}
                    className={cn(
                      'px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all text-center',
                      triageEsiLevel === p.value ? `${p.color} text-white border-transparent` : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                    title={p.desc}
                  >
                    <div>{p.label}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ESI_LEVELS.find(e => e.value === triageEsiLevel)?.desc}
              </p>
            </div>

            <div>
              <Label className="text-sm">Triage Notes (optional)</Label>
              <Textarea
                value={triageNotes}
                onChange={(e) => setTriageNotes(e.target.value)}
                placeholder="Handoff notes to the doctor..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriageOpen(false)}>Cancel</Button>
            <Button onClick={submitTriage} disabled={completeTriage.isPending}>
              {completeTriage.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send to Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- MAR Modal ---------- */}
      <Dialog open={marOpen} onOpenChange={setMarOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              MAR: {selectedMarAdmission?.patientId?.firstName} {selectedMarAdmission?.patientId?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {selectedMarAdmission?.admissionNumber} · {selectedMarAdmission?.wardType}{selectedMarAdmission?.bedNumber ? ` · Bed ${selectedMarAdmission.bedNumber}` : ''}
            </div>
            {marMedications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active medication orders</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {marMedications.map((med: any, i: number) => {
                  const isDue = med.nextDue ? new Date(med.nextDue) <= new Date() : false;
                  const isGiven = med.status === 'given' || med.status === 'administered';
                  return (
                    <div key={i} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{med.medicationName || med.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {med.dosage} · {med.frequency} · {med.route || 'PO'}
                        </p>
                        {med.nextDue && (
                          <p className={cn('text-xs mt-0.5 font-medium', isDue ? 'text-amber-600' : 'text-muted-foreground')}>
                            Next due: {new Date(med.nextDue).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <Badge variant={isGiven ? 'default' : isDue ? 'destructive' : 'outline'} className="flex-shrink-0">
                        {isGiven ? 'Given' : isDue ? 'Due Now' : 'Scheduled'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setMarOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}

