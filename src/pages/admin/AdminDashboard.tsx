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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  Stethoscope,
  Pill,
  FlaskConical,
  BedDouble,
  TrendingUp,
  Package,
  Shield,
  BarChart3,
  Printer,
  Settings,
  ArrowRight,
  Loader2,
  Activity,
  UserCog,
  Calendar,
  FileText,
  FileSearch,
  Clock,
  Skull,
  Database,
  Trash2,
  HardDriveDownload,
  Download,
  Play,
  RefreshCw,
  Building2,
  Tags,
  FileCheck,
  ShieldOff,
  UserRound,
  LayoutDashboard,
  Wallet,
  CheckCircle,
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

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default function AdminDashboard() {
  const { profile, enterDoctorMode } = useAuth();
  const navigate = useNavigate();
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const { data: branches = [] } = useAllBranches();

  useRealtimeOrders();
  useRealtimeResults();
  useRealtimePatients();

  const handleEnterDoctorMode = async () => {
    const branchId = profile?.branchId;
    if (!branchId) {
      toast.error('Please select a branch first');
      return;
    }
    const { error } = await enterDoctorMode(branchId);
    if (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to enter doctor mode');
      return;
    }
    toast.success('Entered doctor mode');
    navigate('/doctor');
  };

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
  const awaitingSomething =
    (s?.visitsAwaitingLab || 0) +
    (s?.visitsAwaitingResults || 0) +
    (s?.visitsResultsReady || 0) +
    (s?.visitsAwaitingPharmacy || 0) +
    (s?.visitsAwaitingDispensing || 0) +
    (s?.visitsAwaitingDoctorReview || 0) +
    (s?.visitsAdmitted || 0);

  if (isLoading) {
    return (
      <RoleLayout title="Admin Dashboard" subtitle="Hospital-wide overview" role="admin" userName={profile?.fullName}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout
      title="Admin Dashboard"
      subtitle={`Hospital Executive Hub — ${s?.date || new Date().toLocaleDateString()}`}
      role="admin"
      userName={profile?.fullName}
    >
      {/* ───────── TOP SCOPE & TAB SELECTION BAR ───────── */}
      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border bg-card p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Clinic Administration Scope</h3>
            <p className="text-xs text-muted-foreground">
              Filtering metrics for {selectedBranchId === 'all' ? 'All Branches' : 'Selected Branch'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-full md:w-56 h-9 text-xs">
              <SelectValue placeholder="Choose branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏥 All branches (Consolidated)</SelectItem>
              {branches.map((branch: any) => (
                <SelectItem key={branch._id} value={branch._id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ───────── MAIN TABBED ARCHITECTURE ───────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="border-b bg-card rounded-t-xl px-4 pt-2 shadow-xs">
          <TabsList className="bg-transparent h-auto p-0 gap-2">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-3 text-xs gap-1.5 font-medium"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Executive Overview
            </TabsTrigger>
            <TabsTrigger
              value="operations"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-3 text-xs gap-1.5 font-medium"
            >
              <Activity className="w-3.5 h-3.5" />
              Department Operations
            </TabsTrigger>
            <TabsTrigger
              value="financials"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-3 text-xs gap-1.5 font-medium"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Financials & Trends
            </TabsTrigger>
            <TabsTrigger
              value="admin_system"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-3 text-xs gap-1.5 font-medium"
            >
              <Settings className="w-3.5 h-3.5" />
              System Admin & Backups
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ───────── TAB 1: EXECUTIVE OVERVIEW ───────── */}
        <TabsContent value="overview" className="space-y-5 mt-0">
          {/* Top Banner: revenue + throughput */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold opacity-80">Today's Revenue</p>
                  <p className="text-3xl font-extrabold mt-1">{fmtLe(rev?.totalRevenue || 0)}</p>
                  <p className="text-xs opacity-80 mt-1">{rev?.transactionCount || 0} financial transactions</p>
                </div>
                <div className="p-3 rounded-xl bg-white/20">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-white/20 text-xs">
                <div>
                  <p className="text-[10px] uppercase opacity-70">Consultation</p>
                  <p className="font-semibold text-sm">{fmtLe(rev?.consultationRevenue || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-70">Laboratory</p>
                  <p className="font-semibold text-sm">{fmtLe(rev?.labRevenue || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-70">Pharmacy</p>
                  <p className="font-semibold text-sm">{fmtLe(rev?.pharmacyRevenue || 0)}</p>
                </div>
              </div>
            </div>

            <MetricCard
              title="Total Visits Today"
              value={s?.totalVisitsToday || 0}
              icon={Calendar}
              variant="primary"
            />
            <MetricCard
              title="New Registered Patients"
              value={s?.newPatientsToday || 0}
              icon={Users}
            />
          </div>

          {/* Live clinical pipeline */}
          <div className="bg-card border rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Live Patient Care Flow Pipeline
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-11 gap-2">
              <PipelineStep label="Waiting Pay" value={s?.visitsWaitingPayment || 0} color="slate" onClick={() => navigate('/admin/patients')} />
              <PipelineStep label="Awaiting Vitals" value={s?.visitsAwaitingTriage || 0} color="amber" onClick={() => navigate('/nurse')} />
              <PipelineStep label="In Queue" value={s?.visitsInQueue || 0} color="blue" onClick={() => navigate('/admin/patients')} />
              <PipelineStep label="In Consult" value={s?.visitsInConsultation || 0} color="indigo" onClick={() => navigate('/admin/patients')} />
              <PipelineStep label="Awaiting Test" value={s?.visitsAwaitingLab || 0} color="amber" onClick={() => navigate('/admin/orders')} />
              <PipelineStep label="Awaiting Result" value={s?.visitsAwaitingResults || 0} color="orange" onClick={() => navigate('/admin/orders')} />
              <PipelineStep label="Result Ready" value={s?.visitsResultsReady || 0} color="emerald" onClick={() => navigate('/admin/results')} />
              <PipelineStep label="Awaiting Pharm" value={s?.visitsAwaitingPharmacy || 0} color="purple" onClick={() => navigate('/admin/orders')} />
              <PipelineStep label="Awaiting Disp" value={s?.visitsAwaitingDispensing || 0} color="fuchsia" onClick={() => navigate('/admin/orders')} />
              <PipelineStep label="Doctor Review" value={(s?.visitsAwaitingDoctorReview || 0) + (s?.visitsAdmitted || 0)} color="cyan" onClick={() => navigate('/doctor')} />
              <PipelineStep label="Completed" value={s?.visitsCompleted || 0} color="emerald" onClick={() => navigate('/admin/patients')} />
            </div>
          </div>

          {/* Alerts & Warnings Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-card border rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Operational Alerts & Action Items
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
                  label="Expired medications in stock"
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
                  label="Active patients currently in consultation / queue"
                  count={inProgress}
                  severity="info"
                  cta="View queue"
                  onClick={() => navigate('/admin/patients')}
                />
              </div>
            </div>

            <div className="bg-card border rounded-xl shadow-xs p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <UserCog className="w-4 h-4 text-primary" />
                  Staffing & Workforce
                </h3>
                <p className="text-xs text-muted-foreground">
                  Active healthcare providers currently logged into the system.
                </p>
                <div className="mt-4 p-4 rounded-xl bg-muted/40 text-center">
                  <p className="text-3xl font-bold text-foreground">{staff?.totalActiveStaff || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Staff on active duty</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs mt-4"
                onClick={() => navigate('/admin/users')}
              >
                Manage Staff & Roles <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ───────── TAB 2: DEPARTMENT OPERATIONS ───────── */}
        <TabsContent value="operations" className="space-y-5 mt-0">
          {/* Department Activity Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              title="Lab Tests Ordered"
              value={dept?.labOrdersToday || 0}
              icon={FlaskConical}
            />
            <MetricCard
              title="Pharmacy Orders"
              value={dept?.pharmacyOrdersToday || 0}
              icon={Pill}
            />
            <MetricCard
              title="Total Prescriptions"
              value={dept?.prescriptionsToday || 0}
              icon={FileText}
            />
            <MetricCard
              title="Active Admissions"
              value={s?.visitsAdmitted || 0}
              icon={BedDouble}
              variant={(s?.visitsAdmitted || 0) > 0 ? 'primary' : 'default'}
            />
          </div>

          {/* Quick Launchers to Role Dashboards */}
          <div className="bg-card border rounded-xl shadow-xs">
            <div className="px-5 py-3.5 border-b">
              <h3 className="font-semibold text-sm">Quick Jump to Clinical Workbenches</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4">
              <RoleLink icon={Users} label="Reception" to="/reception" navigate={navigate} />
              <RoleLink icon={Activity} label="Nursing" to="/nurse" navigate={navigate} />
              <button
                type="button"
                onClick={handleEnterDoctorMode}
                className="group flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary hover:border-primary transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Stethoscope className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs font-semibold text-primary group-hover:text-white transition-colors">Doctor Mode</span>
              </button>
              <RoleLink icon={FlaskConical} label="Laboratory" to="/lab" navigate={navigate} />
              <RoleLink icon={Pill} label="Pharmacy" to="/pharmacy" navigate={navigate} />
              <RoleLink icon={Package} label="Inventory" to="/inventory" navigate={navigate} />
              <RoleLink icon={BarChart3} label="Revenue" to="/admin/reports" navigate={navigate} />
              <RoleLink icon={DollarSign} label="Cash Desk" to="/admin/reconciliation" navigate={navigate} />
            </div>
          </div>

          {/* Low Stock Preview Table */}
          {inv?.lowStockItems && inv.lowStockItems.length > 0 && (
            <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Urgent Low-Stock Medications
                </h3>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/inventory')}>
                  Open Inventory <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="divide-y">
                {inv.lowStockItems.slice(0, 5).map((m: any) => (
                  <div key={m._id || m.name} className="px-5 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{m.name}</p>
                      <p className="text-muted-foreground mt-0.5">
                        Code: {m.medicationCode} • Reorder threshold: {m.reorderLevel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600 text-sm">
                        {m.stockQuantity} {m.unit || 'units'}
                      </p>
                      <Badge variant="destructive" className="text-[10px] mt-0.5">REORDER NOW</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ───────── TAB 3: FINANCIALS & TRENDS ───────── */}
        <TabsContent value="financials" className="space-y-5 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Weekly Revenue Trend Chart */}
            <div className="bg-card border rounded-xl shadow-xs">
              <div className="px-5 py-3.5 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  7-Day Revenue Trajectory
                </h3>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/admin/reports')}>
                  Full Report <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="p-5">
                {Array.isArray(weeklyRevenue) && weeklyRevenue.length > 0 ? (
                  <div className="space-y-2.5">
                    {weeklyRevenue.slice(-7).map((day: any, i: number) => {
                      const maxRev = Math.max(
                        ...weeklyRevenue.map(
                          (d: any) => d.totalIncome || d.totalAmount || d.total || d.revenue || 0,
                        ),
                      );
                      const dayRev = day.totalIncome || day.totalAmount || day.total || day.revenue || 0;
                      const pct = maxRev > 0 ? (dayRev / maxRev) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {day.date ? new Date(day.date).toLocaleDateString([], { weekday: 'short' }) : 'Today'}
                          </span>
                          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold w-24 text-right shrink-0">
                            Le {dayRev.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No revenue data for the past 7 days</p>
                )}
              </div>
            </div>

            {/* Financial Quick Navigation Cards */}
            <div className="bg-card border rounded-xl shadow-xs p-5 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  Accounting & Cash Control
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cash desk reconciliation, insurance claims batching, and receivable management.
                </p>
              </div>

              <div className="space-y-2.5">
                <div
                  onClick={() => navigate('/admin/reconciliation')}
                  className="cursor-pointer border rounded-xl p-3 hover:bg-muted/30 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-xs text-foreground">Daily Cash Reconciliation</p>
                    <p className="text-[11px] text-muted-foreground">End of shift drawer counts & variance</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>

                <div
                  onClick={() => navigate('/admin/insurance-claims')}
                  className="cursor-pointer border rounded-xl p-3 hover:bg-muted/30 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-xs text-foreground">Insurance Claims Management</p>
                    <p className="text-[11px] text-muted-foreground">Review corporate and private insurance claims</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>

                <div
                  onClick={() => navigate('/reception/accounts-receivable')}
                  className="cursor-pointer border rounded-xl p-3 hover:bg-muted/30 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-xs text-foreground">Accounts Receivable (Debtors)</p>
                    <p className="text-[11px] text-muted-foreground">Track outstanding patient & corporate debts</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <Button size="sm" className="w-full text-xs" onClick={() => navigate('/admin/reports')}>
                Generate Comprehensive Financial Statement
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ───────── TAB 4: SYSTEM ADMIN & MAINTENANCE ───────── */}
        <TabsContent value="admin_system" className="space-y-5 mt-0">
          {/* System Admin Grid */}
          <div className="bg-card border rounded-xl shadow-xs p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">System Administration & Setup</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <AdminTool icon={Shield} label="Staff & Roles" to="/admin/users" navigate={navigate} highlight />
              <AdminTool icon={Building2} label="Branches & APIs" to="/admin/branches" navigate={navigate} highlight />
              <AdminTool icon={FileCheck} label="Insurance" to="/admin/insurance" navigate={navigate} highlight />
              <AdminTool icon={FileCheck} label="Insurance Claims" to="/admin/insurance-claims" navigate={navigate} highlight />
              <AdminTool icon={ShieldOff} label="Block List" to="/admin/insurance-blocks" navigate={navigate} highlight />
              <AdminTool icon={Tags} label="Service Pricing" to="/admin/service-pricing" navigate={navigate} highlight />
              <AdminTool icon={UserCog} label="Doctors" to="/admin/doctors" navigate={navigate} />
              <AdminTool icon={BedDouble} label="Rooms & Beds" to="/admin/rooms" navigate={navigate} />
              <AdminTool icon={FileText} label="Report Templates" to="/admin/report-template" navigate={navigate} />
              <AdminTool icon={Printer} label="Printers" to="/admin/printers" navigate={navigate} />
              <AdminTool icon={ClipboardList} label="Audit Logs" to="/admin/audit-logs" navigate={navigate} />
              <AdminTool icon={Settings} label="Settings" to="/admin/settings" navigate={navigate} />
            </div>
          </div>

          {/* Audit Activity Preview */}
          <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-primary" />
                Recent System Audit Trail
              </h3>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/admin/audit-logs')}>
                View Full Audit Logs <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="divide-y max-h-56 overflow-y-auto">
              {recentAuditLogs.length > 0 ? (
                recentAuditLogs.map((log: any) => (
                  <div key={log._id || log.id} className="px-5 py-2.5 flex items-start gap-3 text-xs">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{log.action || log.event}</p>
                      <p className="text-muted-foreground">
                        {log.user?.fullName || log.userName || 'System'} •{' '}
                        {new Date(log.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {log.details && <p className="text-muted-foreground/70 mt-0.5 truncate">{log.details}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                      {log.resource || log.module}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="px-5 py-6 text-center text-muted-foreground text-xs">
                  No recent audit activity logged
                </div>
              )}
            </div>
          </div>

          {/* Preserved Backups Card */}
          <BackupsCard />

          {/* Preserved Danger Zone */}
          <DangerZone />
        </TabsContent>
      </Tabs>
    </RoleLayout>
  );
}

// ───────── Preserved Backups Component ─────────

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
    <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <HardDriveDownload className="w-4 h-4 text-primary" />
          Scheduled Database Backups (Daily 02:00 UTC)
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 gap-1"
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
            className="text-xs h-8 gap-1 font-medium"
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

      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b text-xs">
        <div>
          <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Last backup</p>
          <p className="font-medium mt-1 text-foreground">
            {status?.lastBackupAt
              ? new Date(status.lastBackupAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : 'Never'}
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Next scheduled</p>
          <p className="font-medium mt-1 text-foreground">
            {status?.nextScheduledAt
              ? new Date(status.nextScheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : '02:00 UTC'}
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Total archives</p>
          <p className="font-medium mt-1 text-foreground">{status?.totalBackups ?? 0}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">Total storage size</p>
          <p className="font-medium mt-1 text-foreground">{fmtBytes(status?.totalSizeBytes || 0)}</p>
        </div>
      </div>

      <div className="divide-y max-h-60 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-5 py-6 text-xs text-muted-foreground text-center">
            No archives available. Click <strong>Run backup now</strong> to generate an immediate snapshot.
          </p>
        ) : (
          visible.map((b) => (
            <div key={b.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
              <Database className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{b.filename}</p>
                <p className="text-muted-foreground text-[11px]">
                  {new Date(b.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  {' • '}
                  {fmtBytes(b.size)}
                  {b.documents > 0 ? ` • ${b.documents} docs` : ''}
                </p>
              </div>
              <a
                href={adminAPI.getBackupDownloadUrl(b.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline px-2 py-1 rounded hover:bg-primary/5"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-600 hover:text-red-700 h-7 px-2 gap-1"
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
        <div className="px-5 py-2 border-t text-center bg-muted/10">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${backups.length} backups`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ───────── Preserved Danger Zone Component ─────────

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
    <div className="bg-card border-2 border-destructive/30 rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-3 border-b border-destructive/20 bg-destructive/5 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2 text-destructive">
            <Skull className="w-4 h-4" />
            Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Destructive operations safeguard policy</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          Claude review required
        </span>
      </div>
      <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
        <div className="flex-1">
          <p className="font-semibold text-sm flex items-center gap-2 text-foreground">
            <Database className="w-4 h-4 text-muted-foreground" />
            Clear transactional test data
          </p>
          <p className="text-muted-foreground mt-0.5">
            Bulk collection deletion is strictly disabled per AGENTS.md policy. Use this preview to audit transactional records.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="w-4 h-4 mr-1.5" />
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

// ───────── Small inline components ─────────

function PipelineStep({
  label, value, color, onClick,
}: { label: string; value: number; color: string; onClick: () => void }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    slate: { bg: 'bg-slate-100 dark:bg-slate-900', text: 'text-slate-700 dark:text-slate-300' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300' },
    fuchsia: { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300' },
  };
  const { bg, text } = colorMap[color] || colorMap.slate;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-2 text-left transition-all hover:shadow-xs hover:-translate-y-0.5',
        bg,
      )}
    >
      <p className={cn('text-[10px] font-semibold uppercase tracking-wider truncate', text)}>{label}</p>
      <p className={cn('text-lg font-bold mt-0.5', text)}>{value}</p>
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
    <div className="px-5 py-3 flex items-center justify-between text-xs">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className={cn('text-lg font-bold', sevStyles[severity])}>{count}</p>
      </div>
      <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={onClick}>
        {cta} <ArrowRight className="w-3 h-3" />
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
      className="group flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border bg-card hover:bg-secondary hover:shadow-xs transition-all"
    >
      <div className="w-9 h-9 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
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
        'group flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl transition-all',
        highlight
          ? 'border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary hover:border-primary'
          : 'border bg-card hover:bg-secondary hover:shadow-xs',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
          highlight ? 'bg-primary/10 group-hover:bg-white/20' : 'bg-muted group-hover:bg-primary/10',
        )}
      >
        <Icon
          className={cn(
            'w-4 h-4 transition-colors',
            highlight ? 'text-primary group-hover:text-white' : 'text-muted-foreground group-hover:text-primary',
          )}
        />
      </div>
      <span
        className={cn(
          'text-xs font-semibold text-center leading-tight',
          highlight ? 'text-primary group-hover:text-white' : 'text-foreground',
        )}
      >
        {label}
      </span>
    </button>
  );
}
