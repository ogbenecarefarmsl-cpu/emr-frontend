import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDoctors } from '@/hooks/useDoctors';
import { useCompleteTriage } from '@/hooks/useVisits';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Activity, AlertCircle, Heart, Loader2, Send } from 'lucide-react';
import { ESI_LEVELS, checkAbnormalVitals, patientName, triagePriorityFromEsi } from './nurseUtils';

interface TriageDialogProps {
  visit: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

const EMPTY_VITALS = {
  temperature: '',
  bloodPressure: '',
  heartRate: '',
  respiratoryRate: '',
  weight: '',
  height: '',
  oxygenSaturation: '',
};

export function TriageDialog({ visit, open, onOpenChange, onCompleted }: TriageDialogProps) {
  const completeTriage = useCompleteTriage();
  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors();
  const [vitals, setVitals] = useState(EMPTY_VITALS);
  const [triageEsiLevel, setTriageEsiLevel] = useState('3');
  const [triageNotes, setTriageNotes] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [doctorId, setDoctorId] = useState('');

  useEffect(() => {
    if (!visit || !open) return;
    setChiefComplaint(visit.chiefComplaint || '');
    setTriageEsiLevel('3');
    setTriageNotes('');
    setDoctorId(typeof visit.doctorId === 'object' ? visit.doctorId?._id || '' : visit.doctorId || '');
    setVitals(EMPTY_VITALS);
  }, [visit, open]);

  const submitTriage = async () => {
    if (!visit) return;
    try {
      await completeTriage.mutateAsync({
        visitId: visit._id,
        data: {
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
          bloodPressure: vitals.bloodPressure || undefined,
          heartRate: vitals.heartRate ? parseInt(vitals.heartRate, 10) : undefined,
          respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate, 10) : undefined,
          weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
          height: vitals.height ? parseFloat(vitals.height) : undefined,
          oxygenSaturation: vitals.oxygenSaturation ? parseInt(vitals.oxygenSaturation, 10) : undefined,
          triagePriority: triagePriorityFromEsi(triageEsiLevel),
          triageNotes: triageNotes || undefined,
          chiefComplaint: chiefComplaint || undefined,
          doctorId: doctorId || undefined,
        },
      });
      toast.success(doctorId ? 'Triage complete - patient sent to selected doctor' : 'Triage complete - patient sent to doctor queue');
      onOpenChange(false);
      onCompleted?.();
    } catch {
      toast.error('Failed to complete triage');
    }
  };

  const alerts = checkAbnormalVitals(vitals);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Triage: {patientName(visit?.patientId)}</DialogTitle>
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

          {alerts.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Abnormal Vitals Detected</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {alerts.map((alert) => <li key={alert}>{alert}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              Vital Signs
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div><Label className="text-xs text-muted-foreground">Temperature (C)</Label><Input value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })} placeholder="36.5" className="h-8" /></div>
              <div><Label className="text-xs text-muted-foreground">Blood Pressure</Label><Input value={vitals.bloodPressure} onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })} placeholder="120/80" className="h-8" /></div>
              <div><Label className="text-xs text-muted-foreground">Heart Rate</Label><Input value={vitals.heartRate} onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })} placeholder="72" className="h-8" /></div>
              <div><Label className="text-xs text-muted-foreground">Resp. Rate</Label><Input value={vitals.respiratoryRate} onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })} placeholder="16" className="h-8" /></div>
              <div><Label className="text-xs text-muted-foreground">Weight (kg)</Label><Input value={vitals.weight} onChange={(e) => setVitals({ ...vitals, weight: e.target.value })} placeholder="70" className="h-8" /></div>
              <div><Label className="text-xs text-muted-foreground">Height (cm)</Label><Input value={vitals.height} onChange={(e) => setVitals({ ...vitals, height: e.target.value })} placeholder="170" className="h-8" /></div>
              <div><Label className="text-xs text-muted-foreground">SpO2 (%)</Label><Input value={vitals.oxygenSaturation} onChange={(e) => setVitals({ ...vitals, oxygenSaturation: e.target.value })} placeholder="98" className="h-8" /></div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              ESI Level
            </Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {ESI_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setTriageEsiLevel(level.value)}
                  className={cn(
                    'px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all text-center',
                    triageEsiLevel === level.value ? `${level.color} text-white border-transparent` : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                  title={level.desc}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {ESI_LEVELS.find((level) => level.value === triageEsiLevel)?.desc}
            </p>
          </div>

          <div>
            <Label className="text-sm">Send to Doctor</Label>
            <Select value={doctorId || 'general_queue'} onValueChange={(value) => setDoctorId(value === 'general_queue' ? '' : value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select doctor or send to general queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general_queue">General doctor queue</SelectItem>
                {doctors.map((doctor: any) => (
                  <SelectItem key={doctor._id} value={doctor._id}>
                    {doctor.fullName}
                    {doctor.specialty ? ` - ${String(doctor.specialty).replace(/_/g, ' ')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {doctorsLoading ? 'Loading doctors...' : `${doctors.length} active doctor${doctors.length === 1 ? '' : 's'} available`}
            </p>
          </div>

          <div>
            <Label className="text-sm">Triage Notes</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submitTriage} disabled={completeTriage.isPending}>
            {completeTriage.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {doctorId ? 'Send to Selected Doctor' : 'Send to Doctor Queue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
