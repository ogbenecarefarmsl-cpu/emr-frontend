import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, Loader2, Stethoscope, TestTube, Scissors, UserCog, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { patientName } from './nurseUtils';

interface TriageQueuePanelProps {
  visits: any[];
  isLoading?: boolean;
  onOpenTriage: (visit: any) => void;
  onOpenRapidTest?: (visit: any) => void;
  maxHeightClassName?: string;
}

const SERVICE_TYPE_META: Record<string, { label: string; icon: any; className: string; needsTestEntry: boolean }> = {
  normal_consultation: { label: 'Consultation', icon: Stethoscope, className: 'bg-blue-50 text-blue-700 border-blue-200', needsTestEntry: false },
  specialist_consultation: { label: 'Specialist', icon: UserCog, className: 'bg-violet-50 text-violet-700 border-violet-200', needsTestEntry: false },
  observation_4h: { label: 'Observation', icon: Stethoscope, className: 'bg-cyan-50 text-cyan-700 border-cyan-200', needsTestEntry: false },
  procedure: { label: 'Procedure', icon: Scissors, className: 'bg-rose-50 text-rose-700 border-rose-200', needsTestEntry: false },
};

export function TriageQueuePanel({
  visits,
  isLoading,
  onOpenTriage,
  onOpenRapidTest,
  maxHeightClassName = 'max-h-[calc(100vh-340px)]',
}: TriageQueuePanelProps) {
  return (
    <div className="clinical-panel overflow-hidden">
      <div className="clinical-panel-header">
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
            {visits.map((visit) => {
              const svc = visit.serviceType ? SERVICE_TYPE_META[visit.serviceType] : null;
              const Icon = svc?.icon || Stethoscope;
              const hasResult = (visit.rapidTestResults || []).length > 0;
              return (
                <div key={visit._id} className="clinical-list-row relative p-3 pl-5">
                  <div className={cn('clinical-status-strip', svc ? 'bg-blue-500' : 'bg-amber-500')} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm truncate">{patientName(visit.patientId)}</p>
                        {svc && (
                          <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border', svc.className)}>
                            <Icon className="w-3 h-3" />
                            {svc.label}
                          </span>
                        )}
                        {hasResult && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                            <Check className="w-3 h-3" /> Result on file
                          </span>
                        )}
                      </div>
                      <p className="clinical-label">
                        {visit.visitNumber} - {visit.patientId?.patientId}
                      </p>
                      {visit.procedureType && (
                        <p className="text-xs font-medium text-rose-700 mt-0.5">Procedure: {visit.procedureType}</p>
                      )}
                      {visit.rapidTestsRequested && visit.rapidTestsRequested.length > 0 && (
                        <p className="text-xs font-medium text-amber-700 mt-0.5">Tests Requested: {visit.rapidTestsRequested.join(', ')}</p>
                      )}
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
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {(svc?.needsTestEntry || (visit.rapidTestsRequested && visit.rapidTestsRequested.length > 0)) && onOpenRapidTest && (
                        <Button
                          size="sm"
                          variant={hasResult ? 'outline' : 'default'}
                          className="rounded-full"
                          onClick={() => onOpenRapidTest(visit)}
                        >
                          <TestTube className="w-3 h-3 mr-1" />
                          {hasResult ? 'Update Result' : 'Enter Result'}
                        </Button>
                      )}
                      <Button size="sm" variant={svc?.needsTestEntry ? 'outline' : 'default'} className="rounded-full" onClick={() => onOpenTriage(visit)}>
                        Triage
                      </Button>
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
