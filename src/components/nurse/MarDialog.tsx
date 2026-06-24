import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Clock, Loader2, Pill, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { prescriptionService } from '@/services/prescriptionService';

interface MarDialogProps {
  prescription: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROUTE_OPTIONS = ['PO', 'IV', 'IM', 'SC', 'topical', 'inhalation', 'NG', 'PR'];

export function MarDialog({ prescription, open, onOpenChange }: MarDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    medicationName: '',
    dosage: '',
    route: 'PO',
    refused: false,
    refusalReason: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when prescription changes
  useMemo(() => {
    if (prescription) {
      const firstItem = prescription.items?.[0];
      setForm({
        medicationName: firstItem?.medicationName || '',
        dosage: firstItem?.strengthPerDose || firstItem?.dosage || '',
        route: firstItem?.route || 'PO',
        refused: false,
        refusalReason: '',
        notes: '',
      });
    }
  }, [prescription?._id]);

  if (!prescription) return null;

  const patient = prescription.patientId;
  const firstItem = prescription.items?.[0];
  const adminLog = prescription.administrationLog || [];
  const progress = prescription.totalDoses > 0
    ? Math.round((prescription.dosesGiven / prescription.totalDoses) * 100)
    : 0;
  const isCompleted = prescription.status === 'completed';

  const submit = async () => {
    if (!form.medicationName || !form.dosage) {
      toast.error('Medication name and dose are required');
      return;
    }
    if (form.refused && !form.refusalReason) {
      toast.error('Please record a reason for the refusal');
      return;
    }

    setIsSubmitting(true);
    try {
      await prescriptionService.administer(prescription._id, {
        medicationName: form.medicationName,
        dosage: form.dosage,
        route: form.route,
        given: !form.refused,
        refused: form.refused,
        refusalReason: form.refused ? form.refusalReason : undefined,
        notes: form.notes || undefined,
      });

      toast.success(form.refused ? 'Refusal recorded' : 'Medication administered');
      qc.invalidateQueries({ queryKey: ['prescriptions', 'mar-worklist'] });

      // Reset form but keep same medication
      setForm((f) => ({
        ...f,
        refused: false,
        refusalReason: '',
        notes: '',
      }));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to record administration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            MAR: {patient?.firstName} {patient?.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          {prescription.prescriptionNumber}
          {prescription.isAdmitted && ` — ${prescription.admissionNumber}`}
          {` — ${firstItem?.route?.toUpperCase() || 'PO'}`}
        </div>

        <div className="space-y-5">
          {/* Progress */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Course Progress</span>
              <span className="text-sm text-muted-foreground">{prescription.dosesGiven} of {prescription.totalDoses} doses</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', isCompleted ? 'bg-green-500' : 'bg-primary')}
                style={{ width: `${progress}%` }}
              />
            </div>
            {prescription.nextDueAt && !isCompleted && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Next dose: {new Date(prescription.nextDueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          {/* Record administration form */}
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h4 className="text-sm font-semibold">Record Administration</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Medication *</Label>
                <Input value={form.medicationName} onChange={(e) => setForm({ ...form, medicationName: e.target.value })} placeholder="e.g., Paracetamol 500mg" />
              </div>
              <div>
                <Label>Dose *</Label>
                <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500mg" />
              </div>
              <div>
                <Label>Route</Label>
                <Select value={form.route} onValueChange={(v) => setForm({ ...form, route: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUTE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.refused} onChange={(e) => setForm({ ...form, refused: e.target.checked })} />
                  Patient refused
                </label>
              </div>
            </div>
            {form.refused && (
              <div>
                <Label>Reason for refusal *</Label>
                <Input value={form.refusalReason} onChange={(e) => setForm({ ...form, refusalReason: e.target.value })} placeholder="e.g., NPO, vomiting, anxious" />
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Site, patient response, etc." />
            </div>
          </div>

          {/* Administration history */}
          {adminLog.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Administration History
              </h4>
              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {[...adminLog].reverse().map((entry: any, index: number) => (
                  <div key={`${entry.administeredAt}-${index}`} className="p-2.5 pl-4 text-xs border-b last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{entry.medicationName}</span>
                        <span className="text-muted-foreground"> - {entry.dosage} ({entry.route})</span>
                        {entry.refused && entry.refusalReason && (
                          <span className="text-rose-600 ml-2">- {entry.refusalReason}</span>
                        )}
                        {entry.notes && <p className="text-muted-foreground italic mt-0.5">{entry.notes}</p>}
                      </div>
                      <Badge variant={entry.refused ? 'destructive' : 'default'} className="flex-shrink-0">
                        {entry.refused ? 'Refused' : 'Given'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {new Date(entry.administeredAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {entry.administeredByName && ` by ${entry.administeredByName}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={isSubmitting || isCompleted}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1" />}
            {isCompleted ? 'Course Complete' : (form.refused ? 'Record Refusal' : 'Mark as Given')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
