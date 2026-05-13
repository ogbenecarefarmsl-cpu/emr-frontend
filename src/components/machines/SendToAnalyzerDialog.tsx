import { useState } from 'react';
import { useMachines, useSendOrderToMachine } from '@/hooks/useMachines';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Wifi, WifiOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SendToAnalyzerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  testCodes: string[];
}

export function SendToAnalyzerDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  testCodes,
}: SendToAnalyzerDialogProps) {
  const { data: machines } = useMachines();
  const sendOrder = useSendOrderToMachine();
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ status: 'idle' | 'sending' | 'success' | 'error'; message?: string }>({ status: 'idle' });

  // Filter machines that support at least one of the test codes
  const compatibleMachines = machines?.filter(machine => {
    if (!machine.testsSupported || machine.testsSupported.length === 0) return true; // Show all if no tests configured
    return testCodes.some(code => machine.testsSupported?.includes(code));
  }) ?? [];

  const handleSend = async (machineId: string) => {
    setSelectedMachineId(machineId);
    setSendResult({ status: 'sending' });

    try {
      const result = await sendOrder.mutateAsync({ orderId, machineId });
      if (result.success) {
        setSendResult({ status: 'success', message: result.message });
        toast.success(result.message);
      } else {
        setSendResult({ status: 'error', message: result.message });
        toast.error(result.message);
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const msg = axiosError?.response?.data?.message || 'Failed to send order to analyzer';
      setSendResult({ status: 'error', message: msg });
      toast.error(msg);
    }
  };

  const handleClose = () => {
    setSendResult({ status: 'idle' });
    setSelectedMachineId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Order to Analyzer</DialogTitle>
          <DialogDescription>
            Dispatch order <span className="font-mono font-semibold">{orderNumber}</span> to a connected analyzer.
          </DialogDescription>
        </DialogHeader>

        {/* Test codes being sent */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Tests to dispatch:</p>
          <div className="flex flex-wrap gap-1">
            {testCodes.map(code => (
              <Badge key={code} variant="secondary" className="font-mono text-xs">{code}</Badge>
            ))}
          </div>
        </div>

        {/* Send result feedback */}
        {sendResult.status === 'success' && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-status-normal/10 border border-status-normal/20 mb-4">
            <CheckCircle className="w-5 h-5 text-status-normal flex-shrink-0" />
            <p className="text-sm text-status-normal">{sendResult.message}</p>
          </div>
        )}
        {sendResult.status === 'error' && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{sendResult.message}</p>
          </div>
        )}

        {/* Machine list */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {compatibleMachines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No compatible analyzers found.</p>
              <p className="text-xs">Configure machines with matching test codes.</p>
            </div>
          ) : (
            compatibleMachines.map(machine => {
              const isOnline = machine.status === 'online';
              const isSending = sendOrder.isPending && selectedMachineId === machine.id;
              const isSent = sendResult.status === 'success' && selectedMachineId === machine.id;

              return (
                <div
                  key={machine.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-colors',
                    isOnline ? 'hover:bg-muted/50' : 'opacity-60',
                    isSent && 'border-status-normal/30 bg-status-normal/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      isOnline ? 'bg-status-normal' : 'bg-muted-foreground'
                    )} />
                    <div>
                      <p className="font-medium text-sm">{machine.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {machine.manufacturer} {machine.modelName} &middot; {machine.protocol}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isSent ? 'ghost' : 'default'}
                    disabled={isSending || isSent}
                    onClick={() => handleSend(machine.id)}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : isSent ? (
                      <CheckCircle className="w-4 h-4 mr-1 text-status-normal" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    {isSent ? 'Sent' : 'Send'}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={handleClose}>
            {sendResult.status === 'success' ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
