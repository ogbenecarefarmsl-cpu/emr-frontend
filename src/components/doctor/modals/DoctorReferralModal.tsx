import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserCheck } from 'lucide-react';

interface DoctorReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialists: any[];
  referralForm: {
    specialistId: string;
    reason: string;
    notes: string;
  };
  setReferralForm: (form: { specialistId: string; reason: string; notes: string }) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function DoctorReferralModal({
  open,
  onOpenChange,
  specialists,
  referralForm,
  setReferralForm,
  onCancel,
  onSubmit,
  isPending,
}: DoctorReferralModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Refer to Specialist</DialogTitle>
          <DialogDescription>Notify another provider about this patient for follow-up care.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs font-medium">Specialist *</Label>
            <Select
              value={referralForm.specialistId}
              onValueChange={(v) => setReferralForm({ ...referralForm, specialistId: v })}
            >
              <SelectTrigger className="mt-1">
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
            <Label className="text-xs font-medium">Reason for Referral *</Label>
            <Input
              value={referralForm.reason}
              onChange={(e) => setReferralForm({ ...referralForm, reason: e.target.value })}
              placeholder="e.g., Suspected cardiac arrhythmia"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Clinical Notes</Label>
            <Textarea
              value={referralForm.notes}
              onChange={(e) => setReferralForm({ ...referralForm, notes: e.target.value })}
              rows={3}
              placeholder="Relevant history, findings, and recommended next steps..."
              className="mt-1 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !referralForm.specialistId || !referralForm.reason}
          >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
            Refer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
