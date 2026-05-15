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

// Icons
import {
  Heart, AlertTriangle, BedDouble, Users, ClipboardCheck, Clock,
  Send, Loader2, Inbox, Stethoscope, LogOut as LogOutIcon,
  ChevronRight, Activity,
} from 'lucide-react';

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-500' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-500' },
  { value: 'high', label: 'High', color: 'bg-amber-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-orange-500' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-500' },
];

export default function NurseDashboard() {
  const { profile } = useAuth();

  const { data: triageQueue = [], isLoading: loadingTriage } = useAwaitingTriage();
  const completeTriage = useCompleteTriage();

  const { data: dashboard, isLoading: loadingDash } = useAdmissionsDashboard(false);
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const stats = dashboard?.stats || { activeTotal: 0, todayAdmissions: 0, todayDischarges: 0, byWard: [] };

  // Selected admission for workspace
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'admissions' | 'triage'>('admissions');

  // Triage modal state
  const [triageVisit, setTriageVisit] = useState<any>(null);
  const [triageOpen, setTriageOpen] = useState(false);
  const [vitals, setVitals] = useState({
    temperature: '', bloodPressure: '', heartRate: '', respiratoryRate: '',
    weight: '', height: '', oxygenSaturation: '',
  });
  const [triagePriority, setTriagePriority] = useState('normal');
  const [triageNotes, setTriageNotes] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');

  const openTriage = (visit: any) => {
    setTriageVisit(visit);
    setChiefComplaint(visit.chiefComplaint || '');
    setTriagePriority('normal');
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
          triagePriority,
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
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="admissions">
                Admissions
                {activeAdmissions.length > 0 && <Badge variant="secondary" className="ml-1.5">{activeAdmissions.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="triage">
                Triage
                {triageQueue.length > 0 && <Badge className="ml-1.5 bg-amber-500">{triageQueue.length}</Badge>}
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
              <Label className="text-sm font-medium">Priority</Label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setTriagePriority(p.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all',
                      triagePriority === p.value ? `${p.color} text-white border-transparent` : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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
    </RoleLayout>
  );
}

