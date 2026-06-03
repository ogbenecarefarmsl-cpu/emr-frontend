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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
            <div className="clinical-panel overflow-hidden">
              {medications.map((med, index) => {
                const isDue = med.nextDue ? new Date(med.nextDue) <= new Date() : false;
                const isGiven = med.status === 'given' || med.status === 'administered';
                return (
                  <div key={`${med.medicationName || med.name}-${index}`} className="clinical-list-row relative p-3 pl-5 flex items-center justify-between gap-3">
                    <div className={`clinical-status-strip ${isGiven ? 'bg-primary' : isDue ? 'bg-amber-500' : 'bg-border'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{med.medicationName || med.name}</p>
                      <p className="clinical-label">
                        {med.dosage} - {med.frequency} - {med.route || 'PO'}
                      </p>
                      {med.nextDue && (
                        <p className={cn('text-xs mt-0.5 font-medium', isDue ? 'text-amber-600' : 'text-muted-foreground')}>
                          Next due: {new Date(med.nextDue).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <Badge variant={isGiven ? 'default' : isDue ? 'destructive' : 'outline'} className="flex-shrink-0">
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
