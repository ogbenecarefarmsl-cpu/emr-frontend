import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useSearchPatients, useDepositWallet } from '@/hooks/usePatients';
import { usePaymentStats, useDailyIncome, useOutstandingBalances } from '@/hooks/useOrders';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PendingOrders } from '@/components/reception/PendingOrders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPatientFullName } from '@/utils/orderHelpers';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Wallet,
  TrendingDown,
  PiggyBank,
  Phone,
  Scissors,
  UserCog,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { prescriptionService } from '@/services/prescriptionService';
import { visitsAPI, ordersAPI } from '@/services/api';
import { useDoctorQueue, useVisitStats } from '@/hooks/useVisits';
import { useExpenditureSummary } from '@/hooks/useExpenditures';
import { cn } from '@/lib/utils';
import { Pill } from 'lucide-react';
import { toast } from 'sonner';

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ReceptionDashboard() {
  const { profile } = useAuth();
  
  useRealtimeOrders();
  useRealtimePatients();
  useRealtimeResults();
  
  const { data: patients = [], isLoading: patientsLoading } = useSearchPatients('');
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
  const todayStr = formatLocalDate(new Date());
  const { data: paymentStats } = usePaymentStats(todayStr, todayStr);
  const { data: visitStats } = useVisitStats(todayStr);
  const { data: doctorQueue = [], isLoading: queueLoading } = useDoctorQueue();
  const { data: dailyIncome = [] } = useDailyIncome(todayStr, todayStr);
  const { data: outstandingBalances = [] } = useOutstandingBalances();
  const { data: expenditureSummary } = useExpenditureSummary(todayStr, todayStr);
  const { data: patientOutstandingData } = useQuery({
    queryKey: ['patient-outstanding'],
    queryFn: () => ordersAPI.getPatientOutstanding(),
    staleTime: 30_000,
  });
  const { data: pendingPrescriptions = [] } = useQuery({
    queryKey: ['prescriptions', 'pending-payment'],
    queryFn: () => prescriptionService.findPendingPayment(),
    staleTime: 15 * 1000,
  });

  const { data: readyToDispense = [] } = useQuery({
    queryKey: ['prescriptions', 'dispensing-queue'],
    queryFn: () => prescriptionService.findAll(),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const dispensingQueue = useMemo(() => {
    return (Array.isArray(readyToDispense) ? readyToDispense : [])
      .filter((rx: any) => rx.isPaid && rx.status !== 'dispensed')
      .slice(0, 5);
  }, [readyToDispense]);

  const { data: allVisits = [] } = useQuery({
    queryKey: ['visits', 'reception-today'],
    queryFn: () => visitsAPI.getAll({}),
    staleTime: 15 * 1000,
  });

  const todayVisits = useMemo(() => {
    if (!Array.isArray(allVisits)) return [];
    return allVisits.filter((v: any) => {
      const created = v.createdAt || v.checkedInAt;
      return created && formatLocalDate(new Date(created)) === todayStr;
    });
  }, [allVisits, todayStr]);

  const serviceTypeCounts = useMemo(() => {
    const c: Record<string, number> = {
      normal_consultation: 0,
      specialist_consultation: 0,
      observation_4h: 0,
      procedure: 0,
      unspecified: 0,
    };
    for (const v of todayVisits) {
      const k = v.serviceType || 'unspecified';
      if (c[k] != null) c[k] += 1;
      else c.unspecified += 1;
    }
    return c;
  }, [todayVisits]);
  const todayRevenue = paymentStats?.paidRevenue ?? 0;
  const pendingLabPayments = paymentStats?.pendingOrders ?? 0;
  const pendingPrescriptionPayments = Array.isArray(pendingPrescriptions) ? pendingPrescriptions : [];
  const pendingPayments = pendingLabPayments + pendingPrescriptionPayments.length;
  const totalOutstanding = Array.isArray(outstandingBalances)
    ? outstandingBalances.reduce((sum: number, o: any) => sum + (o.balance || o.outstanding || 0), 0)
    : 0;
  const cashByMethod = useMemo(() => {
    const methods: Record<string, number> = { cash: 0, orange_money: 0, afrimoney: 0 };
    if (Array.isArray(dailyIncome)) {
      dailyIncome.forEach((entry: any) => {
        methods.cash += entry.cashPayments || 0;
        methods.orange_money += entry.orangeMoneyPayments || 0;
        methods.afrimoney += entry.afrimoneyPayments || 0;
      });
    }
    return methods;
  }, [dailyIncome]);
  const totalExpenditures = expenditureSummary?.totalExpenditures || 0;
  const netCashPosition = (paymentStats?.paidRevenue ?? 0) - totalExpenditures;

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

      {/* Daily Cash Summary */}
      <div className="mb-6 bg-card border rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Daily Cash Summary
          </h3>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/reception/reconciliation')}>
            Full Reconciliation <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-3.5 h-3.5 text-green-600" />
                <p className="text-xs font-medium text-green-700 dark:text-green-400">Cash</p>
              </div>
              <p className="text-lg font-bold text-green-800 dark:text-green-300">Le {cashByMethod.cash.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-3.5 h-3.5 text-orange-600" />
                <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Orange Money</p>
              </div>
              <p className="text-lg font-bold text-orange-800 dark:text-orange-300">Le {cashByMethod.orange_money.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-3.5 h-3.5 text-yellow-600" />
                <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Afrimoney</p>
              </div>
              <p className="text-lg font-bold text-yellow-800 dark:text-yellow-300">Le {cashByMethod.afrimoney.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Expenditures</p>
              </div>
              <p className="text-lg font-bold text-red-800 dark:text-red-300">Le {totalExpenditures.toLocaleString()}</p>
            </div>
            <div className={cn(
              'rounded-lg p-3 border',
              netCashPosition >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
            )}>
              <div className="flex items-center gap-2 mb-1">
                <PiggyBank className={cn('w-3.5 h-3.5', netCashPosition >= 0 ? 'text-emerald-600' : 'text-red-600')} />
                <p className={cn('text-xs font-medium', netCashPosition >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>Net Position</p>
              </div>
              <p className={cn('text-lg font-bold', netCashPosition >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300')}>
                Le {netCashPosition.toLocaleString()}
              </p>
            </div>
          </div>
          {totalOutstanding > 0 && (
            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Outstanding balances:</span>
              <span className="font-semibold text-amber-600">Le {totalOutstanding.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Patients Who Owe */}
      {patientOutstandingData?.patients?.length > 0 && (
        <OwingPatientsCard patients={patientOutstandingData.patients} />
      )}

      {/* Pending Clinical Orders (created by doctors, paid at reception) */}
      <div className="mb-6">
        <PendingOrders />
      </div>

      {/* Dispensing Queue - Ready to Dispense */}
      {dispensingQueue.length > 0 && (
        <div className="mb-6 bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Pill className="w-4 h-4 text-purple-500" />
              Ready to Dispense
              <Badge variant="secondary" className="ml-1 text-xs">{dispensingQueue.length}</Badge>
            </h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/reception/dispensing')}>
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="divide-y">
            {dispensingQueue.map((rx: any) => {
              const pName = rx.patientId?.firstName
                ? `${rx.patientId.firstName} ${rx.patientId.lastName || ''}`.trim()
                : 'Unknown';
              const itemCount = (rx.items || []).length;
              const total = rx.actualTotalAmount || rx.totalAmount || 0;
              return (
                <div key={rx._id} className="px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/reception/dispense/${rx._id}`)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 bg-purple-100 rounded-lg shrink-0">
                        <Pill className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{pName}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{rx.prescriptionNumber}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {itemCount} item{itemCount !== 1 ? 's' : ''} · Le {total.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="default" className="shrink-0 gap-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); navigate(`/reception/dispense/${rx._id}`); }}>
                      Dispense <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's visits by service type */}
      <div className="mb-6 bg-card border rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            Today's Visits by Service Type
          </h3>
          <span className="text-xs text-muted-foreground">{todayVisits.length} total</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <ServiceTypeTile icon={Stethoscope} label="Consultations" value={serviceTypeCounts.normal_consultation} color="blue" />
            <ServiceTypeTile icon={UserCog} label="Specialist" value={serviceTypeCounts.specialist_consultation} color="violet" />
            <ServiceTypeTile icon={Stethoscope} label="Observation" value={serviceTypeCounts.observation_4h} color="cyan" />
            <ServiceTypeTile icon={Scissors} label="Procedures" value={serviceTypeCounts.procedure} color="rose" />
          </div>
        </div>
      </div>


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

const SERVICE_TILE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/30',   text: 'text-blue-700 dark:text-blue-300',     border: 'border-blue-200' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200' },
  cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-950/30',   text: 'text-cyan-700 dark:text-cyan-300',     border: 'border-cyan-200' },
  rose:   { bg: 'bg-rose-50 dark:bg-rose-950/30',   text: 'text-rose-700 dark:text-rose-300',     border: 'border-rose-200' },
  amber:  { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-800 dark:text-amber-300',   border: 'border-amber-200' },
};

function ServiceTypeTile({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: keyof typeof SERVICE_TILE_COLORS }) {
  const c = SERVICE_TILE_COLORS[color];
  return (
    <div className={cn('rounded-lg border p-3', c.bg, c.border)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-3.5 h-3.5', c.text)} />
        <p className={cn('text-xs font-medium', c.text)}>{label}</p>
      </div>
      <p className={cn('text-lg font-bold', c.text)}>{value}</p>
    </div>
  );
}

function OwingPatientsCard({ patients }: { patients: any[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deposit = useDepositWallet();
  const [depositPatient, setDepositPatient] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('cash');
  const [depositNotes, setDepositNotes] = useState('');

  const handleDeposit = async () => {
    if (!depositPatient) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      const result = await deposit.mutateAsync({
        id: depositPatient.patientId,
        amount,
        notes: depositNotes || `Quick deposit from dashboard`,
        paymentMethod: depositMethod,
      });
      const applied = Number(result?.autoAppliedAmount || 0);
      toast.success(
        applied > 0
          ? `Le ${amount.toLocaleString()} deposited; Le ${applied.toLocaleString()} auto-applied to outstanding bills`
          : `Le ${amount.toLocaleString()} deposited for ${depositPatient.firstName} ${depositPatient.lastName}`,
      );
      setDepositPatient(null);
      setDepositAmount('');
      setDepositNotes('');
      setDepositMethod('cash');
      queryClient.invalidateQueries({ queryKey: ['patient-outstanding'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Deposit failed');
    }
  };

  return (
    <div className="mb-6 bg-card border rounded-xl shadow-sm border-red-200">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Patients Who Owe
          <Badge variant="secondary" className="ml-1 text-xs bg-red-100 text-red-700">{patients.length}</Badge>
        </h3>
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/reception/accounts-receivable')}>
          View All <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="divide-y">
        {patients.slice(0, 5).map((patient: any) => (
          <div key={patient.patientId} className="px-5 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{patient.firstName} {patient.lastName}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{patient.patientCode}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {patient.billCount || patient.orderCount} unpaid bill{(patient.billCount || patient.orderCount) !== 1 ? 's' : ''}
                  {patient.treatmentPlanCount > 0 ? ` (${patient.treatmentPlanCount} treatment plan${patient.treatmentPlanCount !== 1 ? 's' : ''})` : ''}
                  {' '}· Owes Le {patient.totalOwed.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setDepositPatient(patient)}
                >
                  <Wallet className="h-3.5 w-3.5" /> Top Up
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => navigate(`/reception/patients/${patient.patientId}`)}
                >
                  View
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Deposit Dialog */}
      {depositPatient && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Quick Deposit — {depositPatient.firstName} {depositPatient.lastName}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDepositPatient(null)}>
                <span className="sr-only">Close</span> ×
              </Button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <p className="text-red-700">Current amount owed: <strong>Le {depositPatient.totalOwed.toLocaleString()}</strong></p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Deposit Amount (Le)</Label>
              <Input
                id="deposit-amount"
                type="number"
                min="1"
                step="100"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter deposit amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={depositMethod} onValueChange={setDepositMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="orange_money">Orange Money</SelectItem>
                  <SelectItem value="afrimoney">Afrimoney</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-notes">Notes (optional)</Label>
              <Input
                id="deposit-notes"
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                placeholder="Payment notes..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={!depositAmount || deposit.isPending}
                onClick={handleDeposit}
              >
                {deposit.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4 mr-1" />
                )}
                Deposit Le {parseFloat(depositAmount || '0').toLocaleString()}
              </Button>
              <Button variant="outline" onClick={() => setDepositPatient(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

