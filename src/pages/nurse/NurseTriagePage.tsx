import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { TriageDialog } from '@/components/nurse/TriageDialog';
import { TriageQueuePanel } from '@/components/nurse/TriageQueuePanel';
import { useAwaitingTriage } from '@/hooks/useVisits';

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
      <div className="max-w-6xl">
        <TriageQueuePanel
          visits={triageQueue}
          isLoading={isLoading}
          onOpenTriage={openTriage}
          maxHeightClassName="max-h-[calc(100vh-230px)]"
        />
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
