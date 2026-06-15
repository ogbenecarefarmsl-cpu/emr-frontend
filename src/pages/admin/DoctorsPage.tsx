import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useCreateDoctor, useDoctors } from '@/hooks/useDoctors';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Printer, Search, Stethoscope, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DoctorsPage() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const role = pathname.startsWith('/reception') ? 'receptionist' : 'admin';

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [facility, setFacility] = useState('');
  const [userId, setUserId] = useState('');

  const { data: doctors = [], isLoading } = useDoctors(search || undefined);
  const { data: users = [] } = useUsers();
  const createDoctor = useCreateDoctor();

  const doctorUsers = users.filter((u: any) =>
    u.user_roles?.some((r: any) => r.role === 'doctor' || r.role === 'specialist')
  );

  const doctorCount = useMemo(() => (Array.isArray(doctors) ? doctors.length : 0), [doctors]);

  const onAddDoctor = async () => {
    if (!name.trim()) {
      toast.error('Doctor name is required');
      return;
    }
    try {
      await createDoctor.mutateAsync({
        fullName: name.trim(),
        phone: phone.trim() || undefined,
        facility: facility.trim() || undefined,
        userId: userId || undefined,
      });
      setName('');
      setPhone('');
      setFacility('');
      setUserId('');
      toast.success('Doctor added');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to add doctor');
    }
  };

  return (
    <RoleLayout
      title={role === 'receptionist' ? 'Doctor Directory' : 'Doctors'}
      subtitle={role === 'receptionist' ? 'Find and register doctors for referrals, reports, and patient routing' : 'Manage referring doctors used in orders and monthly referral reports'}
      role={role as any}
      userName={profile?.fullName}
    >
      <style>{`
        @media print {
          .doctor-directory-no-print { display: none !important; }
          .doctor-directory-print { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="doctor-directory-no-print xl:col-span-1 bg-card border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Doctor
          </h3>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Doctor full name" />
          </div>
          <div className="space-y-2">
            <Label>Phone (optional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Facility (optional)</Label>
            <Input value={facility} onChange={(e) => setFacility(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Linked login user (optional)</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor login account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (external/referral only)</SelectItem>
                {doctorUsers.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>{u.full_name}</span>
                      <span className="text-muted-foreground text-xs">({u.email})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Linking a user lets that doctor log in and see patients assigned to this doctor from triage.
            </p>
          </div>
          <Button className="w-full" onClick={onAddDoctor} disabled={createDoctor.isPending}>
            {createDoctor.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Doctor
          </Button>
        </div>

        <div className="doctor-directory-print xl:col-span-2 bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> Doctors List
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{doctorCount} doctors</Badge>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="doctor-directory-no-print gap-2">
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
          <div className="doctor-directory-no-print relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search doctor by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : doctorCount === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No doctors found.</div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Phone</th>
                    <th className="text-left px-3 py-2 font-medium">Facility</th>
                    <th className="text-left px-3 py-2 font-medium">Linked user</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor: any) => (
                    <tr key={doctor._id} className="border-t">
                      <td className="px-3 py-2 font-medium">{doctor.fullName}</td>
                      <td className="px-3 py-2">{doctor.phone || '—'}</td>
                      <td className="px-3 py-2">{doctor.facility || '—'}</td>
                      <td className="px-3 py-2">
                        {doctor.userId ? (
                          <Badge variant="outline" className="text-[10px]">
                            {users.find((u: any) => u.id === doctor.userId)?.full_name || doctor.userId}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RoleLayout>
  );
}

