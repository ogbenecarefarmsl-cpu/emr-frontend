import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { admissionLocation, patientName } from './nurseUtils';

interface MarDialogProps {
  admission: any | null;
  medications: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarDialog({ admission, medications, open, onOpenChange }: MarDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MAR: {patientName(admission?.patientId)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {admission?.admissionNumber} - {admissionLocation(admission)}
          </div>
          {medications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No active medication orders</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[minmax(220px,1fr)_120px_120px_120px] bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Medication</span>
                <span>Route</span>
                <span>Next due</span>
                <span>Status</span>
              </div>
              {medications.map((med, index) => {
                const isDue = med.nextDue ? new Date(med.nextDue) <= new Date() : false;
                const isGiven = med.status === 'given' || med.status === 'administered';
                return (
                  <div key={`${med.medicationName || med.name}-${index}`} className="grid grid-cols-[minmax(220px,1fr)_120px_120px_120px] items-center gap-3 border-t p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{med.medicationName || med.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {med.dosage} - {med.frequency}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">{med.route || 'PO'}</span>
                    <span className={cn('text-xs font-medium', isDue ? 'text-amber-600' : 'text-muted-foreground')}>
                      {med.nextDue ? new Date(med.nextDue).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not set'}
                    </span>
                    <Badge variant={isGiven ? 'default' : isDue ? 'destructive' : 'outline'} className="w-fit">
                      {isGiven ? 'Given' : isDue ? 'Due Now' : 'Scheduled'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
