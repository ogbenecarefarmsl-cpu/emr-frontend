import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { MarDialog } from '@/components/nurse/MarDialog';
import { MedicationWorklist } from '@/components/nurse/MedicationWorklist';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';

export default function NurseMarPage() {
  const { profile } = useAuth();
  const { data: dashboard } = useAdmissionsDashboard(false);
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const [marOpen, setMarOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);

  return (
    <RoleLayout
      title="Medication Rounds"
      subtitle="Medication administration record for active admissions"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="max-w-6xl">
        <MedicationWorklist
          admissions={activeAdmissions}
          maxHeightClassName="max-h-[calc(100vh-230px)]"
          onOpenMar={(admission) => {
            setSelectedAdmission(admission);
            setMarOpen(true);
          }}
        />
      </div>
      <MarDialog
        admission={selectedAdmission}
        open={marOpen}
        onOpenChange={setMarOpen}
      />
    </RoleLayout>
  );
}
