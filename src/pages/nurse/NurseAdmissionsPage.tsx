import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { AdmissionList } from '@/components/nurse/AdmissionList';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';
import { AdmissionWorkspace } from './AdmissionWorkspace';
import { Button } from '@/components/ui/button';
import { Stethoscope } from 'lucide-react';

export default function NurseAdmissionsPage() {
  const { profile } = useAuth();
  const { data: dashboard, isLoading } = useAdmissionsDashboard(false);
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);

  return (
    <RoleLayout
      title="Admissions"
      subtitle="Inpatient ward board, nursing chart and care documentation"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AdmissionList
            admissions={activeAdmissions}
            isLoading={isLoading}
            selectedAdmissionId={selectedAdmissionId}
            onSelect={(admission) => setSelectedAdmissionId(admission._id)}
          />
        </div>

        <div className="lg:col-span-2">
          {selectedAdmissionId ? (
            <AdmissionWorkspace
              admissionId={selectedAdmissionId}
              onClose={() => setSelectedAdmissionId(null)}
              onDischarged={() => setSelectedAdmissionId(null)}
            />
          ) : (
            <div className="bg-card border rounded-xl shadow-sm flex flex-col items-center justify-center h-96 text-muted-foreground p-6 text-center">
              <Stethoscope className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No Admission Selected</p>
              <p className="text-sm mt-1 max-w-sm">
                Select an active admission to open vitals, MAR, fluids, nursing notes, handover and care plan.
              </p>
              {activeAdmissions.length > 0 && (
                <Button variant="outline" className="mt-4" onClick={() => setSelectedAdmissionId(activeAdmissions[0]._id)}>
                  Open first admission
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </RoleLayout>
  );
}
