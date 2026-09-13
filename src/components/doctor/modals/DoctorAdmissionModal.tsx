import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BedDouble } from 'lucide-react';

interface DoctorAdmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admitForm: {
    wardType: string;
    bedNumber: string;
    admissionReason: string;
    diagnosis: string;
    notes: string;
  };
  setAdmitForm: (form: {
    wardType: string;
    bedNumber: string;
    admissionReason: string;
    diagnosis: string;
    notes: string;
  }) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function DoctorAdmissionModal({
  open,
  onOpenChange,
  admitForm,
  setAdmitForm,
  onCancel,
  onSubmit,
  isPending,
}: DoctorAdmissionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Admit Patient</DialogTitle>
          <DialogDescription>Assign the patient to a ward and bed for inpatient care.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Ward Type</Label>
              <Select
                value={admitForm.wardType}
                onValueChange={(v) => setAdmitForm({ ...admitForm, wardType: v })}
              >
                <SelectTrigger className="mt-1">
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
              <Label className="text-xs font-medium">Bed Number</Label>
              <Input
                value={admitForm.bedNumber}
                onChange={(e) => setAdmitForm({ ...admitForm, bedNumber: e.target.value })}
                placeholder="e.g., B-12"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Admission Reason *</Label>
            <Input
              value={admitForm.admissionReason}
              onChange={(e) => setAdmitForm({ ...admitForm, admissionReason: e.target.value })}
              placeholder="Primary reason for admission"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Working Diagnosis</Label>
            <Input
              value={admitForm.diagnosis}
              onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Handoff Notes</Label>
            <Textarea
              value={admitForm.notes}
              onChange={(e) => setAdmitForm({ ...admitForm, notes: e.target.value })}
              rows={3}
              placeholder="Handoff notes for the nursing team..."
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !admitForm.admissionReason}>
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BedDouble className="w-4 h-4 mr-2" />}
            Admit Patient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
