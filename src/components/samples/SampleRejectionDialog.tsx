import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { samplesAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface SampleRejectionDialogProps {
  sample: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const REJECTION_REASONS = [
  { value: 'hemolyzed', label: 'Hemolyzed Sample' },
  { value: 'clotted', label: 'Clotted Sample' },
  { value: 'insufficient', label: 'Insufficient Quantity' },
  { value: 'contaminated', label: 'Contaminated' },
  { value: 'wrong_container', label: 'Wrong Container' },
  { value: 'unlabeled', label: 'Unlabeled/Mislabeled' },
  { value: 'expired', label: 'Sample Expired' },
  { value: 'lipemic', label: 'Lipemic Sample' },
  { value: 'other', label: 'Other (Specify)' }
];

export function SampleRejectionDialog({
  sample,
  open,
  onOpenChange,
  onSuccess
}: SampleRejectionDialogProps) {
  const { user } = useAuth();
  const [rejectionReason, setRejectionReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReject = async () => {
    if (!sample || !rejectionReason) {
      toast.error('Please select a rejection reason');
      return;
    }

    setIsSubmitting(true);

    try {
      const fullReason = rejectionReason === 'other' 
        ? additionalNotes 
        : `${REJECTION_REASONS.find(r => r.value === rejectionReason)?.label}${additionalNotes ? `: ${additionalNotes}` : ''}`;

      // Reject sample using API
      await samplesAPI.reject(sample.id, fullReason);

      toast.success('Sample rejected successfully');
      setRejectionReason('');
      setAdditionalNotes('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error rejecting sample:', error);
      toast.error('Failed to reject sample');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-status-critical" />
            Reject Sample
          </DialogTitle>
        </DialogHeader>

        {sample && (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sample ID</span>
                <span className="font-mono font-semibold">{sample.sample_id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order</span>
                <span className="font-mono">{sample.orders?.order_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium">
                  {sample.patients?.first_name} {sample.patients?.last_name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sample Type</span>
                <span className="capitalize">{sample.sample_type}</span>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Rejecting this sample will require re-collection. The patient will need to be notified.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Rejection Reason *</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger id="rejection_reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map(reason => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                Additional Notes {rejectionReason === 'other' && '*'}
              </Label>
              <Textarea
                id="notes"
                placeholder={rejectionReason === 'other' ? 'Please specify the reason...' : 'Add any additional details...'}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                <strong>Next Steps:</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Sample will be marked as rejected</li>
                <li>Order status will remain pending collection</li>
                <li>Patient/physician will be notified</li>
                <li>New sample collection can be scheduled</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setRejectionReason('');
              setAdditionalNotes('');
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={!rejectionReason || (rejectionReason === 'other' && !additionalNotes.trim()) || isSubmitting}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <XCircle className="w-4 h-4 mr-2" />
            Reject Sample
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
