import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Bed, ClipboardList, HeartPulse, Loader2, RefreshCw, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRooms, useVisitsByRoom } from '@/hooks/useVisits';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';
import { admissionLocation, patientName } from './nurseUtils';
import { cn } from '@/lib/utils';

interface RoomWorkBoardProps {
  mode: 'observation' | 'procedure';
}

const OBSERVATION_STATUSES = ['awaiting', 'monitoring', 'ready_for_review'] as const;
const PROCEDURE_STATUSES = ['preparing', 'in_procedure', 'ready_for_note'] as const;

const STATUS_LABELS: Record<string, string> = {
  awaiting: 'Awaiting nurse receive',
  monitoring: 'Monitoring in progress',
  ready_for_review: 'Ready for doctor review',
  preparing: 'Awaiting preparation',
  in_procedure: 'In procedure',
  ready_for_note: 'Ready for completion note',
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  awaiting: 'outline',
  preparing: 'outline',
  monitoring: 'secondary',
  in_procedure: 'secondary',
  ready_for_review: 'default',
  ready_for_note: 'default',
};

const STATUS_TO_FILTER: Record<string, string> = {
  awaiting: 'awaiting_triage',
  preparing: 'awaiting_triage',
  monitoring: 'in_progress',
  in_procedure: 'in_progress',
  ready_for_review: 'in_consultation',
  ready_for_note: 'in_consultation',
};

export function RoomWorkBoard({ mode }: RoomWorkBoardProps) {
  const navigate = useNavigate();
  const roomType = mode;
  const statuses = mode === 'observation' ? OBSERVATION_STATUSES : PROCEDURE_STATUSES;
  const [activeStatus, setActiveStatus] = useState<string>(statuses[0]);
  const [search, setSearch] = useState('');

  const { data: rooms = [], isLoading: roomsLoading, refetch: refetchRooms } = useRooms(roomType);
  const { data: visits = [], isLoading: visitsLoading, refetch: refetchVisits } = useVisitsByRoom(roomType);
  const { data: dashboard } = useAdmissionsDashboard(false);
  const admissions = dashboard?.activeAdmissions || [];

  const filteredVisits = useMemo(() => {
    const statusFilter = STATUS_TO_FILTER[activeStatus];
    let list = visits;
    if (statusFilter) {
      list = list.filter((v: any) => v.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v: any) => {
        const p = v.patientId;
        return (
          v.visitNumber?.toLowerCase().includes(q) ||
          p?.firstName?.toLowerCase().includes(q) ||
          p?.lastName?.toLowerCase().includes(q) ||
          p?.patientId?.toLowerCase().includes(q) ||
          v.chiefComplaint?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [visits, activeStatus, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of statuses) {
      const f = STATUS_TO_FILTER[s];
      c[s] = visits.filter((v: any) => !f || v.status === f).length;
    }
    return c;
  }, [visits, statuses]);

  const boardIcon = mode === 'observation' ? HeartPulse : ClipboardList;
  const boardTitle = mode === 'observation' ? 'Observation Queue' : 'Procedure Queue';
  const emptyText = mode === 'observation'
    ? 'No patients currently assigned to observation.'
    : 'No active procedure-room tasks.';
  const Icon = boardIcon;

  const onRefresh = () => { refetchVisits(); refetchRooms(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">{boardTitle}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, ID or complaint"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" size="icon" onClick={onRefresh} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bed className="w-4 h-4 text-primary" /> Status counts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStatus(s)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                    activeStatus === s ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                  )}
                >
                  <span>{STATUS_LABELS[s]}</span>
                  <Badge variant={STATUS_BADGE_VARIANT[s] || 'outline'}>{counts[s] || 0}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bed className="w-4 h-4 text-primary" /> {roomType} rooms
              </CardTitle>
            </CardHeader>
            <CardContent>
              {roomsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : rooms.length === 0 ? (
                <p className="text-xs text-muted-foreground">No {roomType} rooms seeded. Run the room seed to create them.</p>
              ) : (
                <div className="space-y-1">
                  {rooms.map((r: any) => (
                    <div key={r._id} className="flex items-center justify-between text-xs">
                      <span className="truncate">{r.name}</span>
                      <Badge variant={r.status === 'available' ? 'outline' : r.status === 'occupied' ? 'default' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> {STATUS_LABELS[activeStatus]}
                </span>
                <Badge variant="outline">{filteredVisits.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {visitsLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : filteredVisits.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{emptyText}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredVisits.map((v: any) => {
                    const p = v.patientId;
                    const admission = admissions.find((a: any) => a.visitId === v._id || a.visitId?.toString() === v._id?.toString());
                    return (
                      <div key={v._id} className="p-3 pl-4 flex items-center justify-between gap-3 hover:bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{patientName(p)}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.visitNumber} - {p?.patientId} - {v.room || 'unassigned'}
                          </p>
                          {v.chiefComplaint && (
                            <p className="text-xs text-muted-foreground italic mt-0.5 truncate">CC: {v.chiefComplaint}</p>
                          )}
                          {admission && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Ward: {admissionLocation(admission)} - Bed: {admission.bedNumber || '—'}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Badge variant={STATUS_BADGE_VARIANT[activeStatus] || 'outline'}>{STATUS_LABELS[activeStatus]}</Badge>
                          {admission && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate('/nurse/admissions')}>
                              <Stethoscope className="w-3 h-3 mr-1" /> Workspace
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
