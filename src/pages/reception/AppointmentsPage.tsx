import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  Calendar, Clock, UserPlus, Search, Loader2, ArrowRight, User, Stethoscope,
} from 'lucide-react';

export default function AppointmentsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    date: '',
    time: '',
    reason: '',
    notes: '',
  });
  const [patientSearch, setPatientSearch] = useState('');

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const res = await api.get('/appointments');
      return res.data || [];
    },
    refetchInterval: 30 * 1000,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const res = await api.get('/doctors');
      return res.data || [];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: async () => {
      if (!patientSearch) return [];
      const res = await api.get('/patients/search', { params: { q: patientSearch } });
      return res.data || [];
    },
    enabled: patientSearch.length > 0,
  });

  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: async () => {
      const res = await api.get('/appointments/today');
      return res.data || [];
    },
    refetchInterval: 30 * 1000,
  });

  const createAppointment = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/appointments', data, {
        params: { userId: profile?._id },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Appointment booked successfully');
      setShowForm(false);
      setForm({ patientId: '', doctorId: '', date: '', time: '', reason: '', notes: '' });
      setPatientSearch('');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments', 'today'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to book appointment');
    },
  });

  const checkIn = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/appointments/${id}/check-in`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Patient checked in');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments', 'today'] });
    },
  });

  const filteredAppointments = searchTerm
    ? appointments.filter((a: any) =>
        `${a.patientId?.firstName} ${a.patientId?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.appointmentNumber?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : appointments;

  const today = new Date().toISOString().split('T')[0];

  return (
    <RoleLayout
      title="Appointments"
      subtitle="Schedule and manage patient appointments"
      role="receptionist"
      userName={profile?.fullName}
    >
      {/* Quick Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search appointments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Calendar className="w-4 h-4 mr-2" />
          {showForm ? 'Cancel' : 'Book Appointment'}
        </Button>
      </div>

      {/* Booking Form */}
      {showForm && (
        <div className="bg-card border rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            New Appointment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Patient *</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patient..."
                  className="pl-8"
                />
              </div>
              {patientSearch && patients.length > 0 && (
                <div className="mt-1 border rounded-lg max-h-32 overflow-y-auto">
                  {patients.slice(0, 5).map((p: any) => (
                    <div
                      key={p._id}
                      className="p-2 hover:bg-muted/50 cursor-pointer border-b text-sm"
                      onClick={() => {
                        setForm({ ...form, patientId: p._id });
                        setPatientSearch(`${p.firstName} ${p.lastName}`);
                      }}
                    >
                      {p.firstName} {p.lastName} ({p.patientId})
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Doctor *</Label>
              <Select value={form.doctorId} onValueChange={(v) => setForm({ ...form, doctorId: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d: any) => (
                    <SelectItem key={d._id} value={d._id}>{d.fullName}{d.department ? ` — ${d.department}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                min={today}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Time *</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Reason</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Reason for appointment..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={() => createAppointment.mutate(form)}
              disabled={createAppointment.isPending || !form.patientId || !form.doctorId || !form.date || !form.time}
            >
              {createAppointment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              Book Appointment
            </Button>
          </div>
        </div>
      )}

      {/* Today's Appointments */}
      {todayAppointments.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm mb-6">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Today's Schedule
            </h3>
          </div>
          <div className="divide-y">
            {todayAppointments.map((apt: any) => (
              <div key={apt._id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{apt.patientId?.firstName} {apt.patientId?.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {apt.time} · {apt.doctorId?.fullName} · {apt.reason || 'No reason specified'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={apt.status === 'checked_in' ? 'default' : 'outline'} className="text-[10px] capitalize">
                    {apt.status.replace('_', ' ')}
                  </Badge>
                  {apt.status === 'scheduled' && (
                    <Button size="sm" className="text-xs h-7" onClick={() => checkIn.mutate(apt._id)}>
                      Check In
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Appointments */}
      <div className="bg-card border rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-sm">All Appointments</h3>
        </div>
        <div className="divide-y">
          {filteredAppointments.length > 0 ? filteredAppointments.slice(0, 20).map((apt: any) => (
            <div key={apt._id} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{apt.patientId?.firstName} {apt.patientId?.lastName}</p>
                <p className="text-xs text-muted-foreground">
                  {apt.appointmentNumber} · {new Date(apt.date).toLocaleDateString()} {apt.time} · {apt.doctorId?.fullName}
                </p>
              </div>
              <Badge variant={apt.status === 'completed' ? 'default' : apt.status === 'cancelled' ? 'destructive' : 'outline'} className="text-[10px] capitalize">
                {apt.status.replace('_', ' ')}
              </Badge>
            </div>
          )) : (
            <div className="px-5 py-10 text-center text-muted-foreground text-sm">
              No appointments found
            </div>
          )}
        </div>
      </div>
    </RoleLayout>
  );
}
