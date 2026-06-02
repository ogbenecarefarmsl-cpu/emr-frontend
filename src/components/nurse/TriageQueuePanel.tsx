import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { patientName } from './nurseUtils';

interface TriageQueuePanelProps {
  visits: any[];
  isLoading?: boolean;
  onOpenTriage: (visit: any) => void;
  maxHeightClassName?: string;
}

export function TriageQueuePanel({
  visits,
  isLoading,
  onOpenTriage,
  maxHeightClassName = 'max-h-[calc(100vh-340px)]',
}: TriageQueuePanelProps) {
  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Triage Queue
        </h3>
        <Badge variant={visits.length > 0 ? 'default' : 'secondary'}>{visits.length}</Badge>
      </div>
      <ScrollArea className={maxHeightClassName}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : visits.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No patients waiting for triage
          </div>
        ) : (
          <div className="divide-y">
            {visits.map((visit) => (
              <div key={visit._id} className="grid gap-3 border-l-4 border-l-amber-500 p-4 hover:bg-muted/30 transition-colors md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm truncate">{patientName(visit.patientId)}</p>
                    <Badge variant="outline" className="text-[10px]">{visit.visitType || 'OPD'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {visit.visitNumber} - {visit.patientId?.patientId || visit.patientId?.mrn || 'No MRN'}
                  </p>
                  {visit.chiefComplaint && (
                    <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">
                      "{visit.chiefComplaint}"
                    </p>
                  )}
                  {visit.patientId?.allergies?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="text-xs text-red-600 font-medium truncate">
                        {visit.patientId.allergies.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Payment cleared</p>
                  <p>Awaiting vitals</p>
                </div>
                <Button size="sm" className="md:w-28" onClick={() => onOpenTriage(visit)}>
                  Open Triage
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
