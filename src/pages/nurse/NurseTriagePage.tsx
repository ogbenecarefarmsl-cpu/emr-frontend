import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { TriageDialog } from '@/components/nurse/TriageDialog';
import { TriageQueuePanel } from '@/components/nurse/TriageQueuePanel';
import { useAwaitingTriage } from '@/hooks/useVisits';
import { Activity, Clock, Stethoscope } from 'lucide-react';

export default function NurseTriagePage() {
  const { profile } = useAuth();
  const { data: triageQueue = [], isLoading } = useAwaitingTriage();
  const [triageVisit, setTriageVisit] = useState<any>(null);
  const [triageOpen, setTriageOpen] = useState(false);

  const openTriage = (visit: any) => {
    setTriageVisit(visit);
    setTriageOpen(true);
  };

  return (
    <RoleLayout
      title="Nurse Triage"
      subtitle="Vitals, ESI priority and nurse handoff to doctor queue"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <TriageQueuePanel
          visits={triageQueue}
          isLoading={isLoading}
          onOpenTriage={openTriage}
          maxHeightClassName="max-h-[calc(100vh-270px)]"
        />
        <div className="grid gap-4 content-start">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Triage Load</p>
                <h3 className="mt-1 text-2xl font-bold">{triageQueue.length}</h3>
              </div>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Patients are routed here after consultation payment. Nurse records vitals and selects the doctor before handoff.</p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Vitals Capture</h3>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {['Temperature', 'Blood pressure', 'Pulse', 'Respiration', 'SpO2', 'Weight'].map((item) => (
                <div key={item} className="rounded-lg border bg-muted/20 px-3 py-2 text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Doctor Handoff</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">The triage dialog now requires a doctor selection, so patients land in the correct doctor queue instead of a generic queue.</p>
          </div>
        </div>
      </div>
      <TriageDialog
        visit={triageVisit}
        open={triageOpen}
        onOpenChange={setTriageOpen}
        onCompleted={() => setTriageVisit(null)}
      />
    </RoleLayout>
  );
}
