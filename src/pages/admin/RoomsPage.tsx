import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BedDouble, Loader2, Plus, RefreshCw, DoorOpen, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  available: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  occupied: 'bg-blue-500/10 text-blue-600 border-blue-200',
  maintenance: 'bg-amber-500/10 text-amber-600 border-amber-200',
  reserved: 'bg-purple-500/10 text-purple-600 border-purple-200',
};

export default function RoomsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', roomType: 'consultation', floor: '' });

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms', filterType, filterStatus],
    queryFn: () => roomsAPI.getAll({
      roomType: filterType !== 'all' ? filterType : undefined,
      status: filterStatus !== 'all' ? filterStatus : undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newRoom) => roomsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room created');
      setShowCreate(false);
      setNewRoom({ name: '', roomType: 'consultation', floor: '' });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => roomsAPI.releaseRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room released');
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => roomsAPI.seed(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success(`${data.message}`);
    },
  });

  const handleCreate = () => {
    if (!newRoom.name.trim()) { toast.error('Room name is required'); return; }
    createMutation.mutate(newRoom);
  };

  const occupiedCount = Array.isArray(rooms) ? rooms.filter((r: any) => r.status === 'occupied').length : 0;
  const availableCount = Array.isArray(rooms) ? rooms.filter((r: any) => r.status === 'available').length : 0;

  return (
    <RoleLayout title="Room Management" subtitle="Track and assign clinical rooms" role="admin" userName={profile?.fullName}>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Rooms</p>
          <p className="text-2xl font-bold">{Array.isArray(rooms) ? rooms.length : 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium text-muted-foreground">Available</p>
          <p className="text-2xl font-bold text-emerald-600">{availableCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-muted-foreground">Occupied</p>
          <p className="text-2xl font-bold text-blue-600">{occupiedCount}</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center gap-3 mb-6">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="consultation">Consultation</SelectItem>
            <SelectItem value="treatment">Treatment</SelectItem>
            <SelectItem value="procedure">Procedure</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="observation">Observation</SelectItem>
            <SelectItem value="triage">Triage</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          <RefreshCw className="w-4 h-4 mr-2" /> Seed Defaults
        </Button>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Room</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Room</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Room Name</Label>
                <Input value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Consultation Room 4" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newRoom.roomType} onValueChange={v => setNewRoom(p => ({ ...p, roomType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="treatment">Treatment</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="observation">Observation</SelectItem>
                    <SelectItem value="triage">Triage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Floor</Label>
                <Input value={newRoom.floor} onChange={e => setNewRoom(p => ({ ...p, floor: e.target.value }))} placeholder="e.g., 1, 2, Ground" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !Array.isArray(rooms) || rooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No rooms found. Click "Seed Defaults" to create standard rooms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rooms.map((room: any) => (
            <div key={room._id} className={cn(
              'bg-card border rounded-xl p-5 transition-all hover:shadow-md',
              room.status === 'occupied' && 'border-l-4 border-l-blue-500',
              room.status === 'available' && 'border-l-4 border-l-emerald-500',
              room.status === 'maintenance' && 'border-l-4 border-l-amber-500',
              room.status === 'reserved' && 'border-l-4 border-l-purple-500',
            )}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{room.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{room.roomType}{room.floor ? ` · Floor ${room.floor}` : ''}</p>
                </div>
                <Badge variant="outline" className={cn('capitalize', statusColors[room.status])}>
                  {room.status}
                </Badge>
              </div>
              {room.status === 'occupied' && room.currentVisitId && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Current Visit</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 font-mono">{room.currentVisitId.toString().slice(-8)}</p>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Capacity: {room.capacity || 1}</span>
                <span>Updated: {room.updatedAt ? format(new Date(room.updatedAt), 'MMM dd') : '-'}</span>
              </div>
              {room.status === 'occupied' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3 text-xs"
                  onClick={() => releaseMutation.mutate(room._id)}
                  disabled={releaseMutation.isPending}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Release Room
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </RoleLayout>
  );
}
