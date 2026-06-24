import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { MarDialog } from '@/components/nurse/MarDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { prescriptionService } from '@/services/prescriptionService';
import { AlertCircle, Clock, Loader2, Pill, Check, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NurseMarPage() {
  const { profile } = useAuth();
  const [marOpen, setMarOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);

  const { data: marWorklist = [], isLoading } = useQuery({
    queryKey: ['prescriptions', 'mar-worklist'],
    queryFn: () => prescriptionService.getMarWorklist(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const dueNow = marWorklist.filter((rx: any) => rx.nextDueAt && new Date(rx.nextDueAt) <= new Date());
  const upcoming = marWorklist.filter((rx: any) => rx.nextDueAt && new Date(rx.nextDueAt) > new Date());
  const completed = marWorklist.filter((rx: any) => rx.status === 'completed');

  return (
    <RoleLayout
      title="Medication Rounds"
      subtitle="Medication administration record for all patients"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="max-w-6xl space-y-4">
        {/* Summary badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />Due Now: {dueNow.length}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />Upcoming: {upcoming.length}
          </Badge>
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
            <Check className="w-3 h-3 mr-1" />Completed: {completed.length}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : marWorklist.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No medications to administer</p>
            <p className="text-sm mt-1">All prescriptions are up to date</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-280px)]">
            <div className="space-y-4">
              {/* Due Now */}
              {dueNow.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Due Now
                  </h3>
                  <div className="space-y-2">
                    {dueNow.map((rx: any) => (
                      <MarWorklistCard key={rx._id} rx={rx} onAdminister={() => { setSelectedPrescription(rx); setMarOpen(true); }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Upcoming
                  </h3>
                  <div className="space-y-2">
                    {upcoming.map((rx: any) => (
                      <MarWorklistCard key={rx._id} rx={rx} onAdminister={() => { setSelectedPrescription(rx); setMarOpen(true); }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Today */}
              {completed.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Completed
                  </h3>
                  <div className="space-y-2">
                    {completed.map((rx: any) => (
                      <MarWorklistCard key={rx._id} rx={rx} onAdminister={() => { setSelectedPrescription(rx); setMarOpen(true); }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <MarDialog
        prescription={selectedPrescription}
        open={marOpen}
        onOpenChange={setMarOpen}
      />
    </RoleLayout>
  );
}

function MarWorklistCard({ rx, onAdminister }: { rx: any; onAdminister: () => void }) {
  const patient = rx.patientId;
  const firstItem = rx.items?.[0];
  const route = firstItem?.route || 'oral';
  const isInjectable = ['intravenous', 'intramuscular', 'subcutaneous'].includes(route);
  const progress = rx.totalDoses > 0 ? Math.round((rx.dosesGiven / rx.totalDoses) * 100) : 0;
  const isCompleted = rx.status === 'completed';
  const isDue = rx.nextDueAt && new Date(rx.nextDueAt) <= new Date();

  const lastAdmin = rx.administrationLog?.[rx.administrationLog.length - 1];

  return (
    <div className={cn(
      'border rounded-lg p-4 transition-colors',
      isCompleted ? 'bg-green-50 border-green-200' : isDue ? 'bg-red-50 border-red-200' : 'bg-card'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{patient?.firstName} {patient?.lastName}</span>
            <Badge variant="outline" className="text-[10px] font-mono">{patient?.patientId}</Badge>
            {rx.isAdmitted && (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                {rx.admissionNumber || 'Admitted'}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-[10px]', isInjectable ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-700')}>
              {route.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm mt-1 font-medium">
            {firstItem?.medicationName} — {firstItem?.strengthPerDose}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {firstItem?.dosesPerDay}x/day × {firstItem?.durationDays} days
          </p>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', isCompleted ? 'bg-green-500' : 'bg-primary')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {rx.dosesGiven}/{rx.totalDoses}
            </span>
          </div>

          {lastAdmin && (
            <p className={cn('text-xs mt-1.5 font-medium', lastAdmin.refused ? 'text-rose-600' : 'text-primary')}>
              {lastAdmin.refused ? 'Refused' : 'Last given'}: {new Date(lastAdmin.administeredAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {lastAdmin.administeredByName && ` by ${lastAdmin.administeredByName}`}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {isCompleted ? (
            <Badge className="bg-green-100 text-green-700">
              <Check className="w-3 h-3 mr-1" /> Done
            </Badge>
          ) : (
            <Button
              size="sm"
              variant={isDue ? 'default' : 'outline'}
              onClick={onAdminister}
            >
              {isDue ? 'Give Now' : 'Administer'}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
