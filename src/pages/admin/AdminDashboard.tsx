import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useAllBranches } from '@/hooks/useBranch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { adminAPI } from '@/services/api';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, ClipboardList, DollarSign, AlertTriangle, Stethoscope, Pill,
  FlaskConical, BedDouble, TrendingUp, Package, Shield, BarChart3,
  Printer, Settings, ArrowRight, Loader2, Activity, UserCog,
  Calendar, FileText, FileSearch, Clock, Skull, Database, Trash2,
  HardDriveDownload, Download, Play, RefreshCw, Building2, Tags, FileCheck,
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
    visitsAwaitingResults: number;
    visitsResultsReady: number;
    visitsAwaitingDoctorReview: number;
    visitsAdmitted: number;
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
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const { data: branches = [] } = useAllBranches();

  useRealtimeOrders();
  useRealtimeResults();
  useRealtimePatients();

  const { data, isLoading } = useQuery<AdminDashboardData>({
    queryKey: ['admin', 'dashboard', selectedBranchId],
    queryFn: () => adminAPI.getDashboard(undefined, selectedBranchId === 'all' ? undefined : selectedBranchId),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });

  const { data: recentAuditLogs = [] } = useQuery({
    queryKey: ['audit-logs', 'recent'],
    queryFn: async () => {
      const res = await api.get('/audit/logs', { params: { limit: 5 } });
      return res.data?.logs || [];
    },
    refetchInterval: 60 * 1000,
  });

  const { data: weeklyRevenue = [] } = useQuery({
    queryKey: ['revenue', 'weekly', selectedBranchId],
    queryFn: async () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const res = await api.get('/orders/stats/daily-income', {
        params: {
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          ...(selectedBranchId === 'all' ? {} : { branchId: selectedBranchId }),
        },
      });
      return res.data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const s = data?.todayStats;
  const rev = data?.revenueBreakdown;
  const dept = data?.departmentActivity;
  const inv = data?.inventoryAlerts;
  const staff = data?.staffSummary;

  // Derived metrics
  const inProgress = (s?.visitsInQueue || 0) + (s?.visitsInConsultation || 0);
  const awaitingSomething = (s?.visitsAwaitingLab || 0)
    + (s?.visitsAwaitingResults || 0)
    + (s?.visitsResultsReady || 0)
    + (s?.visitsAwaitingPharmacy || 0)
    + (s?.visitsAwaitingDispensing || 0)
    + (s?.visitsAwaitingDoctorReview || 0)
    + (s?.visitsAdmitted || 0);

  if (isLoading) {
    return (
      <RoleLayout title="Admin Dashboard" subtitle="Hospital-wide overview" role="admin" userName={profile?.fullName}>
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
      userName={profile?.fullName}
    >
      <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Dashboard Scope</h3>
          <p className="text-sm text-muted-foreground">
            View all branches or focus this dashboard on one outlet.
          </p>
        </div>
        <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
          <SelectTrigger className="w-full md:w-72">
            <SelectValue placeholder="Choose branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((branch: any) => (
              <SelectItem key={branch._id} value={branch._id}>{branch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-2">
          <PipelineStep label="Waiting Pay" value={s?.visitsWaitingPayment || 0} color="slate" onClick={() => navigate('/admin/patients')} />
          <PipelineStep label="Awaiting Vitals" value={s?.visitsAwaitingTriage || 0} color="amber" onClick={() => navigate('/nurse')} />
          <PipelineStep label="In Queue" value={s?.visitsInQueue || 0} color="blue" onClick={() => navigate('/admin/patients')} />
          <PipelineStep label="In Consult" value={s?.visitsInConsultation || 0} color="indigo" onClick={() => navigate('/admin/patients')} />
          <PipelineStep label="Awaiting Lab" value={s?.visitsAwaitingLab || 0} color="amber" onClick={() => navigate('/admin/orders')} />
          <PipelineStep label="Awaiting Result" value={s?.visitsAwaitingResults || 0} color="orange" onClick={() => navigate('/admin/orders')} />
          <PipelineStep label="Result Ready" value={s?.visitsResultsReady || 0} color="emerald" onClick={() => navigate('/admin/results')} />
          <PipelineStep label="Awaiting Pharm" value={s?.visitsAwaitingPharmacy || 0} color="purple" onClick={() => navigate('/admin/orders')} />
          <PipelineStep label="Awaiting Disp" value={s?.visitsAwaitingDispensing || 0} color="fuchsia" onClick={() => navigate('/admin/orders')} />
          <PipelineStep label="Doctor Review" value={(s?.visitsAwaitingDoctorReview || 0) + (s?.visitsAdmitted || 0)} color="cyan" onClick={() => navigate('/doctor')} />
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
          value={s?.visitsAdmitted || 0}
          icon={BedDouble}
          variant={(s?.visitsAdmitted || 0) > 0 ? 'primary' : 'default'}
        />
        <MetricCard
          title="Active Staff"
          value={staff?.totalActiveStaff || 0}
          icon={UserCog}
        />
      </div>

      {/* ───────── Revenue trend + Audit log preview ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Revenue Trend */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              7-Day Revenue Trend
            </h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/admin/reports')}>
              Full Report <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="p-5">
            {Array.isArray(weeklyRevenue) && weeklyRevenue.length > 0 ? (
              <div className="space-y-2">
                {weeklyRevenue.slice(-7).map((day: any, i: number) => {
                  const maxRev = Math.max(...weeklyRevenue.map((d: any) => d.totalIncome || d.totalAmount || d.total || d.revenue || 0));
                  const dayRev = day.totalIncome || day.totalAmount || day.total || day.revenue || 0;
                  const pct = maxRev > 0 ? (dayRev / maxRev) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">
                        {day.date ? new Date(day.date).toLocaleDateString([], { weekday: 'short' }) : 'Today'}
                      </span>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-20 text-right flex-shrink-0">
                        Le {dayRev.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No revenue data for the past 7 days</p>
            )}
          </div>
        </div>

        {/* Recent Audit Log */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-primary" />
              Recent Audit Activity
            </h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/admin/audit-logs')}>
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {recentAuditLogs.length > 0 ? recentAuditLogs.map((log: any) => (
              <div key={log._id || log.id} className="px-5 py-3 flex items-start gap-3">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{log.action || log.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.user?.fullName || log.userName || 'System'} · {new Date(log.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {log.details && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{log.details}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{log.resource || log.module}</Badge>
              </div>
            )) : (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No recent audit activity
              </div>
            )}
          </div>
        </div>
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
          <AdminTool icon={Building2} label="Branches & APIs" to="/admin/branches" navigate={navigate} highlight />
          <AdminTool icon={FileCheck} label="Insurance" to="/admin/insurance" navigate={navigate} highlight />
          <AdminTool icon={Tags} label="Service Pricing" to="/admin/service-pricing" navigate={navigate} highlight />
          <AdminTool icon={UserCog} label="Doctors" to="/admin/doctors" navigate={navigate} />
          <AdminTool icon={BedDouble} label="Rooms & Beds" to="/admin/rooms" navigate={navigate} />
          <AdminTool icon={FileText} label="Report Templates" to="/admin/report-template" navigate={navigate} />
          <AdminTool icon={Printer} label="Printers" to="/admin/printers" navigate={navigate} />
          <AdminTool icon={ClipboardList} label="Audit Logs" to="/admin/audit-logs" navigate={navigate} />
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

      <BackupsCard />
      <DangerZone />
    </RoleLayout>
  );
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function BackupsCard() {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['admin', 'backup', 'status'],
    queryFn: () => adminAPI.getBackupStatus(),
    refetchInterval: 60 * 1000,
  });
  const { data: list, refetch: refetchList, isFetching } = useQuery({
    queryKey: ['admin', 'backup', 'list'],
    queryFn: () => adminAPI.listBackups(),
    refetchInterval: 60 * 1000,
  });

  const trigger = useMutation({
    mutationFn: () => adminAPI.triggerBackup(),
    onSuccess: (backup: any) => {
      toast.success(`Backup ${backup.id} created (${fmtBytes(backup.size)}, ${backup.documents} docs)`);
      qc.invalidateQueries({ queryKey: ['admin', 'backup'] });
    },
    onError: (e: any) => {
      toast.error(`Backup failed: ${e?.response?.data?.message || e?.message || 'unknown'}`);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => adminAPI.deleteBackup(id),
    onSuccess: () => {
      toast.success('Backup deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'backup'] });
    },
  });

  const backups = list?.backups || [];
  const visible = showAll ? backups : backups.slice(0, 5);

  return (
    <div className="bg-card border rounded-xl shadow-sm mb-6">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <HardDriveDownload className="w-4 h-4 text-primary" />
          Database Backups
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => {
              refetchStatus();
              refetchList();
            }}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1"
            disabled={trigger.isPending || status?.isRunning}
            onClick={() => trigger.mutate()}
          >
            {trigger.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Run backup now
          </Button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 border-b">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last backup</p>
          <p className="text-sm font-medium mt-1">
            {status?.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next scheduled</p>
          <p className="text-sm font-medium mt-1">
            {status?.nextScheduledAt ? new Date(status.nextScheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total backups</p>
          <p className="text-sm font-medium mt-1">{status?.totalBackups ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total size</p>
          <p className="text-sm font-medium mt-1">{fmtBytes(status?.totalSizeBytes || 0)}</p>
        </div>
      </div>

      <div className="divide-y">
        {visible.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground text-center">
            No backups yet. The first daily run is scheduled for 02:00 UTC, or click <strong>Run backup now</strong> to create one.
          </p>
        ) : (
          visible.map((b) => (
            <div key={b.id} className="px-5 py-3 flex items-center gap-3">
              <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  {' · '}
                  {fmtBytes(b.size)}
                  {b.documents > 0 ? ` · ${b.documents} docs` : ''}
                  {b.durationMs > 0 ? ` · ${(b.durationMs / 1000).toFixed(1)}s` : ''}
                </p>
              </div>
              <a
                href={adminAPI.getBackupDownloadUrl(b.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-600 hover:text-red-700 gap-1"
                onClick={() => {
                  if (window.confirm(`Delete backup ${b.id}? This cannot be undone.`)) {
                    del.mutate(b.id);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </div>
          ))
        )}
      </div>

      {backups.length > 5 && (
        <div className="px-5 py-3 border-t text-center">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${backups.length}`}
          </Button>
        </div>
      )}
    </div>
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
    orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
    fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
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

function DangerZone() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ deleted: Record<string, number>; preserved: string[]; timestamp: string } | null>(null);

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['admin', 'clear-test-data', 'preview'],
    queryFn: () => adminAPI.clearTestDataPreview(),
    enabled: open,
    staleTime: 30_000,
  });

  const clearMutation = useMutation({
    mutationFn: () => adminAPI.clearTestData('DISABLED'),
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Cleared ${Object.values(data.deleted).reduce((s, n) => s + n, 0)} records`);
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to clear test data');
    },
  });

  const totalToDelete = preview ? Object.values(preview).reduce((s, n) => s + (n as number), 0) : 0;
  const canSubmit = false;

  const reset = () => {
    setOpen(false);
    setResult(null);
  };

  return (
    <div className="bg-card border-2 border-destructive/30 rounded-xl shadow-sm mt-6">
      <div className="px-5 py-4 border-b border-destructive/20 bg-destructive/5 rounded-t-xl flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2 text-destructive">
            <Skull className="w-4 h-4" />
            Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Destructive operations. Use with care.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
          Claude review required
        </span>
      </div>
      <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            Clear all test data
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Bulk deletion is disabled. Use this preview to audit counts before creating a targeted cleanup request.
          </p>
          <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
            Policy: cleanup must list explicit record IDs and receive per-category approval before anything is deleted.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="w-4 h-4 mr-2" />
            Preview data counts
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); else setOpen(true); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Skull className="w-5 h-5" />
              Clear all test data disabled
            </DialogTitle>
            <DialogDescription>
              Broad transactional data deletion is disabled. Review counts here, then use a targeted cleanup workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cleanup policy:</p>
              <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                <li>List the exact record IDs to remove.</li>
                <li>Confirm each affected category.</li>
                <li>Run only targeted deletion after approval.</li>
              </ol>
            </div>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-status-normal/30 bg-status-normal/10 p-4">
                <p className="font-semibold text-status-normal">Cleared successfully at {new Date(result.timestamp).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Object.values(result.deleted).reduce((s, n) => s + n, 0)} records removed across {Object.keys(result.deleted).length} collections.
                </p>
              </div>
              <div className="rounded-lg border p-3 max-h-72 overflow-y-auto">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Deleted counts</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(result.deleted).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-dashed py-1">
                      <span className="capitalize text-muted-foreground">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-mono font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Preserved reference data</p>
                <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                  {result.preserved.map((p) => (<li key={p}>• {p}</li>))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 max-h-72 overflow-y-auto">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  {previewLoading ? 'Counting records...' : `${totalToDelete.toLocaleString()} transactional records found`}
                </p>
                {preview && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {Object.entries(preview)
                      .filter(([, v]) => (v as number) > 0)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-dashed py-1">
                          <span className="capitalize text-muted-foreground">{k.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-mono font-semibold">{(v as number).toLocaleString()}</span>
                        </div>
                      ))}
                    {totalToDelete === 0 && (
                      <p className="text-xs text-muted-foreground col-span-2 py-2">No transactional data found.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Preserved:</p>
                <p className="text-xs">
                  users, branches, medications, rooms, doctor profiles, LIS catalog, machines, suppliers, report templates.
                </p>
              </div>

              <div className="rounded-lg border border-muted bg-muted/30 p-3">
                <p className="text-xs font-medium">Bulk clear is disabled.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a targeted cleanup with explicit IDs instead of deleting whole collections.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {result ? (
              <Button onClick={reset}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={reset}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={!canSubmit}
                  onClick={() => clearMutation.mutate()}
                >
                  {clearMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Bulk clear disabled
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

