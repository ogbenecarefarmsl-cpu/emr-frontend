import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { TriageDialog } from '@/components/nurse/TriageDialog';
import { TriageQueuePanel } from '@/components/nurse/TriageQueuePanel';
import { RapidTestResultDialog } from '@/components/nurse/RapidTestResultDialog';
import { useAwaitingTriage } from '@/hooks/useVisits';

const ESI_PRIORITY_RANK: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

export default function NurseTriagePage() {
  const { profile } = useAuth();
  const { data: triageQueue = [], isLoading } = useAwaitingTriage();
  const [triageVisit, setTriageVisit] = useState<any>(null);
  const [triageOpen, setTriageOpen] = useState(false);
  const [rapidVisit, setRapidVisit] = useState<any>(null);
  const [rapidOpen, setRapidOpen] = useState(false);

  const sortedQueue = useMemo(() => {
    return [...triageQueue].sort((a: any, b: any) => {
      const rankA = ESI_PRIORITY_RANK[(a.triagePriority || '').toLowerCase()] ?? 2;
      const rankB = ESI_PRIORITY_RANK[(b.triagePriority || '').toLowerCase()] ?? 2;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [triageQueue]);

  const openTriage = (visit: any) => {
    setTriageVisit(visit);
    setTriageOpen(true);
  };

  const openRapidTest = (visit: any) => {
    setRapidVisit(visit);
    setRapidOpen(true);
  };

  return (
    <RoleLayout
      title="Nurse Triage"
      subtitle="Vitals, ESI priority, rapid test entry and nurse handoff to doctor queue"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="max-w-6xl">
        <TriageQueuePanel
          visits={sortedQueue}
          isLoading={isLoading}
          onOpenTriage={openTriage}
          onOpenRapidTest={openRapidTest}
          maxHeightClassName="max-h-[calc(100vh-230px)]"
        />
      </div>
      <TriageDialog
        visit={triageVisit}
        open={triageOpen}
        onOpenChange={setTriageOpen}
        onCompleted={() => setTriageVisit(null)}
      />
      <RapidTestResultDialog
        visit={rapidVisit}
        open={rapidOpen}
        onOpenChange={setRapidOpen}
      />
    </RoleLayout>
  );
}
