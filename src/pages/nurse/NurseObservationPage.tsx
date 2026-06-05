import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { RoomWorkBoard } from '@/components/nurse/RoomWorkBoard';

export default function NurseObservationPage() {
  const { profile } = useAuth();

  return (
    <RoleLayout
      title="Observation Room"
      subtitle="Short-stay monitoring and doctor-review readiness"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="max-w-7xl">
        <RoomWorkBoard mode="observation" />
      </div>
    </RoleLayout>
  );
}
