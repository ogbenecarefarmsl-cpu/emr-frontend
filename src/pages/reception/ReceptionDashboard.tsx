import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useRecentPatients, useDepositWallet } from '@/hooks/usePatients';
import { usePaymentStats, useDailyIncome, useOutstandingBalances } from '@/hooks/useOrders';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
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
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  ArrowRight,
  UserPlus,
  Loader2,
  Stethoscope,
  Wallet,
  TrendingDown,
  PiggyBank,
  Phone,
  AlertTriangle,
  Shield,
  ShieldOff,
  ClipboardCheck,
  FlaskConical,
  CheckCircle2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { prescriptionService } from '@/services/prescriptionService';
import { ordersAPI } from '@/services/api';
import { useReceptionDashboard } from '@/hooks/useVisits';
import { useExpenditureSummary } from '@/hooks/useExpenditures';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ReceptionDashboard() {
  const { profile } = useAuth();
  
  useRealtimePatients();

  const { data: patients = [], isLoading: patientsLoading } = useRecentPatients(5);
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

  const todayStr = formatLocalDate(new Date());
  const { data: paymentStats } = usePaymentStats(todayStr, todayStr);
  const { data: receptionSnapshot, isLoading: snapshotLoading } = useReceptionDashboard();
  const doctorQueue = receptionSnapshot?.doctorQueue ?? [];
  const visitStats = receptionSnapshot?.todayStats;
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
  const todayRevenue = paymentStats?.paidRevenue ?? 0;
  const pendingClinicalOrderCount = paymentStats?.pendingOrders ?? 0;
  const pendingPrescriptionPayments = Array.isArray(pendingPrescriptions) ? pendingPrescriptions : [];
  const pendingClinicalPayments = Math.max(
    pendingClinicalOrderCount + pendingPrescriptionPayments.length,
    pendingLabVisits.length + pendingPharmacyVisits.length + pendingPrescriptionPayments.length,
  );
  const pendingPayments = pendingConsultationVisits.length + pendingClinicalPayments;
  const totalOutstanding = Number(
    outstandingBalances?.summary?.totalOutstanding
      ?? (Array.isArray(outstandingBalances)
        ? outstandingBalances.reduce((sum: number, o: any) => sum + (o.balance || o.outstanding || 0), 0)
        : 0),
  );
  const cashByMethod = useMemo(() => {
    const methods: Record<string, number> = {
      cash: 0,
      orange_money: 0,
      afrimoney: 0,
      wallet_deposits: paymentStats?.walletDeposits || 0,
      treatment_plans: paymentStats?.treatmentPlanCollected || 0,
    };
    if (Array.isArray(dailyIncome)) {
      dailyIncome.forEach((entry: any) => {
        methods.cash += entry.cashPayments || 0;
        methods.orange_money += entry.orangeMoneyPayments || 0;
        methods.afrimoney += entry.afrimoneyPayments || 0;
        if (!paymentStats?.walletDeposits) methods.wallet_deposits += entry.walletDeposits || 0;
        if (!paymentStats?.treatmentPlanCollected) methods.treatment_plans += entry.treatmentPlanPayments || 0;
      });
    }
    return methods;
  }, [dailyIncome, paymentStats?.treatmentPlanCollected, paymentStats?.walletDeposits]);
  const totalExpenditures = expenditureSummary?.totalExpenditures || 0;
  const netCashPosition = (paymentStats?.paidRevenue ?? 0) - totalExpenditures;
  const scrollToClinicalPayments = () => {
    if (typeof document === 'undefined') return;
    document.getElementById('pending-clinical-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <RoleLayout
      title="Reception Dashboard"
      subtitle="Register patients, start visits, collect payments, and guide patients"
      role="receptionist"
      userName={profile?.fullName}
    >
      {/* Start Here */}
      <div className="mb-6 rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Reception workbench</h2>
            <p className="text-sm text-muted-foreground">Start a patient, collect what is due, and see where everyone is right now.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/admin/insurance')}>
              <Shield className="h-4 w-4" />
              Insurance programs
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/reception/insurance-blocks')}>
              <ShieldOff className="h-4 w-4" />
              Blocked insurance
            </Button>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <ReceptionActionCard
            icon={UserPlus}
            title="Register a new patient"
            description="Create the patient record first."
            actionLabel="Register"
            tone="primary"
            onClick={() => navigate('/reception/register')}
          />
          <ReceptionActionCard
            icon={ClipboardCheck}
            title="Start or renew a visit"
            description="Choose doctor, coverage, and visit type."
            actionLabel="Start visit"
            tone="blue"
            onClick={() => navigate('/reception/visit-registration')}
          />
          <ReceptionActionCard
            icon={CreditCard}
            title="Take a payment"
            description="Consultation, labs, drugs, plans, or balances."
            actionLabel="Open billing"
            tone="green"
            onClick={() => navigate('/reception/payments')}
          />
          <ReceptionActionCard
            icon={Users}
            title="Find a patient"
            description="Search history, receipts, reports, and visits."
            actionLabel="Search"
            tone="slate"
            onClick={() => navigate('/reception/patients')}
          />
        </div>
      </div>

      {/* Patient Flow */}
      <div className="mb-6 rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Today&apos;s patient flow</h2>
            <p className="text-sm text-muted-foreground">Plain-language queues so Reception can quickly guide each patient to the next desk.</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate('/reception/visit-registration')}>
            Start visit <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <PatientFlowStep
            icon={CreditCard}
            label="Needs consultation payment"
            count={pendingConsultationVisits.length}
            helper="Collect or confirm coverage before vitals."
            action="Open billing"
            onClick={() => navigate('/reception/payments')}
            tone={pendingConsultationVisits.length > 0 ? 'amber' : 'muted'}
          />
          <PatientFlowStep
            icon={Stethoscope}
            label="Ready for nurse vitals"
            count={awaitingTriageCount}
            helper="Paid or covered visits waiting for triage."
            action="View visits"
            onClick={() => navigate('/reception')}
            tone={awaitingTriageCount > 0 ? 'blue' : 'muted'}
          />
          <PatientFlowStep
            icon={Users}
            label="Waiting for doctor"
            count={doctorQueue.length}
            helper="Vitals done, doctor should call next."
            action="View queue"
            onClick={() => navigate('/reception')}
            tone={doctorQueue.length > 0 ? 'primary' : 'muted'}
          />
          <PatientFlowStep
            icon={FlaskConical}
            label="Lab or pharmacy payment"
            count={pendingClinicalPayments}
            helper="Orders, prescriptions, and uncovered balances."
            action="Review now"
            onClick={scrollToClinicalPayments}
            tone={pendingClinicalPayments > 0 ? 'green' : 'muted'}
          />
        </div>
        <div className="grid gap-3 border-t p-4 lg:grid-cols-3">
          <MiniVisitList
            title="Collect before vitals"
            emptyText="No consultation payments waiting"
            visits={pendingConsultationVisits}
            actionLabel="Open billing"
            onAction={() => navigate('/reception/payments')}
            loading={snapshotLoading}
          />
          <MiniVisitList
            title="Send to nurse"
            emptyText="No patients waiting for vitals"
            visits={awaitingTriageVisits}
            actionLabel="Start visit"
            onAction={() => navigate('/reception/visit-registration')}
            loading={snapshotLoading}
          />
          <MiniVisitList
            title="Waiting for doctor"
            emptyText="No one is waiting for a doctor"
            visits={doctorQueue}
            actionLabel="View queue"
            onAction={() => navigate('/reception')}
            loading={snapshotLoading}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Patients Today"
          value={visitStats?.totalVisits ?? 0}
          icon={Users}
        />
        <MetricCard
          title="Awaiting Vitals"
          value={awaitingTriageCount}
          icon={Stethoscope}
          variant={awaitingTriageCount > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Revenue Today"
          value={`Le ${todayRevenue.toLocaleString()}`}
          icon={TrendingUp}
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
            <div className="bg-sky-50 dark:bg-sky-950/30 rounded-lg p-3 border border-sky-200 dark:border-sky-800">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-3.5 h-3.5 text-sky-600" />
                <p className="text-xs font-medium text-sky-700 dark:text-sky-400">Wallet Deposits</p>
              </div>
              <p className="text-lg font-bold text-sky-800 dark:text-sky-300">Le {cashByMethod.wallet_deposits.toLocaleString()}</p>
            </div>
            <div className="bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 border border-violet-200 dark:border-violet-800">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-3.5 h-3.5 text-violet-600" />
                <p className="text-xs font-medium text-violet-700 dark:text-violet-400">Treatment Plans</p>
              </div>
              <p className="text-lg font-bold text-violet-800 dark:text-violet-300">Le {cashByMethod.treatment_plans.toLocaleString()}</p>
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

      {/* Order and medicine payments */}
      <div id="pending-clinical-payments" className="mb-6 scroll-mt-20">
        <PendingOrders />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6">
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
      </div>
    </RoleLayout>
  );
}

type ReceptionTone = 'primary' | 'blue' | 'green' | 'amber' | 'slate' | 'muted';

const toneStyles: Record<ReceptionTone, { card: string; icon: string; count: string }> = {
  primary: {
    card: 'border-primary/25 bg-primary/5 hover:border-primary/45',
    icon: 'bg-primary/10 text-primary',
    count: 'text-primary',
  },
  blue: {
    card: 'border-blue-200 bg-blue-50/70 hover:border-blue-300 dark:border-blue-900 dark:bg-blue-950/20',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    count: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    card: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/20',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    count: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/80 hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/20',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    count: 'text-amber-700 dark:text-amber-300',
  },
  slate: {
    card: 'border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/20',
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
    count: 'text-slate-700 dark:text-slate-300',
  },
  muted: {
    card: 'border-border bg-muted/20 hover:bg-muted/30',
    icon: 'bg-muted text-muted-foreground',
    count: 'text-muted-foreground',
  },
};

function ReceptionActionCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  tone: ReceptionTone;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[132px] flex-col items-start justify-between rounded-lg border p-4 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        styles.card,
      )}
    >
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', styles.icon)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-3 block">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function PatientFlowStep({
  icon: Icon,
  label,
  count,
  helper,
  action,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  helper: string;
  action: string;
  tone: ReceptionTone;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  const hasWork = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[150px] flex-col rounded-lg border p-4 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        styles.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', styles.icon)}>
          <Icon className="h-5 w-5" />
        </span>
        {hasWork ? (
          <Badge className="bg-white text-foreground shadow-sm dark:bg-slate-900">{count} waiting</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 bg-background/70 text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            Clear
          </Badge>
        )}
      </div>
      <div className="mt-4">
        <div className={cn('text-3xl font-bold leading-none', styles.count)}>{count}</div>
        <div className="mt-2 text-sm font-semibold text-foreground">{label}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-primary">
        {action}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function MiniVisitList({
  title,
  emptyText,
  visits,
  actionLabel,
  onAction,
  loading,
}: {
  title: string;
  emptyText: string;
  visits: any[];
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}) {
  const visibleVisits = Array.isArray(visits) ? visits.slice(0, 4) : [];
  return (
    <div className="rounded-lg border bg-background/60">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{visits?.length || 0} patient{(visits?.length || 0) === 1 ? '' : 's'}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onAction}>
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="divide-y">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : visibleVisits.length > 0 ? (
          visibleVisits.map((visit: any) => {
            const patient = visit.patientId || visit.patient || {};
            return (
              <div key={visit._id || visit.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {patient.firstName || 'Patient'} {patient.lastName || ''}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {visit.visitNumber || visit.visit_number || 'Visit'} - {patient.patientId || 'No MRN'}
                    </p>
                  </div>
                  {visit.insurance?.programCode || patient.insurance?.programCode ? (
                    <Badge variant="outline" className="shrink-0 bg-blue-50 text-[10px] text-blue-700">
                      Insurance
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
        )}
      </div>
      {!loading && visits.length > visibleVisits.length ? (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          +{visits.length - visibleVisits.length} more waiting
        </div>
      ) : null}
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
                  {' '}- Owes Le {patient.totalOwed.toLocaleString()}
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-6">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm space-y-5 overflow-y-auto rounded-2xl border border-white/70 bg-white p-5 shadow-[0_28px_90px_-28px_rgba(15,23,42,0.55)] sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Quick Deposit - {depositPatient.firstName} {depositPatient.lastName}</h3>
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

