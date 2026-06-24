import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Check, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MedicationWorklistProps {
  prescriptions: any[];
  onOpenMar: (prescription: any) => void;
  maxHeightClassName?: string;
}

export function getDueNow(prescriptions: any[]) {
  return prescriptions.filter((rx) => rx.nextDueAt && new Date(rx.nextDueAt) <= new Date() && rx.status !== 'completed');
}

export function MedicationWorklist({
  prescriptions,
  onOpenMar,
  maxHeightClassName = 'max-h-[calc(100vh-340px)]',
}: MedicationWorklistProps) {
  const dueNow = getDueNow(prescriptions);
  const upcoming = prescriptions.filter((rx) => rx.nextDueAt && new Date(rx.nextDueAt) > new Date() && rx.status !== 'completed');
  const completed = prescriptions.filter((rx) => rx.status === 'completed');

  return (
    <div className="clinical-panel overflow-hidden">
      <div className="clinical-panel-header">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          Medication Administration Record
        </h3>
        <div className="flex items-center gap-2">
          {dueNow.length > 0 && <Badge variant="destructive">{dueNow.length} due</Badge>}
          {completed.length > 0 && <Badge variant="outline" className="bg-green-50 text-green-700">{completed.length} done</Badge>}
        </div>
      </div>
      <ScrollArea className={maxHeightClassName}>
        {prescriptions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm px-4">
            No medications to administer
          </div>
        ) : (
          <div className="divide-y">
            {prescriptions.map((rx) => {
              const patient = rx.patientId;
              const firstItem = rx.items?.[0];
              const route = firstItem?.route || 'oral';
              const isInjectable = ['intravenous', 'intramuscular', 'subcutaneous'].includes(route);
              const progress = rx.totalDoses > 0 ? Math.round((rx.dosesGiven / rx.totalDoses) * 100) : 0;
              const isCompleted = rx.status === 'completed';
              const isDue = rx.nextDueAt && new Date(rx.nextDueAt) <= new Date();
              const lastAdmin = rx.administrationLog?.[rx.administrationLog.length - 1];

              return (
                <div key={rx._id} className="clinical-list-row relative p-3 pl-5">
                  <div className={cn('clinical-status-strip', isCompleted ? 'bg-green-500' : isDue ? 'bg-amber-500' : 'bg-primary')} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{patient?.firstName} {patient?.lastName}</p>
                        {rx.isAdmitted && (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">Admitted</Badge>
                        )}
                        <Badge variant="outline" className={cn('text-[10px]', isInjectable ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-700')}>
                          {route.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {firstItem?.medicationName} — {firstItem?.strengthPerDose}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                          <div
                            className={cn('h-full rounded-full', isCompleted ? 'bg-green-500' : 'bg-primary')}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{rx.dosesGiven}/{rx.totalDoses}</span>
                      </div>
                      {lastAdmin && (
                        <p className={cn('text-[10px] mt-0.5 font-medium', lastAdmin.refused ? 'text-rose-600' : 'text-primary')}>
                          {lastAdmin.refused ? 'Refused' : 'Last'}: {new Date(lastAdmin.administeredAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <Check className="w-3 h-3 mr-1" /> Done
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant={isDue ? 'default' : 'outline'}
                          className="rounded-full text-xs"
                          onClick={() => onOpenMar(rx)}
                        >
                          {isDue ? 'Give' : 'View'}
                        </Button>
                      )}
                    </div>
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
