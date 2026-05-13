import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useCreateDoctor, useDoctors } from '@/hooks/useDoctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

export default function DoctorsPage() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const role = pathname.startsWith('/reception') ? 'receptionist' : 'admin';

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [facility, setFacility] = useState('');

  const { data: doctors = [], isLoading } = useDoctors(search || undefined);
  const createDoctor = useCreateDoctor();

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
      });
      setName('');
      setPhone('');
      setFacility('');
      toast.success('Doctor added');
    } catch {
      toast.error('Failed to add doctor');
    }
  };

  return (
    <RoleLayout
      title="Doctors"
      subtitle="Manage referring doctors used in orders and monthly referral reports"
      role={role as any}
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 bg-card border rounded-lg p-4 space-y-3">
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
          <Button className="w-full" onClick={onAddDoctor} disabled={createDoctor.isPending}>
            {createDoctor.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Doctor
          </Button>
        </div>

        <div className="xl:col-span-2 bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> Doctors List
            </h3>
            <Badge variant="secondary">{doctorCount} doctors</Badge>
          </div>
          <div className="relative mb-4">
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
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor: any) => (
                    <tr key={doctor._id} className="border-t">
                      <td className="px-3 py-2 font-medium">{doctor.fullName}</td>
                      <td className="px-3 py-2">{doctor.phone || '—'}</td>
                      <td className="px-3 py-2">{doctor.facility || '—'}</td>
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
