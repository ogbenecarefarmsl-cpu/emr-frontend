import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateOrder } from '@/hooks/useOrders';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, XCircle } from 'lucide-react';
import type { OrderWithDetails } from '@/hooks/useOrders';

interface OrderCancellationDialogProps {
  order: OrderWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OrderCancellationDialog({
  order,
  open,
  onOpenChange,
  onSuccess
}: OrderCancellationDialogProps) {
  const { user } = useAuth();
  const updateOrder = useUpdateOrder();
  const [reason, setReason] = useState('');

  const canCancel = order && ['pending_payment', 'pending_collection'].includes(order.status);

  const handleCancel = async () => {
    if (!order || !reason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    try {
      await updateOrder.mutateAsync({
        id: order.id,
        updates: {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id || null,
          cancellation_reason: reason.trim()
        }
      });

      toast.success(`Order ${order.order_number} cancelled successfully`);
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to cancel order');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-status-critical" />
            Cancel Order
          </DialogTitle>
          <DialogDescription>
            {order && `Order #${order.order_number}`}
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-4">
            {!canCancel && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  This order cannot be cancelled. Only orders in "Pending Payment" or "Pending Collection" status can be cancelled.
                  Current status: <strong>{order.status.replace(/_/g, ' ')}</strong>
                </AlertDescription>
              </Alert>
            )}

            {canCancel && (
              <>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Patient</span>
                    <span className="font-medium">
                      {`${(order.patient || order.patients)?.firstName || (order.patient || order.patients)?.first_name || ''} ${(order.patient || order.patients)?.lastName || (order.patient || order.patients)?.last_name || ''}`.trim() || 'Unknown Patient'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tests</span>
                    <span>{(order.tests || order.order_tests || []).length} test(s)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">Le {Number(order.total).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="capitalize">{order.payment_status}</span>
                  </div>
                </div>

                {order.payment_status === 'paid' && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      This order has been paid. Cancellation may require a refund to be processed separately.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason">Cancellation Reason *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter the reason for cancelling this order..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    This reason will be recorded in the audit log and cannot be changed.
                  </p>
                </div>

                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This action cannot be undone. The order will be permanently cancelled.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason('');
              onOpenChange(false);
            }}
          >
            Close
          </Button>
          {canCancel && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!reason.trim() || updateOrder.isPending}
            >
              {updateOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Order
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
