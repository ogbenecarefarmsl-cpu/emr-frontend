import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useSearchPatients } from '@/hooks/usePatients';
import { useOrders, usePaymentStats } from '@/hooks/useOrders';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PendingOrders } from '@/components/reception/PendingOrders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getPatientFullName } from '@/utils/orderHelpers';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Loader2,
  Search,
  Stethoscope,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '@/services/patientService';
import { prescriptionService } from '@/services/prescriptionService';
import { useDoctorQueue, useVisitStats } from '@/hooks/useVisits';
import { toast } from 'sonner';

export default function ReceptionDashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  useRealtimeOrders();
  useRealtimePatients();
  useRealtimeResults();
  
  const { data: patients = [], isLoading: patientsLoading } = useSearchPatients('');
  const { data: orders = [] } = useOrders('all');
  const navigate = useNavigate();

  const recentRegistrations = useMemo(() => {
    if (!Array.isArray(patients)) return [];

    const getPatientTimestamp = (patient: any) => {
      const timestampValue = patient?.createdAt || patient?.registeredAt || patient?.updatedAt;
      if (!timestampValue) return 0;
      const parsed = new Date(timestampValue).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return [...patients]
      .sort((a: any, b: any) => getPatientTimestamp(b) - getPatientTimestamp(a))
      .slice(0, 5);
  }, [patients]);

  const formatRegistrationTimestamp = (patient: any) => {
    const timestampValue = patient?.createdAt || patient?.registeredAt || patient?.updatedAt;
    if (!timestampValue) return 'Time unavailable';

    const date = new Date(timestampValue);
    if (Number.isNaN(date.getTime())) return 'Time unavailable';

    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayPatients = Array.isArray(patients) ? patients.filter(p => new Date(p.createdAt) >= todayStart).length : 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: paymentStats } = usePaymentStats(todayStr, todayStr);
  const { data: visitStats } = useVisitStats(todayStr);
  const { data: doctorQueue = [], isLoading: queueLoading } = useDoctorQueue();
  const { data: prescriptions = [] } = useQuery({
    queryKey: ['prescriptions', 'reception-pending'],
    queryFn: () => prescriptionService.findAll(),
    staleTime: 15 * 1000,
  });
  const markPrescriptionPaid = useMutation({
    mutationFn: (id: string) => prescriptionService.markAsPaid(id),
    onSuccess: () => {
      toast.success('Pharmacy payment confirmed');
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to confirm payment');
    },
  });
  const todayRevenue = paymentStats?.paidRevenue ?? 0;
  const pendingLabPayments = Array.isArray(orders) ? orders.filter(o =>
    o.paymentStatus === 'pending' || o.payment_status === 'pending'
  ).length : 0;
  const pendingPrescriptionPayments = Array.isArray(prescriptions)
    ? prescriptions.filter((rx: any) => rx.status === 'pending' && !rx.isPaid)
    : [];
  const pendingPayments = pendingLabPayments + pendingPrescriptionPayments.length;

  const [searchTerm, setSearchTerm] = useState('');
  const { data: searchResults = [] } = useSearchPatients(searchTerm);

  return (
    <RoleLayout
      title="Reception Dashboard"
      subtitle="Patient registration and EMR management"
      role="receptionist"
      userName={profile?.fullName}
    >
      {/* Patient Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients by name, ID, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        {searchTerm.length > 0 && searchResults.length > 0 && (
          <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
            {searchResults.slice(0, 5).map((p: any) => (
              <div
                key={p._id}
                className="p-3 hover:bg-gray-100 cursor-pointer border-b flex justify-between items-center"
                onClick={() => {
                  navigate(`/patient/${p._id}`);
                  setSearchTerm('');
                }}
              >
                <div>
                  <p className="font-semibold">{p.firstName} {p.lastName}</p>
                  <p className="text-sm text-gray-500">{p.patientId}</p>
                </div>
                <Badge variant="outline">View</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => navigate('/reception/register')}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary hover:border-primary transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <UserPlus className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
          </div>
          <span className="text-sm font-semibold text-primary group-hover:text-white transition-colors">Register Patient</span>
        </button>
        <button
          onClick={() => navigate('/reception/visit-registration')}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 hover:bg-blue-500 hover:border-blue-500 transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <Stethoscope className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors" />
          </div>
          <span className="text-sm font-semibold text-blue-500 group-hover:text-white transition-colors">New Visit</span>
        </button>
        <button
          onClick={() => navigate('/reception/payments')}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border bg-card hover:bg-secondary hover:shadow-md transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <CreditCard className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold text-foreground">Billing & Payments</span>
        </button>
        <button 
          onClick={() => navigate('/reception/patients')}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border bg-card hover:bg-secondary hover:shadow-md transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <Users className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold text-foreground">Search Patients</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Patients Today"
          value={visitStats?.totalVisits || todayPatients}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <MetricCard
          title="Awaiting Vitals"
          value={visitStats?.awaitingTriage || 0}
          icon={Stethoscope}
          variant={(visitStats?.awaitingTriage || 0) > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Revenue Today"
          value={`Le ${todayRevenue.toLocaleString()}`}
          icon={TrendingUp}
          trend={{ value: 8, isPositive: true }}
        />
        <MetricCard
          title="Pending Payments"
          value={pendingPayments}
          icon={DollarSign}
          variant={pendingPayments > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Pending Clinical Orders (created by doctors, paid at reception) */}
      <div className="mb-6">
        <PendingOrders />
      </div>

      {pendingPrescriptionPayments.length > 0 && (
        <div className="mb-6 bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Pending Pharmacy Payments</h3>
            <span className="text-xs text-muted-foreground">{pendingPrescriptionPayments.length} prescription(s)</span>
          </div>
          <div className="divide-y">
            {pendingPrescriptionPayments.slice(0, 6).map((rx: any) => (
              <div key={rx._id || rx.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {rx.patientId?.firstName} {rx.patientId?.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{rx.prescriptionNumber} • {rx.items?.length || 0} drug(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold">Le {Number(rx.totalAmount || 0).toLocaleString()}</p>
                  <Button size="sm" onClick={() => markPrescriptionPaid.mutate(rx._id || rx.id)} disabled={markPrescriptionPaid.isPending}>
                    <CreditCard className="w-3.5 h-3.5 mr-1" />
                    Mark Paid
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Recent Registrations</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/reception/patients')}>
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="divide-y">
            {patientsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
            <>
            {recentRegistrations.map((patient: any) => {
              const patientId = patient._id || patient.id;
              return (
              <div key={patient.id || patient._id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{getPatientFullName(patient)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{patient.patientId || patient.patient_id || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{formatRegistrationTimestamp(patient)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs flex-shrink-0" onClick={() => navigate(`/reception/visit-registration?patient=${patientId}`)}>
                    New Visit
                  </Button>
                </div>
              </div>
              );
            })}
            {(!Array.isArray(patients) || patients.length === 0) && (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No patients registered yet
              </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* Doctor Queue Monitor */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Doctor Queue Monitor</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/reception')}>
              View Queue <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="divide-y">
            {queueLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
            <>
            {Array.isArray(doctorQueue) && doctorQueue.slice(0, 5).map((visit: any) => (
              <div key={visit.id || visit._id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {visit.patientId?.firstName || visit.patient?.firstName}{' '}
                      {visit.patientId?.lastName || visit.patient?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {visit.visitNumber || visit.visit_number || 'Visit'} - paid, waiting for doctor
                    </p>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0">Doctor Queue</Badge>
                </div>
              </div>
            ))}
            {(!Array.isArray(doctorQueue) || doctorQueue.length === 0) && (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No patients waiting for doctor after vitals
              </div>
            )}
            </>
            )}
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}

