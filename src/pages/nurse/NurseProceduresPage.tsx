import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { RoomWorkBoard } from '@/components/nurse/RoomWorkBoard';

export default function NurseProceduresPage() {
  const { profile } = useAuth();

  return (
    <RoleLayout
      title="Procedure Room"
      subtitle="Preparation, procedure support, notes and completion"
      role="nurse"
      userName={profile?.fullName}
    >
      <RoomWorkBoard mode="procedure" />
    </RoleLayout>
  );
}
