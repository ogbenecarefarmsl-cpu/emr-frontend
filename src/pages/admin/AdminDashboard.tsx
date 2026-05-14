import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/button';
import {
  Users, ClipboardList, DollarSign, AlertTriangle, Stethoscope, Pill,
  FlaskConical, BedDouble, TrendingUp, Package, Shield, BarChart3,
  Cpu, Printer, Settings, ArrowRight, Loader2, Activity, UserCog,
  Calendar, FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Admin dashboard data from /admin/dashboard
type AdminDashboardData = {
  todayStats: {
    date: string;
    totalPatients: number;
    newPatientsToday: number;
    totalVisitsToday: number;
    visitsWaitingPayment: number;
    visitsAwaitingTriage: number;
    visitsInQueue: number;
    visitsInConsultation: number;
    visitsAwaitingLab: number;
    visitsAwaitingPharmacy: number;
    visitsAwaitingDispensing: number;
    visitsCompleted: number;
    visitsCancelled: number;
  };
  revenueBreakdown: {
    totalRevenue: number;
    consultationRevenue: number;
    labRevenue: number;
    pharmacyRevenue: number;
    otherRevenue: number;
    transactionCount: number;
  };
  departmentActivity: {
    labOrdersToday: number;
    pharmacyOrdersToday: number;
    prescriptionsToday: number;
  };
  inventoryAlerts: {
    lowStockCount: number;
    expiredCount: number;
    lowStockItems: any[];
    expiredItems: any[];
  };
  staffSummary: {
    totalActiveStaff: number;
  };
};

function fmtLe(n: number) {
  return `Le ${Number(n || 0).toLocaleString()}`;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useRealtimeOrders();
  useRealtimeResults();
  useRealtimePatients();

  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data;
    },
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });

  const { data: admissionsStats } = useQuery({
    queryKey: ['admissions', 'stats'],
    queryFn: async () => (await api.get('/admissions/stats')).data,
    refetchInterval: 60 * 1000,
  });

  const s = data?.todayStats;
  const rev = data?.revenueBreakdown;
  const dept = data?.departmentActivity;
  const inv = data?.inventoryAlerts;
  const staff = data?.staffSummary;

  // Derived metrics
  const inProgress = (s?.visitsInQueue || 0) + (s?.visitsInConsultation || 0);
  const awaitingSomething = (s?.visitsAwaitingLab || 0) + (s?.visitsAwaitingPharmacy || 0) + (s?.visitsAwaitingDispensing || 0);

  if (isLoading) {
    return (
      <RoleLayout title="Admin Dashboard" subtitle="Hospital-wide overview" role="admin" userName={profile?.full_name}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout
      title="Admin Dashboard"
      subtitle={`Hospital overview — ${s?.date || new Date().toLocaleDateString()}`}
      role="admin"
      userName={profile?.full_name}
    >
      {/* ───────── Top banner: revenue + throughput ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-6">
        <div className="lg:col-span-2 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold opacity-80">Today's Revenue</p>
              <p className="text-3xl font-bold mt-1">{fmtLe(rev?.totalRevenue || 0)}</p>
              <p className="text-xs opacity-80 mt-1">{rev?.transactionCount || 0} transactions</p>
            </div>
            <div className="p-3 rounded-xl bg-white/20">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/20">
            <div>
              <p className="text-[11px] uppercase opacity-70">Consult</p>
              <p className="font-semibold">{fmtLe(rev?.consultationRevenue || 0)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase opacity-70">Lab</p>
              <p className="font-semibold">{fmtLe(rev?.labRevenue || 0)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase opacity-70">Pharmacy</p>
              <p className="font-semibold">{fmtLe(rev?.pharmacyRevenue || 0)}</p>
            </div>
          </div>
        </div>

        <MetricCard
          title="Visits Today"
          value={s?.totalVisitsToday || 0}
          icon={Calendar}
          variant="primary"
        />
        <MetricCard
          title="New Patients"
          value={s?.newPatientsToday || 0}
          icon={Users}
        />
      </div>

      {/* ───────── Live clinical pipeline ───────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Clinical Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <PipelineStep label="Waiting Pay" value={s?.visitsWaitingPayment || 0} color="slate" onClick={() => navigate('/admin/patients')} />
          <PipelineStep label="Awaiting Vitals" value={s?.visitsAwaitingTriage || 0} color="amber" onClick={() => navigate('/nurse')} />
          <PipelineStep label="In Queue" value={s?.visitsInQueue || 0} color="blue" onClick={() => navigate('/admin/patients')} />
          <PipelineStep label="In Consult" value={s?.visitsInConsultation || 0} color="indigo" onClick={() => navigate('/admin/patients')} />
          <PipelineStep label="Awaiting Lab" value={s?.visitsAwaitingLab || 0} color="amber" onClick={() => navigate('/admin/orders')} />
          <PipelineStep label="Awaiting Pharm" value={s?.visitsAwaitingPharmacy || 0} color="purple" onClick={() => navigate('/admin/orders')} />
          <PipelineStep label="Awaiting Disp" value={s?.visitsAwaitingDispensing || 0} color="fuchsia" onClick={() => navigate('/admin/orders')} />
          <PipelineStep label="Completed" value={s?.visitsCompleted || 0} color="emerald" onClick={() => navigate('/admin/patients')} />
        </div>
      </div>

      {/* ───────── Department activity ───────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MetricCard
          title="Lab Orders"
          value={dept?.labOrdersToday || 0}
          icon={FlaskConical}
        />
        <MetricCard
          title="Pharmacy Orders"
          value={dept?.pharmacyOrdersToday || 0}
          icon={Pill}
        />
        <MetricCard
          title="Prescriptions"
          value={dept?.prescriptionsToday || 0}
          icon={FileText}
        />
        <MetricCard
          title="Active Admissions"
          value={admissionsStats?.activeTotal || 0}
          icon={BedDouble}
          variant={(admissionsStats?.activeTotal || 0) > 0 ? 'primary' : 'default'}
        />
        <MetricCard
          title="Active Staff"
          value={staff?.totalActiveStaff || 0}
          icon={UserCog}
        />
      </div>

      {/* ───────── Alerts + quick links row ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Alerts */}
        <div className="lg:col-span-1 bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alerts & Warnings
            </h3>
          </div>
          <div className="divide-y">
            <AlertRow
              label="Low-stock medications"
              count={inv?.lowStockCount || 0}
              severity={inv?.lowStockCount ? 'warning' : 'ok'}
              cta="View inventory"
              onClick={() => navigate('/inventory')}
            />
            <AlertRow
              label="Expired medications"
              count={inv?.expiredCount || 0}
              severity={inv?.expiredCount ? 'critical' : 'ok'}
              cta="Remove expired"
              onClick={() => navigate('/inventory')}
            />
            <AlertRow
              label="Cancelled visits today"
              count={s?.visitsCancelled || 0}
              severity={s?.visitsCancelled ? 'warning' : 'ok'}
              cta="View report"
              onClick={() => navigate('/admin/daily-report')}
            />
            <AlertRow
              label="Patients in-progress"
              count={inProgress}
              severity="info"
              cta="View"
              onClick={() => navigate('/admin/patients')}
            />
            <AlertRow
              label="Awaiting downstream service"
              count={awaitingSomething}
              severity="info"
              cta="View"
              onClick={() => navigate('/admin/orders')}
            />
          </div>
        </div>

        {/* Quick links: role dashboards */}
        <div className="lg:col-span-2 bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-sm">Open Role Dashboards</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4">
            <RoleLink icon={Users} label="Reception" to="/reception" navigate={navigate} />
            <RoleLink icon={Activity} label="Nursing" to="/nurse" navigate={navigate} />
            <RoleLink icon={Stethoscope} label="Doctor" to="/doctor" navigate={navigate} />
            <RoleLink icon={FlaskConical} label="Lab" to="/lab" navigate={navigate} />
            <RoleLink icon={Pill} label="Pharmacy" to="/pharmacy" navigate={navigate} />
            <RoleLink icon={Package} label="Inventory" to="/inventory" navigate={navigate} />
            <RoleLink icon={BarChart3} label="Revenue" to="/admin/reports" navigate={navigate} />
            <RoleLink icon={DollarSign} label="Cash Desk" to="/admin/reconciliation" navigate={navigate} />
          </div>
        </div>
      </div>

      {/* ───────── Admin tools ───────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">System Administration</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <AdminTool icon={Shield} label="Staff & Roles" to="/admin/users" navigate={navigate} highlight />
          <AdminTool icon={UserCog} label="Doctors" to="/admin/doctors" navigate={navigate} />
          <AdminTool icon={FlaskConical} label="Lab Test Pricing" to="/admin/test-catalog" navigate={navigate} />
          <AdminTool icon={Package} label="Inventory" to="/inventory" navigate={navigate} />
          <AdminTool icon={FileText} label="Report Templates" to="/admin/report-template" navigate={navigate} />
          <AdminTool icon={Cpu} label="Lab Machines" to="/admin/machines" navigate={navigate} />
          <AdminTool icon={Printer} label="Printers" to="/admin/printers" navigate={navigate} />
          <AdminTool icon={BarChart3} label="Revenue Reports" to="/admin/reports" navigate={navigate} />
          <AdminTool icon={TrendingUp} label="Daily Summary" to="/admin/daily-report" navigate={navigate} />
          <AdminTool icon={DollarSign} label="Cash Reconciliation" to="/admin/reconciliation" navigate={navigate} />
          <AdminTool icon={ClipboardList} label="Audit Logs" to="/admin/audit-logs" navigate={navigate} />
          <AdminTool icon={Stethoscope} label="Doctor Activity" to="/admin/doctor-referral-report" navigate={navigate} />
          <AdminTool icon={Settings} label="Settings" to="/admin/settings" navigate={navigate} />
        </div>
      </div>

      {/* ───────── Low-stock preview ───────── */}
      {inv?.lowStockItems && inv.lowStockItems.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Low-Stock Medications
            </h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/inventory')}>
              Open Inventory <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="divide-y">
            {inv.lowStockItems.slice(0, 5).map((m: any) => (
              <div key={m._id || m.name} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.medicationCode} • reorder at {m.reorderLevel}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">
                    {m.stockQuantity} {m.unit || 'units'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </RoleLayout>
  );
}

// ───────── Small inline components ─────────

function PipelineStep({
  label, value, color, onClick,
}: { label: string; value: number; color: string; onClick: () => void }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    slate: { bg: 'bg-slate-100', text: 'text-slate-700' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
    fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  };
  const { bg, text } = colorMap[color] || colorMap.slate;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2.5 text-left transition-all hover:shadow-sm hover:-translate-y-0.5',
        bg,
      )}
    >
      <p className={cn('text-[11px] font-semibold uppercase tracking-wider', text)}>{label}</p>
      <p className={cn('text-xl font-bold mt-0.5', text)}>{value}</p>
    </button>
  );
}

function AlertRow({
  label, count, severity, cta, onClick,
}: { label: string; count: number; severity: 'ok' | 'info' | 'warning' | 'critical'; cta: string; onClick: () => void }) {
  const sevStyles: Record<string, string> = {
    ok: 'text-muted-foreground',
    info: 'text-blue-600',
    warning: 'text-amber-600',
    critical: 'text-red-600',
  };
  return (
    <div className="px-5 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm">{label}</p>
        <p className={cn('text-xl font-semibold', sevStyles[severity])}>{count}</p>
      </div>
      <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={onClick}>
        {cta} <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function RoleLink({
  icon: Icon, label, to, navigate,
}: { icon: any; label: string; to: string; navigate: (to: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-card hover:bg-secondary hover:shadow-md transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </button>
  );
}

function AdminTool({
  icon: Icon, label, to, navigate, highlight,
}: { icon: any; label: string; to: string; navigate: (to: string) => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={cn(
        'group flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all',
        highlight
          ? 'border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary hover:border-primary'
          : 'border bg-card hover:bg-secondary hover:shadow-md',
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
          highlight ? 'bg-primary/10 group-hover:bg-white/20' : 'bg-muted group-hover:bg-primary/10',
        )}
      >
        <Icon className={cn(
          'w-5 h-5 transition-colors',
          highlight ? 'text-primary group-hover:text-white' : 'text-muted-foreground group-hover:text-primary',
        )} />
      </div>
      <span className={cn(
        'text-xs font-semibold text-center leading-tight',
        highlight ? 'text-primary group-hover:text-white' : 'text-foreground',
      )}>{label}</span>
    </button>
  );
}
