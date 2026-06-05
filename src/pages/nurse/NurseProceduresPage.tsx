import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { RoomWorkBoard } from '@/components/nurse/RoomWorkBoard';

export default function NurseProceduresPage() {
  const { profile } = useAuth();

  return (
    <RoleLayout
      title="Procedure Room"
      subtitle="Procedure prep, in-procedure tracking and completion notes"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="max-w-7xl">
        <RoomWorkBoard mode="procedure" />
      </div>
    </RoleLayout>
  );
}
