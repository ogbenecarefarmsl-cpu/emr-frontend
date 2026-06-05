import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { admissionLocation, patientName } from './nurseUtils';
import { prescriptionService } from '@/services/prescriptionService';
import { useRecordMedication } from '@/hooks/useAdmissions';

interface MarDialogProps {
  admission: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROUTE_OPTIONS = ['PO', 'IV', 'IM', 'SC', 'topical', 'inhalation', 'NG', 'PR'];

export function MarDialog({ admission, open, onOpenChange }: MarDialogProps) {
  const qc = useQueryClient();
  const admissionId = admission?._id;
  const patientId = admission?.patientId?._id;
  const [form, setForm] = useState({
    medicationName: '',
    dosage: '',
    route: 'PO',
    prescriptionId: '',
    medicationId: '',
    refused: false,
    refusalReason: '',
    notes: '',
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['prescriptions', 'patient', patientId],
    queryFn: () => prescriptionService.findByPatient(patientId!),
    enabled: !!patientId && open,
    staleTime: 30 * 1000,
  });

  const scheduledItems = useMemo(() => {
    return prescriptions
      .filter((rx: any) => rx.status !== 'cancelled')
      .flatMap((rx: any) => (rx.items || []).map((item: any) => ({
        ...item,
        prescriptionId: rx._id,
        prescriptionNumber: rx.prescriptionNumber,
        frequency: item.frequency || '',
        nextDue: item.nextDue,
        status: item.status,
      })));
  }, [prescriptions]);

  const adminLog = admission?.medicationLog || [];
  const recentByName = useMemo(() => {
    const map = new Map<string, any>();
    for (const entry of adminLog) {
      if (!entry?.medicationName) continue;
      const key = entry.medicationName.toLowerCase();
      const existing = map.get(key);
      if (!existing || new Date(entry.administeredAt) > new Date(existing.administeredAt)) {
        map.set(key, entry);
      }
    }
    return map;
  }, [adminLog]);

  const recordMedication = useRecordMedication(admissionId);

  const fillFromItem = (item: any) => {
    setForm({
      medicationName: item.medicationName || '',
      dosage: item.dosage || '',
      route: item.route || 'PO',
      prescriptionId: item.prescriptionId || '',
      medicationId: item.medicationId || '',
      refused: false,
      refusalReason: '',
      notes: '',
    });
  };

  const submit = async () => {
    if (!form.medicationName || !form.dosage) {
      toast.error('Medication name and dose are required');
      return;
    }
    if (form.refused && !form.refusalReason) {
      toast.error('Please record a reason for the refusal');
      return;
    }
    try {
      await recordMedication.mutateAsync({
        medicationName: form.medicationName,
        dosage: form.dosage,
        route: form.route,
        prescriptionId: form.prescriptionId || undefined,
        medicationId: form.medicationId || undefined,
        refused: form.refused,
        refusalReason: form.refused ? form.refusalReason : undefined,
        notes: form.notes || undefined,
      });
      toast.success(form.refused ? 'Refusal recorded' : 'Medication administered');
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
      setForm({
        medicationName: '',
        dosage: '',
        route: 'PO',
        prescriptionId: '',
        medicationId: '',
        refused: false,
        refusalReason: '',
        notes: '',
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to record administration');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            MAR: {patientName(admission?.patientId)}
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          {admission?.admissionNumber} - {admissionLocation(admission)}
        </div>

        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold mb-2">Prescribed medications</h4>
            {scheduledItems.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No active prescriptions for this patient.</p>
            ) : (
              <div className="clinical-panel overflow-hidden">
                {scheduledItems.map((item, index) => {
                  const last = recentByName.get((item.medicationName || '').toLowerCase());
                  const lastAt = last ? new Date(last.administeredAt) : null;
                  const isRecent = lastAt && Date.now() - lastAt.getTime() < 6 * 60 * 60 * 1000;
                  return (
                    <div key={`${item.medicationName}-${index}`} className="clinical-list-row relative p-3 pl-5 flex items-center justify-between gap-3">
                      <div className={`clinical-status-strip ${last?.refused ? 'bg-rose-500' : isRecent ? 'bg-primary' : 'bg-amber-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.medicationName}</p>
                        <p className="clinical-label">
                          {item.dosage} - {item.frequency} - {item.route || 'PO'}
                        </p>
                        {last && (
                          <p className={cn('text-xs mt-0.5 font-medium', last.refused ? 'text-rose-600' : 'text-primary')}>
                            {last.refused ? 'Refused' : 'Last given'}: {lastAt!.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="default" onClick={() => { fillFromItem(item); setForm((f) => ({ ...f, refused: false })); }}>
                          <Check className="w-3 h-3 mr-1" /> Give
                        </Button>
                        <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => { fillFromItem(item); setForm((f) => ({ ...f, refused: true })); }}>
                          <X className="w-3 h-3 mr-1" /> Refuse
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h4 className="text-sm font-semibold">Record administration</h4>
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
                  <input type="checkbox" id="refused" checked={form.refused} onChange={(e) => setForm({ ...form, refused: e.target.checked })} />
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

          {adminLog.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Administration history
              </h4>
              <div className="clinical-panel overflow-hidden max-h-48 overflow-y-auto">
                {[...adminLog].reverse().slice(0, 10).map((entry: any, index: number) => (
                  <div key={`${entry.administeredAt}-${index}`} className="clinical-list-row relative p-2.5 pl-4 text-xs">
                    <div className={`clinical-status-strip ${entry.refused ? 'bg-rose-500' : 'bg-primary'}`} />
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{entry.medicationName}</span>
                        <span className="text-muted-foreground"> - {entry.dosage} {entry.route ? `(${entry.route})` : ''}</span>
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
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={recordMedication.isPending}>
            {recordMedication.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-1" />}
            {form.refused ? 'Record refusal' : 'Mark as given'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
