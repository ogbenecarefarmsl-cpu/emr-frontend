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
    <div className="bg-card border rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Awaiting Triage
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
              <div key={visit._id} className="p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{patientName(visit.patientId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {visit.visitNumber} - {visit.patientId?.patientId}
                    </p>
                    {visit.chiefComplaint && (
                      <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-2">
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
                  <Button size="sm" className="flex-shrink-0" onClick={() => onOpenTriage(visit)}>
                    Triage
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
