import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDoctors } from '@/hooks/useDoctors';
import { useCompleteTriage } from '@/hooks/useVisits';
import { admissionsAPI } from '@/services/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Activity, AlertCircle, BedDouble, Heart, Loader2, Send } from 'lucide-react';
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
  const qc = useQueryClient();
  const completeTriage = useCompleteTriage();
  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors();
  const [vitals, setVitals] = useState(EMPTY_VITALS);
  const [triageEsiLevel, setTriageEsiLevel] = useState('3');
  const [triageNotes, setTriageNotes] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [admitOpen, setAdmitOpen] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [admitForm, setAdmitForm] = useState({
    wardType: 'general',
    bedNumber: '',
    admissionReason: '',
    diagnosis: '',
    notes: '',
  });

  useEffect(() => {
    if (!visit || !open) return;
    setChiefComplaint(visit.chiefComplaint || '');
    setTriageEsiLevel('3');
    setTriageNotes('');
    setDoctorId(typeof visit.doctorId === 'object' ? visit.doctorId?._id || '' : visit.doctorId || '');
    setVitals(EMPTY_VITALS);
    setAdmitOpen(false);
    setIsAdmitting(false);
    setAdmitForm({
      wardType: 'general',
      bedNumber: '',
      admissionReason: visit.chiefComplaint || '',
      diagnosis: '',
      notes: '',
    });
  }, [visit, open]);

  const availableDoctors = doctors.filter((d: any) => d.isActive !== false);
  const alerts = checkAbnormalVitals(vitals);

  const submitTriage = async () => {
    if (!visit) return;
    if (!doctorId) {
      toast.error('Select a doctor before sending the patient to queue');
      return;
    }
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
          doctorId,
          triageAlert: alerts.length > 0,
          triageAlerts: alerts,
        },
      });
      toast.success('Triage complete - patient sent to selected doctor');
      onOpenChange(false);
      onCompleted?.();
    } catch {
      toast.error('Failed to complete triage');
    }
  };

  const admitPatient = async () => {
    if (!visit) return;
    if (!admitForm.admissionReason.trim()) {
      toast.error('Admission reason is required');
      return;
    }

    const patientId = visit.patientId?._id || visit.patientId;
    if (!patientId) {
      toast.error('Patient record is missing from this visit');
      return;
    }

    const initialVitals = {
      temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
      bloodPressure: vitals.bloodPressure || undefined,
      heartRate: vitals.heartRate ? parseInt(vitals.heartRate, 10) : undefined,
      respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate, 10) : undefined,
      oxygenSaturation: vitals.oxygenSaturation ? parseInt(vitals.oxygenSaturation, 10) : undefined,
      notes: [
        chiefComplaint ? `Chief complaint: ${chiefComplaint}` : '',
        `ESI ${triageEsiLevel}: ${triagePriorityFromEsi(triageEsiLevel)}`,
        triageNotes ? `Triage notes: ${triageNotes}` : '',
        alerts.length > 0 ? `Alerts: ${alerts.join('; ')}` : '',
      ].filter(Boolean).join('\n') || undefined,
    };
    const hasInitialVitals = Object.values(initialVitals).some((value) => value !== undefined && value !== '');

    setIsAdmitting(true);
    try {
      const admission = await admissionsAPI.create({
        patientId,
        visitId: visit._id || visit.id,
        doctorId: doctorId || undefined,
        wardType: admitForm.wardType,
        bedNumber: admitForm.bedNumber || undefined,
        admissionReason: admitForm.admissionReason.trim(),
        diagnosis: admitForm.diagnosis || undefined,
        notes: admitForm.notes || triageNotes || undefined,
      });

      if (hasInitialVitals && admission?._id) {
        await admissionsAPI.recordVitals(admission._id, initialVitals);
      }

      toast.success('Patient admitted');
      qc.invalidateQueries({ queryKey: ['admissions'] });
      qc.invalidateQueries({ queryKey: ['visits'] });
      qc.invalidateQueries({ queryKey: ['prescriptions', 'mar-worklist'] });
      setAdmitOpen(false);
      onOpenChange(false);
      onCompleted?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to admit patient');
    } finally {
      setIsAdmitting(false);
    }
  };

  return (
    <>
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
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select receiving doctor" />
              </SelectTrigger>
              <SelectContent>
                {availableDoctors.map((doctor: any) => (
                  <SelectItem key={doctor._id} value={doctor._id}>
                    {doctor.fullName}
                    {doctor.specialty ? ` - ${String(doctor.specialty).replace(/_/g, ' ')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {doctorsLoading ? 'Loading doctors...' : `${availableDoctors.length} active doctor${availableDoctors.length === 1 ? '' : 's'} available`}
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
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => setAdmitOpen(true)}>
            <BedDouble className="w-4 h-4 mr-2" />
            Admit Patient
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submitTriage} disabled={completeTriage.isPending || doctorsLoading || !doctorId || availableDoctors.length === 0}>
              {completeTriage.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send to Selected Doctor
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <Dialog open={admitOpen} onOpenChange={setAdmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {patientName(visit?.patientId)} will be moved to the inpatient admissions board.
            </div>
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
              <div>
                <Label>Bed Number</Label>
                <Input value={admitForm.bedNumber} onChange={(e) => setAdmitForm({ ...admitForm, bedNumber: e.target.value })} placeholder="e.g., B-12" />
              </div>
            </div>
            <div>
              <Label>Admission Reason *</Label>
              <Input value={admitForm.admissionReason} onChange={(e) => setAdmitForm({ ...admitForm, admissionReason: e.target.value })} placeholder="Primary reason for admission" />
            </div>
            <div>
              <Label>Working Diagnosis</Label>
              <Input value={admitForm.diagnosis} onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={admitForm.notes} onChange={(e) => setAdmitForm({ ...admitForm, notes: e.target.value })} rows={3} placeholder="Handoff notes for the ward team..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitOpen(false)}>Cancel</Button>
            <Button onClick={admitPatient} disabled={isAdmitting || !admitForm.admissionReason.trim()}>
              {isAdmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BedDouble className="w-4 h-4 mr-2" />}
              Admit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
