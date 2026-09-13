import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useRecentPatients, useSearchPatients } from '@/hooks/usePatients';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useReceptionDashboard, useMarkConsultationPaid } from '@/hooks/useVisits';
import { useDailyIncome } from '@/hooks/useOrders';
import { useDoctors } from '@/hooks/useDoctors';
import { PendingOrders } from '@/components/reception/PendingOrders';
import api, { ordersAPI } from '@/services/api';
import { getPatientFullName } from '@/utils/orderHelpers';
import { cn } from '@/lib/utils';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

// Icons
import {
  Users,
  CreditCard,
  ArrowRight,
  UserPlus,
  Loader2,
  FlaskConical,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  Phone,
  Search,
  Banknote,
  Smartphone,
  Wallet,
  Calendar,
  Clock,
  Stethoscope,
  ShoppingBag,
  Receipt,
  Printer,
  RefreshCw,
  Check,
  Building2,
  ChevronRight,
  Activity,
} from 'lucide-react';

export default function ReceptionDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtimePatients();

  // State
  const [activeTab, setActiveTab] = useState('care_flow');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [collectVisit, setCollectVisit] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Queries
  const { data: patients = [], isLoading: patientsLoading, refetch: refetchPatients } = useRecentPatients(8);
  const { data: searchResults = [], isLoading: searchLoading } = useSearchPatients(patientSearchTerm);
  const { data: receptionSnapshot, refetch: refetchReception } = useReceptionDashboard();
  const { data: dailyIncomeData = [], refetch: refetchIncome } = useDailyIncome();
  const { data: doctors = [] } = useDoctors();

  const { data: patientOutstandingData, refetch: refetchOutstanding } = useQuery({
    queryKey: ['patient-outstanding'],
    queryFn: () => ordersAPI.getPatientOutstanding(),
    staleTime: 30_000,
  });

  const { data: appointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: async () => {
      const res = await api.get('/appointments');
      return res.data || [];
    },
    refetchInterval: 30 * 1000,
  });

  const markConsultationPaid = useMarkConsultationPaid();

  // Snapshot extractions
  const doctorQueue = receptionSnapshot?.doctorQueue ?? [];
  const visitStats = receptionSnapshot?.todayStats;
  const pendingConsultationVisits = Array.isArray(receptionSnapshot?.pendingConsultationPayments)
    ? receptionSnapshot.pendingConsultationPayments
    : [];
  const awaitingTriageVisits = Array.isArray(receptionSnapshot?.awaitingTriage)
    ? receptionSnapshot.awaitingTriage
    : [];
  const pendingLabVisits = Array.isArray(receptionSnapshot?.pendingLabPayments)
    ? receptionSnapshot.pendingLabPayments
    : [];
  const pendingPharmacyVisits = Array.isArray(receptionSnapshot?.pendingPharmacyPayments)
    ? receptionSnapshot.pendingPharmacyPayments
    : [];

  const awaitingTriageCount = visitStats?.awaitingTriage ?? awaitingTriageVisits.length;
  const pendingClinicalPayments = pendingLabVisits.length + pendingPharmacyVisits.length;

  // Today's Cash Drawer Balance
  const todayIncome = useMemo(() => {
    if (!Array.isArray(dailyIncomeData) || dailyIncomeData.length === 0) {
      return { totalIncome: 0, cashPayments: 0, orangeMoneyPayments: 0, afrimoneyPayments: 0 };
    }
    // First entry is today's aggregated income
    const today = dailyIncomeData[0];
    return {
      totalIncome: Number(today.totalIncome || 0),
      cashPayments: Number(today.cashPayments || 0),
      orangeMoneyPayments: Number(today.orangeMoneyPayments || 0),
      afrimoneyPayments: Number(today.afrimoneyPayments || 0),
    };
  }, [dailyIncomeData]);

  // Doctor load map
  const doctorLoad = useMemo(() => {
    const map: Record<string, { doctor: any; waiting: number }> = {};
    for (const d of doctors) {
      const docId = d._id || d.id;
      map[docId] = { doctor: d, waiting: 0 };
    }
    for (const v of doctorQueue) {
      const docId = v.doctorId?._id || v.doctorId?.id || v.doctorId;
      if (docId && map[docId]) {
        map[docId].waiting += 1;
      }
    }
    return Object.values(map);
  }, [doctors, doctorQueue]);

  // Handle consultation fee collection
  const handleConfirmConsultationPayment = async () => {
    if (!collectVisit) return;
    const visitId = collectVisit._id || collectVisit.id;

    try {
      await markConsultationPaid.mutateAsync({
        visitId,
        paymentMethod,
      });
      toast.success(`Consultation fee collected via ${paymentMethod.replace('_', ' ').toUpperCase()}. Patient queued for nurse vitals.`);
      setCollectVisit(null);
      setPaymentMethod('cash');
      refetchReception();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record consultation payment');
    }
  };

  const scrollToClinicalPayments = () => {
    setActiveTab('billing');
    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.getElementById('pending-clinical-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleRefreshAll = () => {
    refetchPatients();
    refetchReception();
    refetchIncome();
    refetchOutstanding();
    refetchAppointments();
    toast.success('Front-desk queues refreshed');
  };

  return (
    <RoleLayout
      title="Receptionist Station"
      subtitle="Patient check-in, triage queue management, cashier collections, and billing clearance"
      role="receptionist"
      userName={profile?.fullName}
    >
      {/* ───────── TOP HIGH-DENSITY RECEPTION PULSE RIBBON ───────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mb-5">
        {/* Total Check-ins */}
        <div
          onClick={() => navigate('/reception/patients')}
          className="cursor-pointer rounded-xl border bg-card p-3 flex flex-col justify-between hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Visits</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{visitStats?.totalVisits ?? 0}</span>
            <span className="text-[10px] text-muted-foreground">checked in</span>
          </div>
        </div>

        {/* Entrance Queue (Awaiting Consultation Fee) */}
        <div
          onClick={() => setActiveTab('care_flow')}
          className={cn(
            'cursor-pointer rounded-xl border p-3 flex flex-col justify-between hover:shadow-xs transition-all',
            pendingConsultationVisits.length > 0
              ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
              : 'border bg-card text-foreground',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entrance Pay</span>
            <CreditCard className={cn('w-4 h-4', pendingConsultationVisits.length > 0 ? 'text-amber-600' : 'text-muted-foreground')} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={cn('text-2xl font-bold', pendingConsultationVisits.length > 0 ? 'text-amber-600' : '')}>
              {pendingConsultationVisits.length}
            </span>
            <span className="text-[10px] text-muted-foreground">consult fee</span>
          </div>
        </div>

        {/* Ready for Nurse Vitals */}
        <div
          onClick={() => setActiveTab('care_flow')}
          className={cn(
            'cursor-pointer rounded-xl border p-3 flex flex-col justify-between hover:shadow-xs transition-all',
            awaitingTriageCount > 0 ? 'border-blue-300 bg-blue-50/70 dark:bg-blue-950/20' : 'border bg-card',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">For Vitals</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={cn('text-2xl font-bold', awaitingTriageCount > 0 ? 'text-blue-600' : '')}>
              {awaitingTriageCount}
            </span>
            <span className="text-[10px] text-muted-foreground">with nurses</span>
          </div>
        </div>

        {/* Doctor Consultation Queue */}
        <div
          onClick={() => setActiveTab('care_flow')}
          className="cursor-pointer rounded-xl border bg-card p-3 flex flex-col justify-between hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">With Doctor</span>
            <Stethoscope className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{doctorQueue.length}</span>
            <span className="text-[10px] text-muted-foreground">in consult/wait</span>
          </div>
        </div>

        {/* Clinical Bills Due (Labs & Pharmacy) */}
        <div
          onClick={() => setActiveTab('billing')}
          className={cn(
            'cursor-pointer rounded-xl border p-3 flex flex-col justify-between hover:shadow-xs transition-all',
            pendingClinicalPayments > 0 ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20' : 'border bg-card',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Clinical Bills</span>
            <FlaskConical className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={cn('text-2xl font-bold', pendingClinicalPayments > 0 ? 'text-emerald-600' : '')}>
              {pendingClinicalPayments}
            </span>
            <span className="text-[10px] text-muted-foreground">lab / rx due</span>
          </div>
        </div>

        {/* Live Cash Till Drawer Position */}
        <div
          onClick={() => navigate('/reception/reconciliation')}
          className="cursor-pointer rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col justify-between hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Today's Till</span>
            <Banknote className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-1">
            <p className="text-lg font-extrabold text-foreground truncate">
              Le {todayIncome.totalIncome.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground">
              <span>Cash: Le {todayIncome.cashPayments.toLocaleString()}</span>
              <span>• MoMo: Le {(todayIncome.orangeMoneyPayments + todayIncome.afrimoneyPayments).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── UNIVERSAL PATIENT SEARCH & FAST ACTION COMMAND BAR ───────── */}
      <div className="mb-5 bg-card border rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Live Patient Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Instant patient lookup by name, phone number, or patient code..."
              value={patientSearchTerm}
              onChange={(e) => setPatientSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {patientSearchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 px-2 text-xs"
                onClick={() => setPatientSearchTerm('')}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Quick Jump Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="h-9 text-xs gap-1.5 font-semibold"
              onClick={() => navigate('/reception/register')}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Register Patient
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={() => navigate('/reception/visit-registration')}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
              Start Visit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={() => navigate('/reception/payments')}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              Cash Desk
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={() => navigate('/reception/orders')}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
              Walk-in Sale
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs gap-1 text-muted-foreground"
              onClick={handleRefreshAll}
              title="Refresh all front-desk queues"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Live Search Results Dropdown */}
        {patientSearchTerm.trim().length >= 2 && (
          <div className="border rounded-xl bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Search Results ({searchResults.length})
            </p>
            {searchLoading ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Searching patient registry...
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No patient matching "{patientSearchTerm}". You can click "Register Patient" above to enroll them.
              </p>
            ) : (
              <div className="divide-y max-h-56 overflow-y-auto">
                {searchResults.slice(0, 5).map((p: any) => {
                  const pid = p._id || p.id;
                  const code = p.patientId || p.patient_id || 'N/A';
                  return (
                    <div key={pid} className="py-2.5 flex items-center justify-between text-xs hover:bg-muted/40 px-2 rounded-lg transition-colors">
                      <div>
                        <span className="font-bold text-sm text-foreground">{getPatientFullName(p)}</span>
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {code}
                        </span>
                        <div className="mt-0.5 text-muted-foreground flex items-center gap-2">
                          {p.gender && <span>{p.gender}</span>}
                          {p.age && <span>• {p.age} yrs</span>}
                          {p.phone && <span>• {p.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => navigate(`/reception/patients/${pid}`)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 font-semibold"
                          onClick={() => navigate(`/reception/visit-registration?patient=${pid}`)}
                        >
                          <ClipboardCheck className="w-3 h-3" />
                          Start Visit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ───────── MAIN RECEPTION OPERATIONAL TABS ───────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="border-b bg-card rounded-t-xl px-4 pt-2 shadow-xs">
          <TabsList className="bg-transparent h-auto p-0 gap-2">
            <TabsTrigger
              value="care_flow"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-3 text-xs gap-1.5 font-medium"
            >
              <Users className="w-3.5 h-3.5" />
              Entrance & Clinic Care Flow
              {pendingConsultationVisits.length > 0 && (
                <Badge className="ml-1 text-[10px] h-4.5 bg-amber-600">
                  {pendingConsultationVisits.length} Unpaid
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-3 text-xs gap-1.5 font-medium"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Clinical Orders Cashier
              {pendingClinicalPayments > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4.5">
                  {pendingClinicalPayments} Due
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="debtors_appointments"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-3 text-xs gap-1.5 font-medium"
            >
              <Calendar className="w-3.5 h-3.5" />
              Debtors & Appointments
              {(patientOutstandingData?.patients?.length || 0) > 0 && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  ({patientOutstandingData?.patients?.length})
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ───────── TAB 1: ENTRANCE & CLINIC CARE FLOW ───────── */}
        <TabsContent value="care_flow" className="space-y-5 mt-0">
          {/* Urgent Entrance Action List: Consultation Payment Collection */}
          {pendingConsultationVisits.length > 0 && (
            <div className="rounded-xl border-2 border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-sm text-amber-950 dark:text-amber-200">
                    Awaiting Consultation Fee at Entrance ({pendingConsultationVisits.length})
                  </h3>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Collect fee to clear patient into nurse triage
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingConsultationVisits.map((v: any) => {
                  const p = v.patientId;
                  const visitId = v._id || v.id;
                  const fee = v.consultationFee || 150;

                  return (
                    <div
                      key={visitId}
                      className="bg-card border rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm text-foreground">{getPatientFullName(p)}</p>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            #{v.visitNumber}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p?.gender} • {p?.age} yrs • {p?.phone || 'No phone'}
                        </p>
                        {v.chiefComplaint && (
                          <p className="text-xs text-foreground mt-1 truncate italic">
                            "{v.chiefComplaint}"
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t">
                          <span className="text-muted-foreground">Fee Due:</span>
                          <span className="font-bold text-sm text-amber-700">Le {fee.toLocaleString()}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="w-full h-8 text-xs font-semibold gap-1 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                        onClick={() => setCollectVisit(v)}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        Collect Fee (Le {fee})
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Doctor Queue Load Board */}
          <div className="bg-card border rounded-xl shadow-xs p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  Consultation Rooms & On-Duty Doctors
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time patient wait queues per consultation room to help route arriving patients evenly
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {doctorQueue.length} Active in Queue
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {doctorLoad.map(({ doctor, waiting }) => (
                <div
                  key={doctor._id || doctor.id}
                  className={cn(
                    'rounded-xl border p-3 flex flex-col justify-between transition-all',
                    waiting > 3
                      ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border bg-muted/20',
                  )}
                >
                  <div>
                    <p className="font-bold text-xs text-foreground truncate">{doctor.fullName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{doctor.specialty || doctor.department || 'General Practice'}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between pt-1 border-t">
                    <span className="text-[10px] text-muted-foreground">Waiting:</span>
                    <Badge
                      variant={waiting === 0 ? 'secondary' : waiting > 3 ? 'destructive' : 'default'}
                      className="text-[10px] h-4.5 px-1.5"
                    >
                      {waiting === 0 ? 'Available' : `${waiting} waiting`}
                    </Badge>
                  </div>
                </div>
              ))}
              {doctorLoad.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-full py-4 text-center">
                  No doctor consultation rooms registered
                </p>
              )}
            </div>
          </div>

          {/* Dual Column: Patients Ready for Triage + Recent Registrations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Ready for Nurse Triage */}
            <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Ready for Nurse Triage (Vitals)
                </h3>
                <Badge variant="secondary" className="text-xs font-mono">
                  {awaitingTriageVisits.length}
                </Badge>
              </div>

              <div className="divide-y max-h-72 overflow-y-auto">
                {awaitingTriageVisits.map((v: any) => {
                  const p = v.patientId;
                  const visitId = v._id || v.id;
                  return (
                    <div key={visitId} className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors text-xs">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{getPatientFullName(p)}</p>
                        <p className="text-muted-foreground mt-0.5">
                          #{v.visitNumber} • {p?.phone || 'No phone'} • Checked in {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                        Waiting for Vitals
                      </Badge>
                    </div>
                  );
                })}
                {awaitingTriageVisits.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-1" />
                    All checked-in patients have completed triage vitals
                  </div>
                )}
              </div>
            </div>

            {/* Recent Registrations */}
            <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Recent Patient Registrations
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={() => navigate('/reception/patients')}
                >
                  All Patients <ArrowRight className="w-3 h-3" />
                </Button>
              </div>

              <div className="divide-y max-h-72 overflow-y-auto">
                {patientsLoading ? (
                  <div className="py-12 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  patients.slice(0, 5).map((patient: any) => {
                    const patientId = patient._id || patient.id;
                    const patientCode = patient.patientId || patient.patient_id || 'N/A';
                    const phone = patient.phone || patient.phoneNumber;
                    return (
                      <div key={patientId} className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{getPatientFullName(patient)}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">{patientCode}</Badge>
                          </div>
                          <p className="text-muted-foreground mt-0.5">
                            {phone && <span>{phone} • </span>}
                            <span>Registered {new Date(patient.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0 gap-1"
                          onClick={() => navigate(`/reception/visit-registration?patient=${patientId}`)}
                        >
                          <ClipboardCheck className="w-3 h-3" />
                          Start Visit
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ───────── TAB 2: CLINICAL ORDERS CASHIER ───────── */}
        <TabsContent value="billing" className="space-y-4 mt-0">
          <div id="pending-clinical-payments">
            <PendingOrders />
          </div>
        </TabsContent>

        {/* ───────── TAB 3: DEBTORS & APPOINTMENTS ───────── */}
        <TabsContent value="debtors_appointments" className="space-y-5 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Outstanding Patient Balances */}
            <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Outstanding Patient Balances
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Patients with unsettled credit bills or partial payments
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => navigate('/reception/accounts-receivable')}
                >
                  Full AR Ledger <ArrowRight className="w-3 h-3" />
                </Button>
              </div>

              <div className="divide-y max-h-80 overflow-y-auto">
                {patientOutstandingData?.patients && patientOutstandingData.patients.length > 0 ? (
                  patientOutstandingData.patients.map((item: any) => (
                    <div key={item.patientId} className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors text-xs">
                      <div>
                        <p className="font-semibold text-sm text-foreground">
                          {item.firstName} {item.lastName}
                        </p>
                        <p className="text-muted-foreground mt-0.5 font-mono">
                          {item.patientCode} • {item.billCount} bill(s) pending
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-extrabold text-sm text-red-600">Le {item.totalOwed.toLocaleString()}</p>
                          <span className="text-[10px] text-muted-foreground">Balance Due</span>
                        </div>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => navigate(`/reception/payments?search=${item.patientCode}`)}
                        >
                          Collect
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-1" />
                    No outstanding debtor balances recorded
                  </div>
                )}
              </div>
            </div>

            {/* Scheduled Appointments Today */}
            <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Appointments & Scheduled Follow-ups
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pre-booked consultations for today
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => navigate('/reception/appointments')}
                >
                  Appointments Hub <ArrowRight className="w-3 h-3" />
                </Button>
              </div>

              <div className="divide-y max-h-80 overflow-y-auto">
                {Array.isArray(appointments) && appointments.length > 0 ? (
                  appointments.map((apt: any) => (
                    <div key={apt._id || apt.id} className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors text-xs">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{apt.patientName || apt.patient?.fullName || 'Patient'}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {apt.doctorName || apt.doctor?.fullName ? `Dr. ${apt.doctorName || apt.doctor?.fullName}` : 'Any Doctor'} • {apt.time || 'Scheduled'}
                        </p>
                        {apt.reason && <p className="italic text-muted-foreground/80 mt-0.5">"{apt.reason}"</p>}
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 font-semibold"
                        onClick={() => navigate(`/reception/visit-registration?patient=${apt.patientId || apt.patient?._id}`)}
                      >
                        <Check className="w-3 h-3" />
                        Check-In
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-1" />
                    No pre-booked appointments scheduled for today
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ───────── INLINE 1-CLICK CONSULTATION FEE PAYMENT MODAL ───────── */}
      <Dialog open={!!collectVisit} onOpenChange={(open) => { if (!open) setCollectVisit(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Collect Consultation Fee
            </DialogTitle>
            <DialogDescription>
              Record patient consultation payment to immediately clear them for nursing triage.
            </DialogDescription>
          </DialogHeader>

          {collectVisit && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-bold text-sm text-foreground">{getPatientFullName(collectVisit.patientId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visit #:</span>
                  <span className="font-mono text-foreground">#{collectVisit.visitNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service:</span>
                  <span className="text-foreground capitalize">{collectVisit.serviceType?.replace('_', ' ') || 'Normal Consultation'}</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-baseline">
                  <span className="font-semibold text-muted-foreground">Amount Due:</span>
                  <span className="font-extrabold text-lg text-primary">
                    Le {Number(collectVisit.consultationFee || 150).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1.5">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 Cash Payment (Till Drawer)</SelectItem>
                    <SelectItem value="orange_money">🍊 Orange Money</SelectItem>
                    <SelectItem value="afrimoney">🔴 Afrimoney</SelectItem>
                    <SelectItem value="wallet">👛 Patient E-Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCollectVisit(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5 font-bold"
              disabled={markConsultationPaid.isPending}
              onClick={handleConfirmConsultationPayment}
            >
              {markConsultationPaid.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Confirm & Send to Nurse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}