import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, ClipboardList, HeartPulse } from 'lucide-react';

interface RoomWorkBoardProps {
  mode: 'observation' | 'procedure';
}

const config = {
  observation: {
    icon: HeartPulse,
    title: 'Observation Queue',
    rows: [
      { label: 'Awaiting nurse receive', value: 0 },
      { label: 'Monitoring in progress', value: 0 },
      { label: 'Ready for doctor review', value: 0 },
    ],
    empty: 'No patients currently assigned to observation.',
  },
  procedure: {
    icon: ClipboardList,
    title: 'Procedure Queue',
    rows: [
      { label: 'Awaiting preparation', value: 0 },
      { label: 'In procedure', value: 0 },
      { label: 'Ready for completion note', value: 0 },
    ],
    empty: 'No active procedure-room tasks.',
  },
};

export function RoomWorkBoard({ mode }: RoomWorkBoardProps) {
  const board = config[mode];
  const Icon = board.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-card border rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{board.title}</h3>
        </div>
        <div className="mt-5 space-y-3">
          {board.rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <Badge variant={row.value > 0 ? 'default' : 'outline'}>{row.value}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 bg-card border rounded-xl min-h-[420px] flex flex-col items-center justify-center text-center p-8">
        <Activity className="w-14 h-14 text-muted-foreground/30 mb-4" />
        <p className="font-medium">{board.empty}</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Patients will appear here after the doctor routes them to this room and the room assignment is active.
        </p>
        <Button variant="outline" className="mt-5" disabled>
          Awaiting room assignments
        </Button>
      </div>
    </div>
  );
}
