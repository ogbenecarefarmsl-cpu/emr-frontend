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
      <RoomWorkBoard mode="observation" />
    </RoleLayout>
  );
}
