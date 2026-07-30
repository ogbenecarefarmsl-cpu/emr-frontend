import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useRecentPatients } from '@/hooks/usePatients';
import { usePaymentStats, useDailyIncome } from '@/hooks/useOrders';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { PendingOrders } from '@/components/reception/PendingOrders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPatientFullName } from '@/utils/orderHelpers';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ordersAPI } from '@/services/api';
import { useReceptionDashboard } from '@/hooks/useVisits';
import { cn } from '@/lib/utils';

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

  const { data: receptionSnapshot } = useReceptionDashboard();
  const doctorQueue = receptionSnapshot?.doctorQueue ?? [];
  const visitStats = receptionSnapshot?.todayStats;
  
  const { data: patientOutstandingData } = useQuery({
    queryKey: ['patient-outstanding'],
    queryFn: () => ordersAPI.getPatientOutstanding(),
    staleTime: 30_000,
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
  const pendingClinicalPayments = pendingLabVisits.length + pendingPharmacyVisits.length;
  
  const scrollToClinicalPayments = () => {
    if (typeof document === 'undefined') return;
    document.getElementById('pending-clinical-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <RoleLayout
      title="Reception Home"
      subtitle="Guide patients through registration, payment, and care"
      role="receptionist"
      userName={profile?.fullName}
    >
      {/* PRIMARY TASK ROW */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReceptionActionCard
          icon={UserPlus}
          title="Register patient"
          description="Create a new patient record"
          actionLabel="Register"
          tone="primary"
          onClick={() => navigate('/reception/register')}
        />
        <ReceptionActionCard
          icon={ClipboardCheck}
          title="Start visit"
          description="Begin a new or renewal visit"
          actionLabel="Start"
          tone="blue"
          onClick={() => navigate('/reception/visit-registration')}
        />
        <ReceptionActionCard
          icon={CreditCard}
          title="Collect payment"
          description="Process any payment due"
          actionLabel="Open billing"
          tone="green"
          onClick={() => navigate('/reception/payments')}
        />
        <ReceptionActionCard
          icon={Users}
          title="Find patient"
          description="Search records and history"
          actionLabel="Search"
          tone="slate"
          onClick={() => navigate('/reception/patients')}
        />
      </div>

      {/* COMPACT PATIENT JOURNEY STRIP */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Patient journey — today</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={() => navigate('/reception/reconciliation')}
          >
            End-of-day report <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <CompactJourneyCard
            label="Total visits"
            count={visitStats?.totalVisits ?? 0}
            onClick={() => navigate('/reception/patients')}
          />
          <CompactJourneyCard
            label="Awaiting payment"
            count={pendingConsultationVisits.length}
            tone={pendingConsultationVisits.length > 0 ? 'amber' : 'muted'}
            onClick={() => navigate('/reception/payments')}
          />
          <CompactJourneyCard
            label="Ready for vitals"
            count={awaitingTriageCount}
            tone={awaitingTriageCount > 0 ? 'blue' : 'muted'}
            onClick={() => navigate('/reception/patients')}
          />
          <CompactJourneyCard
            label="With doctor"
            count={doctorQueue.length}
            tone={doctorQueue.length > 0 ? 'primary' : 'muted'}
            onClick={() => navigate('/reception/patients')}
          />
          <CompactJourneyCard
            label="Lab/Pharmacy due"
            count={pendingClinicalPayments}
            tone={pendingClinicalPayments > 0 ? 'green' : 'muted'}
            onClick={scrollToClinicalPayments}
          />
        </div>
      </div>

      {/* NEEDS ATTENTION NOW */}
      <NeedsAttentionList
        pendingConsultations={pendingConsultationVisits}
        pendingClinical={pendingClinicalPayments}
        owingPatients={patientOutstandingData?.patients || []}
        onNavigatePayments={() => navigate('/reception/payments')}
        onNavigateClinical={scrollToClinicalPayments}
        onNavigateOwing={() => navigate('/reception/accounts-receivable')}
      />

      {/* Order and medicine payments (detailed) */}
      <div id="pending-clinical-payments" className="mb-6 scroll-mt-20">
        <PendingOrders />
      </div>

      {/* RECENT REGISTRATIONS (limited to 3) */}
      <div className="bg-card border rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recent registrations</h3>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/reception/patients')}>
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="divide-y">
          {patientsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {recentRegistrations.slice(0, 3).map((patient: any) => {
                const patientId = patient._id || patient.id;
                const patientCode = patient.patientId || patient.patient_id || 'N/A';
                const phone = patient.phone || patient.phoneNumber || patient.contact;
                return (
                  <div key={patient.id || patient._id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{getPatientFullName(patient)}</p>
                          <Badge variant="outline" className="text-[10px] font-mono">{patientCode}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
                          <span>{formatRegistrationTimestamp(patient)}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs flex-shrink-0"
                        onClick={() => navigate(`/reception/visit-registration?patient=${patientId}`)}
                      >
                        Start visit
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
    </RoleLayout>
  );
}

/* ==================== COMPACT JOURNEY CARD ==================== */
function CompactJourneyCard({
  label,
  count,
  tone = 'muted',
  onClick,
}: {
  label: string;
  count: number;
  tone?: ReceptionTone;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start rounded-lg border p-3 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        styles.card,
      )}
    >
      <div className={cn('text-2xl font-bold leading-none', styles.count)}>{count}</div>
      <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
    </button>
  );
}

/* ==================== NEEDS ATTENTION LIST ==================== */
function NeedsAttentionList({
  pendingConsultations,
  pendingClinical,
  owingPatients,
  onNavigatePayments,
  onNavigateClinical,
  onNavigateOwing,
}: {
  pendingConsultations: any[];
  pendingClinical: number;
  owingPatients: any[];
  onNavigatePayments: () => void;
  onNavigateClinical: () => void;
  onNavigateOwing: () => void;
}) {
  const items = [
    {
      id: 'consultations',
      label: 'Consultation payments',
      count: pendingConsultations.length,
      icon: CreditCard,
      tone: 'amber' as ReceptionTone,
      action: 'Collect now',
      onClick: onNavigatePayments,
    },
    {
      id: 'clinical',
      label: 'Lab/Pharmacy payments',
      count: pendingClinical,
      icon: FlaskConical,
      tone: 'green' as ReceptionTone,
      action: 'Review orders',
      onClick: onNavigateClinical,
    },
    {
      id: 'owing',
      label: 'Outstanding balances',
      count: owingPatients.length,
      icon: AlertTriangle,
      tone: 'amber' as ReceptionTone,
      action: 'View patients',
      onClick: onNavigateOwing,
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-green-200 bg-green-50/50 p-6 text-center dark:border-green-800 dark:bg-green-950/20">
        <CheckCircle2 className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" />
        <p className="mt-2 text-sm font-medium text-green-800 dark:text-green-300">All caught up</p>
        <p className="mt-1 text-xs text-green-700/70 dark:text-green-400/70">
          No urgent payment actions right now
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Needs attention now</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const styles = toneStyles[item.tone];
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={cn(
                'group flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                styles.card,
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', styles.icon)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    <Badge className={cn('text-xs', styles.count)}>{item.count}</Badge>
                  </div>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.count === 1 ? '1 item' : `${item.count} items`} waiting
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {item.action}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
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