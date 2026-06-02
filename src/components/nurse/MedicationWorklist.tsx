import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Clock, Pill } from 'lucide-react';
import { admissionLocation, patientName } from './nurseUtils';

interface MedicationWorklistProps {
  admissions: any[];
  onOpenMar: (admission: any, medications: any[]) => void;
  maxHeightClassName?: string;
}

export function getScheduledMeds(admission: any) {
  return admission?.medicationOrders || admission?.marOrders || [];
}

export function getDueNow(medications: any[]) {
  return medications.filter((med) => med.nextDue && new Date(med.nextDue) <= new Date());
}

export function MedicationWorklist({
  admissions,
  onOpenMar,
  maxHeightClassName = 'max-h-[calc(100vh-340px)]',
}: MedicationWorklistProps) {
  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          Medication Administration Schedule
        </h3>
      </div>
      <ScrollArea className={maxHeightClassName}>
        {admissions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm px-4">
            No active admissions - MAR is available for admitted patients
          </div>
        ) : (
          <div className="divide-y">
            {admissions.map((admission) => {
              const scheduledMeds = getScheduledMeds(admission);
              const dueNow = getDueNow(scheduledMeds);
              const administered = scheduledMeds.filter((med: any) => med.status === 'given' || med.status === 'administered');
              return (
                <div key={admission._id} className="grid gap-3 p-4 hover:bg-muted/30 transition-colors xl:grid-cols-[280px_minmax(0,1fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{patientName(admission.patientId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {admission.admissionNumber} - {admissionLocation(admission)}
                    </p>
                    {dueNow.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        <span className="text-xs text-amber-600 font-medium">{dueNow.length} due now</span>
                      </div>
                    )}
                    {scheduledMeds.length === 0 && (
                      <p className="text-xs text-muted-foreground italic mt-1">No active medication orders</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border bg-background px-3 py-2 text-xs">
                      <Clock className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                      <p className="font-semibold">{scheduledMeds.length}</p>
                      <p className="text-muted-foreground">scheduled</p>
                    </div>
                    <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <AlertCircle className="mb-1 h-3.5 w-3.5" />
                      <p className="font-semibold">{dueNow.length}</p>
                      <p>due</p>
                    </div>
                    <div className="rounded-lg border bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      <CheckCircle2 className="mb-1 h-3.5 w-3.5" />
                      <p className="font-semibold">{administered.length}</p>
                      <p>given</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="xl:w-28"
                    onClick={() => onOpenMar(admission, scheduledMeds)}
                  >
                    View MAR
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function MedicationDueBadge({ medications }: { medications: any[] }) {
  const dueNow = getDueNow(medications);
  if (dueNow.length === 0) return null;
  return <Badge variant="destructive">{dueNow.length} due</Badge>;
}
