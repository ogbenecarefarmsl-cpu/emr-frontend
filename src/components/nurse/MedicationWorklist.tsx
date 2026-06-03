import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Pill } from 'lucide-react';
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
    <div className="clinical-panel overflow-hidden">
      <div className="clinical-panel-header">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          Medication Administration Record
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
              return (
                <div key={admission._id} className="clinical-list-row relative p-3 pl-5">
                  <div className={`clinical-status-strip ${dueNow.length > 0 ? 'bg-amber-500' : 'bg-primary'}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{patientName(admission.patientId)}</p>
                      <p className="clinical-label">
                        {admission.admissionNumber} - {admissionLocation(admission)}
                      </p>
                      {dueNow.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                          <span className="text-xs text-amber-600 font-medium">{dueNow.length} medication(s) due now</span>
                        </div>
                      )}
                      {scheduledMeds.length === 0 && (
                        <p className="text-xs text-muted-foreground italic mt-1">No active medication orders</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 rounded-full"
                      onClick={() => onOpenMar(admission, scheduledMeds)}
                    >
                      View MAR
                    </Button>
                  </div>
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
