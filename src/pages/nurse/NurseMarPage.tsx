import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { MarDialog } from '@/components/nurse/MarDialog';
import { MedicationWorklist, getDueNow, getScheduledMeds } from '@/components/nurse/MedicationWorklist';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';

export default function NurseMarPage() {
  const { profile } = useAuth();
  const { data: dashboard } = useAdmissionsDashboard(false);
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const allMeds = activeAdmissions.flatMap((admission: any) => getScheduledMeds(admission));
  const dueNow = getDueNow(allMeds);
  const administered = allMeds.filter((med: any) => med.status === 'given' || med.status === 'administered');
  const [marOpen, setMarOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [medications, setMedications] = useState<any[]>([]);

  return (
    <RoleLayout
      title="Medication Rounds"
      subtitle="Medication administration record for active admissions"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending doses</p>
            <p className="mt-1 text-2xl font-bold">{Math.max(allMeds.length - administered.length, 0)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overdue / due now</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{dueNow.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administered</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{administered.length}</p>
          </div>
        </div>
        <MedicationWorklist
          admissions={activeAdmissions}
          maxHeightClassName="max-h-[calc(100vh-330px)]"
          onOpenMar={(admission, scheduledMeds) => {
            setSelectedAdmission(admission);
            setMedications(scheduledMeds);
            setMarOpen(true);
          }}
        />
      </div>
      <MarDialog
        admission={selectedAdmission}
        medications={medications}
        open={marOpen}
        onOpenChange={setMarOpen}
      />
    </RoleLayout>
  );
}
