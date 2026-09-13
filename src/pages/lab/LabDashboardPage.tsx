import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePendingCollectionOrders, useProcessingOrders, useTodayOrders, useCollectOrder } from '@/hooks/useOrders';
import { useCriticalResults, usePendingVerificationResults, useVerifyResult } from '@/hooks/useResults';
import { useCreateSample } from '@/hooks/useSamples';
import { useMachines } from '@/hooks/useMachines';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import api, { visitsAPI } from '@/services/api';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MachineStatusCard } from '@/components/dashboard/MachineStatusCard';
import { LiveConnectionMonitor } from '@/components/machines/LiveConnectionMonitor';
import { SendToAnalyzerDialog } from '@/components/machines/SendToAnalyzerDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getPatient,
  getOrderId,
  getPatientName,
  getOrderPriority,
  getGroupedTestsByPanel,
  getOrderNumber,
  getOrderTests,
} from '@/utils/orderHelpers';

// Icons
import {
  TestTube,
  FileText,
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Loader2,
  ArrowRight,
  Search,
  ClipboardCheck,
  Clock,
  Timer,
  Beaker,
  AlertCircle,
  Send,
  QrCode,
  Printer,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Layers,
  CheckCheck,
  Eye,
  Activity,
  Check,
  BarChart2,
} from 'lucide-react';

export default function LabDashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Realtime events
  useRealtimeOrders();
  useRealtimeResults();
  useRealtimePatients();

  // Queries
  const { data: pendingOrders = [], isLoading: pendingLoading, refetch: refetchPending } = usePendingCollectionOrders();
  const { data: processingOrders = [], isLoading: processingLoading, refetch: refetchProcessing } = useProcessingOrders();
  const { data: todayOrders = [], refetch: refetchToday } = useTodayOrders();
  const { data: criticalResults = [], refetch: refetchCritical } = useCriticalResults();
  const { data: pendingVerification = [], refetch: refetchVerification } = usePendingVerificationResults();
  const { data: machines = [] } = useMachines();

  const { data: qcResults = [] } = useQuery({
    queryKey: ['qc', 'recent-failures'],
    queryFn: async () => {
      const res = await api.get('/qc-results?status=fail&limit=5');
      return res.data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Mutations
  const collectOrder = useCollectOrder();
  const createSample = useCreateSample();
  const verifyResult = useVerifyResult();

  // State
  const [activeTab, setActiveTab] = useState<string>('collection');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'stat' | 'urgent' | 'routine'>('all');

  // Sample collection dialog state
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [orderToCollect, setOrderToCollect] = useState<any>(null);
  const [sampleType, setSampleType] = useState('blood_edta');
  const [sampleNotes, setSampleNotes] = useState('');
  const [collectedResult, setCollectedResult] = useState<{ sampleId: string; barcode: string } | null>(null);

  // Analyzer dispatch dialog state
  const [analyzerDialogOpen, setAnalyzerDialogOpen] = useState(false);
  const [analyzerOrder, setAnalyzerOrder] = useState<{ id: string; number: string; tests: string[] } | null>(null);

  // Verifying state
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [isBulkVerifying, setIsBulkVerifying] = useState(false);

  // Computed metrics
  const completedToday = useMemo(() => {
    return Array.isArray(todayOrders) ? todayOrders.filter(o => o.status === 'completed').length : 0;
  }, [todayOrders]);

  const onlineMachines = useMemo(() => {
    return Array.isArray(machines) ? machines.filter(m => m.status === 'online' || m.status === 'processing').length : 0;
  }, [machines]);

  const avgTurnaround = useMemo(() => {
    if (!Array.isArray(todayOrders)) return null;
    const completed = todayOrders.filter(o => o.status === 'completed' && o.completedAt && o.createdAt);
    if (completed.length === 0) return null;
    const totalMinutes = completed.reduce((sum: number, o: any) => {
      const start = new Date(o.createdAt).getTime();
      const end = new Date(o.completedAt).getTime();
      return sum + (end - start) / (1000 * 60);
    }, 0);
    return Math.round(totalMinutes / completed.length);
  }, [todayOrders]);

  // STAT count
  const statCount = useMemo(() => {
    const pStat = (pendingOrders || []).filter(o => o.priority === 'stat').length;
    const prStat = (processingOrders || []).filter(o => o.priority === 'stat').length;
    return pStat + prStat;
  }, [pendingOrders, processingOrders]);

  // Filtered collections
  const filteredCollectionOrders = useMemo(() => {
    return (pendingOrders || []).filter((o: any) => {
      const pName = getPatientName(o)?.toLowerCase() || '';
      const oNum = o.orderNumber?.toLowerCase() || '';
      const q = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || pName.includes(q) || oNum.includes(q);
      const matchesPriority = priorityFilter === 'all' || o.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [pendingOrders, searchTerm, priorityFilter]);

  // Filtered processing
  const filteredProcessingOrders = useMemo(() => {
    return (processingOrders || []).filter((o: any) => {
      const pName = getPatientName(o)?.toLowerCase() || '';
      const oNum = o.orderNumber?.toLowerCase() || '';
      const q = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || pName.includes(q) || oNum.includes(q);
      const matchesPriority = priorityFilter === 'all' || o.priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [processingOrders, searchTerm, priorityFilter]);

  // Filtered verification results
  const filteredVerificationResults = useMemo(() => {
    return (pendingVerification || []).filter((r: any) => {
      const pName = (r.orders?.patientId?.fullName || r.patientName || '').toLowerCase();
      const test = (r.testName || r.testCode || '').toLowerCase();
      const q = searchTerm.toLowerCase();
      return !searchTerm || pName.includes(q) || test.includes(q);
    });
  }, [pendingVerification, searchTerm]);

  // Handle sample draw action
  const openCollectDialog = (order: any) => {
    setOrderToCollect(order);
    setSampleNotes('');
    setCollectedResult(null);

    // Auto-detect default sample type based on test codes
    const tests = getOrderTests(order);
    const codes = tests.map((t: any) => (t.testCode || t.code || '').toUpperCase());
    if (codes.some((c: string) => c.includes('URINE') || c === 'UA')) {
      setSampleType('urine_sterile');
    } else if (codes.some((c: string) => c.includes('STOOL'))) {
      setSampleType('stool_container');
    } else if (codes.some((c: string) => c.includes('FBC') || c.includes('CBC') || c.includes('MALARIA'))) {
      setSampleType('blood_edta');
    } else if (codes.some((c: string) => c.includes('PT') || c.includes('INR'))) {
      setSampleType('blood_citrate');
    } else {
      setSampleType('blood_plain');
    }

    setCollectModalOpen(true);
  };

  const handleConfirmCollection = async () => {
    if (!orderToCollect) return;

    try {
      const orderId = getOrderId(orderToCollect);
      const patient = getPatient(orderToCollect);
      const patientId = patient?._id || patient?.id;

      if (!orderId || !patientId) {
        toast.error('Missing order or patient record identifier');
        return;
      }

      // 1. Create sample in inventory/LIS
      const sample = await createSample.mutateAsync({
        orderId,
        patientId,
        sampleType,
      });

      // 2. Mark order status as collected / processing
      await collectOrder.mutateAsync(orderId);

      const sampleBarcode = sample.sampleId || sample.sample_id || `SMP-${Date.now().toString().slice(-6)}`;
      setCollectedResult({
        sampleId: sample._id || sample.id || sampleBarcode,
        barcode: sampleBarcode,
      });

      toast.success(`Sample drawn successfully. Tube ID: ${sampleBarcode}`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record sample collection');
    }
  };

  // Handle single result verification
  const handleVerifySingle = async (result: any) => {
    const resId = result.id || result._id;
    if (!resId) return;

    setVerifyingId(resId);
    try {
      await verifyResult.mutateAsync(resId);

      const orderId = result.orderId?._id || result.orders?._id;
      const visitId = result.orderId?.visitId || result.orders?.visitId;

      // Check if all results for this order are now verified
      if (orderId && Array.isArray(pendingVerification)) {
        const remainingForOrder = pendingVerification.filter((r: any) => {
          const rOrderId = r.orderId?._id || r.orders?._id;
          const rId = r.id || r._id;
          return rOrderId === orderId && rId !== resId;
        });

        if (remainingForOrder.length === 0 && visitId) {
          const vid = typeof visitId === 'object' ? visitId?._id : visitId;
          if (vid) {
            try {
              await visitsAPI.resultsReleased(vid);
              toast.success('All order results verified! Lab report released to doctor.');
            } catch (e) {
              console.warn('Could not mark results released on visit:', e);
            }
          }
        }
      }

      toast.success(`${result.testName || result.testCode} verified`);
      queryClient.invalidateQueries({ queryKey: ['results'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to verify result');
    } finally {
      setVerifyingId(null);
    }
  };

  // Handle batch verify normal
  const handleVerifyAllNormal = async () => {
    const normalResults = (pendingVerification || []).filter((r: any) => !r.flag || r.flag === 'normal');
    if (normalResults.length === 0) {
      toast.info('No pending normal results to batch verify');
      return;
    }

    setIsBulkVerifying(true);
    let count = 0;
    try {
      for (const res of normalResults) {
        const id = res.id || res._id;
        if (id) {
          await verifyResult.mutateAsync(id);
          count++;
        }
      }
      toast.success(`Verified ${count} normal lab result(s)`);
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error during batch verification');
    } finally {
      setIsBulkVerifying(false);
    }
  };

  const openSendToAnalyzer = (order: any) => {
    const id = getOrderId(order);
    const num = getOrderNumber(order);
    const tests = getOrderTests(order).map((t: any) => t.testCode || t.code || '');
    setAnalyzerOrder({ id, number: num, tests });
    setAnalyzerDialogOpen(true);
  };

  return (
    <RoleLayout
      title="Laboratory Station"
      subtitle="High-density phlebotomy, analyzer routing, and result verification workbench"
      role="lab_tech"
      userName={profile?.fullName}
    >
      {/* ───────── STAT / PANIC ALERT BANNER ───────── */}
      {(criticalResults?.length > 0 || statCount > 0) && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
            </span>
            <div>
              <p className="text-sm font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Urgent Attention Required in Lab
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                {statCount > 0 && <span className="font-semibold">{statCount} STAT urgent order(s) pending </span>}
                {statCount > 0 && criticalResults?.length > 0 && ' • '}
                {criticalResults?.length > 0 && (
                  <span className="font-semibold text-red-800 dark:text-red-100">
                    {criticalResults.length} Panic / Critical Value(s) awaiting clinical dispatch!
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {criticalResults?.length > 0 && (
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-8 shadow-xs"
                onClick={() => setActiveTab('verification')}
              >
                Review Panic Values ({criticalResults.length})
              </Button>
            )}
            {statCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-red-300 text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                onClick={() => {
                  setPriorityFilter('stat');
                  setActiveTab('collection');
                }}
              >
                Filter STAT Orders
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ───────── HIGH-DENSITY LAB PULSE RIBBON ───────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mb-5">
        {/* STAT Urgents */}
        <div
          onClick={() => {
            setPriorityFilter(priorityFilter === 'stat' ? 'all' : 'stat');
          }}
          className={cn(
            'cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between hover:shadow-xs',
            statCount > 0
              ? 'border-red-300 bg-red-50/70 dark:bg-red-950/20 text-red-900 dark:text-red-200'
              : 'border bg-card text-foreground',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">STAT Orders</span>
            <AlertTriangle className={cn('w-4 h-4', statCount > 0 ? 'text-red-600' : 'text-muted-foreground')} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={cn('text-2xl font-bold', statCount > 0 ? 'text-red-600' : '')}>{statCount}</span>
            <span className="text-[10px] text-muted-foreground">priority 0</span>
          </div>
        </div>

        {/* Pending Draws */}
        <div
          onClick={() => setActiveTab('collection')}
          className={cn(
            'cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between hover:shadow-xs',
            activeTab === 'collection' ? 'border-primary bg-primary/5 shadow-xs' : 'border bg-card text-foreground',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Draws</span>
            <TestTube className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{pendingOrders?.length || 0}</span>
            <span className="text-[10px] text-muted-foreground">stage 1</span>
          </div>
        </div>

        {/* In Processing */}
        <div
          onClick={() => setActiveTab('processing')}
          className={cn(
            'cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between hover:shadow-xs',
            activeTab === 'processing' ? 'border-primary bg-primary/5 shadow-xs' : 'border bg-card text-foreground',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">In Processing</span>
            <FlaskConical className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{processingOrders?.length || 0}</span>
            <span className="text-[10px] text-muted-foreground">stage 2</span>
          </div>
        </div>

        {/* Awaiting Verification */}
        <div
          onClick={() => setActiveTab('verification')}
          className={cn(
            'cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between hover:shadow-xs',
            activeTab === 'verification' ? 'border-primary bg-primary/5 shadow-xs' : 'border bg-card text-foreground',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To Verify</span>
            <ClipboardCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{pendingVerification?.length || 0}</span>
            <span className="text-[10px] text-muted-foreground">stage 3</span>
          </div>
        </div>

        {/* Analyzers Online */}
        <div
          onClick={() => setActiveTab('analyzers')}
          className={cn(
            'cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between hover:shadow-xs',
            activeTab === 'analyzers' ? 'border-primary bg-primary/5 shadow-xs' : 'border bg-card text-foreground',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Analyzers</span>
            <Cpu className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">
              {onlineMachines}
              <span className="text-xs text-muted-foreground font-normal">/{machines?.length || 0}</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">ready</span>
          </div>
        </div>

        {/* Avg TAT */}
        <div className="rounded-xl border bg-card p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Avg TAT</span>
            <Timer className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{avgTurnaround ? `${avgTurnaround}m` : '—'}</span>
            <span className="text-[10px] text-muted-foreground">{completedToday} done</span>
          </div>
        </div>
      </div>

      {/* ───────── WORKBENCH WORKSPACE WITH TABS ───────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Header Toolbar: Search + Tab Switcher + Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card border rounded-xl p-3 shadow-xs">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patient, order #, or test name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            {searchTerm && (
              <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="h-9 px-2 text-xs">
                Clear
              </Button>
            )}
            <Select value={priorityFilter} onValueChange={(v: any) => setPriorityFilter(v)}>
              <SelectTrigger className="w-32 h-9 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="stat">STAT only</SelectItem>
                <SelectItem value="urgent">Urgent only</SelectItem>
                <SelectItem value="routine">Routine only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-2">
            <TabsList className="h-9 p-1 bg-muted/60">
              <TabsTrigger value="collection" className="text-xs gap-1.5 h-7">
                <TestTube className="w-3.5 h-3.5" />
                <span>Draws</span>
                {(pendingOrders?.length || 0) > 0 && (
                  <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] ml-0.5">
                    {pendingOrders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="processing" className="text-xs gap-1.5 h-7">
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Processing</span>
                {(processingOrders?.length || 0) > 0 && (
                  <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] ml-0.5">
                    {processingOrders.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="verification" className="text-xs gap-1.5 h-7">
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Verify</span>
                {(pendingVerification?.length || 0) > 0 && (
                  <Badge
                    variant={criticalResults?.length > 0 ? 'destructive' : 'secondary'}
                    className="h-4.5 px-1.5 text-[10px] ml-0.5"
                  >
                    {pendingVerification.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analyzers" className="text-xs gap-1.5 h-7">
                <Cpu className="w-3.5 h-3.5" />
                <span>Analyzers & QC</span>
              </TabsTrigger>
            </TabsList>

            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1"
              onClick={() => navigate('/lab/completed-orders')}
              title="View all completed and released lab orders"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Completed</span>
            </Button>
          </div>
        </div>

        {/* ───────── STAGE 1: PHLEBOTOMY & SAMPLE COLLECTION ───────── */}
        <TabsContent value="collection" className="mt-0 space-y-3">
          <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TestTube className="w-4 h-4 text-primary" />
                  Stage 1: Phlebotomy & Sample Draws
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paid laboratory requisitions awaiting sample collection and barcode tube labeling
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => refetchPending()}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', pendingLoading && 'animate-spin')} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => navigate('/lab/collect')}
                >
                  Dedicated Phlebotomy Desk <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {pendingLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading pending orders...</p>
              </div>
            ) : filteredCollectionOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
                <TestTube className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="font-medium">No pending sample collection orders</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {searchTerm
                    ? 'No orders match your filter criteria'
                    : 'Doctor lab orders appear here automatically once payment is confirmed at reception.'}
                </p>
              </div>
            ) : (
              <div className="divide-y max-h-[580px] overflow-y-auto">
                {filteredCollectionOrders.map((order: any) => {
                  const patientName = getPatientName(order);
                  const orderId = getOrderId(order);
                  const orderNum = getOrderNumber(order);
                  const tests = getOrderTests(order);
                  const panelSummary = getGroupedTestsByPanel(order);
                  const isStat = order.priority === 'stat';
                  const isUrgent = order.priority === 'urgent';

                  return (
                    <div
                      key={orderId}
                      className={cn(
                        'p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        isStat && 'bg-red-50/40 dark:bg-red-950/10 border-l-4 border-l-red-500',
                        isUrgent && 'border-l-4 border-l-amber-500',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{patientName}</span>
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            #{orderNum}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold h-5',
                              isStat
                                ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300'
                                : isUrgent
                                ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300',
                            )}
                          >
                            {getOrderPriority(order)}
                          </Badge>
                          {order.createdAt && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground font-medium">Tests:</span>
                          <span className="text-foreground font-medium truncate">{panelSummary || `${tests.length} tests`}</span>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {tests.slice(0, 4).map((t: any, idx: number) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                            >
                              {t.testCode || t.name}
                            </span>
                          ))}
                          {tests.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{tests.length - 4} more</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5 font-medium shadow-xs"
                          onClick={() => openCollectDialog(order)}
                        >
                          <TestTube className="w-3.5 h-3.5" />
                          Draw Sample
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ───────── STAGE 2: ANALYZER & MANUAL PROCESSING ───────── */}
        <TabsContent value="processing" className="mt-0 space-y-3">
          <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-600" />
                  Stage 2: Analyzer & Testing Processing Queue
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Collected specimens currently on automated analyzers or undergoing manual bench diagnostics
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => refetchProcessing()}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', processingLoading && 'animate-spin')} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => navigate('/lab/processing')}
                >
                  Full Results Entry Station <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {processingLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
                <p className="text-xs text-muted-foreground">Loading active bench orders...</p>
              </div>
            ) : filteredProcessingOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
                <FlaskConical className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="font-medium">No samples currently undergoing processing</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Draw samples from Stage 1 to send them to the analyzer or enter manual bench results.
                </p>
              </div>
            ) : (
              <div className="divide-y max-h-[580px] overflow-y-auto">
                {filteredProcessingOrders.map((order: any) => {
                  const patientName = getPatientName(order);
                  const orderId = getOrderId(order);
                  const orderNum = getOrderNumber(order);
                  const tests = getOrderTests(order);
                  const panelSummary = getGroupedTestsByPanel(order);
                  const isStat = order.priority === 'stat';

                  return (
                    <div
                      key={orderId}
                      className={cn(
                        'p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                        isStat && 'bg-red-50/40 dark:bg-red-950/10 border-l-4 border-l-red-500',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{patientName}</span>
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            #{orderNum}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold h-5',
                              isStat
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-amber-100 text-amber-700 border-amber-300',
                            )}
                          >
                            {order.priority?.toUpperCase() || 'ROUTINE'}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-200">
                            IN TESTING
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {panelSummary || `${tests.length} tests`}
                        </p>

                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {tests.map((t: any, idx: number) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300"
                            >
                              {t.testCode || t.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => openSendToAnalyzer(order)}
                          title="Dispatch electronic worklist order to connected analyzer"
                        >
                          <Send className="w-3.5 h-3.5 text-primary" />
                          Send to Machine
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 font-medium bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => navigate(`/lab/processing?order=${orderId}`)}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Enter Results
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ───────── STAGE 3: RESULT VERIFICATION & RELEASE ───────── */}
        <TabsContent value="verification" className="mt-0 space-y-3">
          <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-purple-600" />
                  Stage 3: Result Verification & Clinical Release
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Supervisor verification workstation. Flagged panic results must be reviewed before releasing to doctors.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  disabled={isBulkVerifying || filteredVerificationResults.length === 0}
                  onClick={handleVerifyAllNormal}
                  title="Bulk verify all within-range normal lab parameters"
                >
                  {isBulkVerifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  Verify All Normal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => navigate('/lab/verify-results')}
                >
                  Full Verification Desk <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {filteredVerificationResults.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
                <CheckCircle className="w-10 h-10 mx-auto text-emerald-500/60" />
                <p className="font-medium text-foreground">All lab results are verified and released</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No unverified results pending. Results are immediately accessible by treating doctors in their consultation workspace.
                </p>
              </div>
            ) : (
              <div className="divide-y max-h-[580px] overflow-y-auto">
                {filteredVerificationResults.map((result: any) => {
                  const resId = result.id || result._id;
                  const isCritical = result.flag === 'critical_high' || result.flag === 'critical_low';
                  const isAbnormal = result.flag === 'high' || result.flag === 'low';
                  const patientName =
                    result.orders?.patientId?.fullName ||
                    result.patientName ||
                    (result.patient ? `${result.patient.firstName || ''} ${result.patient.lastName || ''}`.trim() : 'Patient');

                  return (
                    <div
                      key={resId}
                      className={cn(
                        'p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3',
                        isCritical && 'bg-red-50/60 dark:bg-red-950/20 border-l-4 border-l-red-600',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{result.testName || result.testCode}</span>
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {result.testCode}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            • {patientName}
                          </span>
                          {isCritical && (
                            <Badge variant="destructive" className="text-[10px] h-5 gap-1 font-bold animate-pulse">
                              <AlertCircle className="w-3 h-3" />
                              CRITICAL / PANIC
                            </Badge>
                          )}
                          {isAbnormal && !isCritical && (
                            <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50">
                              {result.flag?.toUpperCase()}
                            </Badge>
                          )}
                          {!result.flag || result.flag === 'normal' ? (
                            <Badge variant="outline" className="text-[10px] h-5 border-emerald-300 text-emerald-700 bg-emerald-50">
                              NORMAL
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Reported Value: </span>
                            <span
                              className={cn(
                                'font-bold font-mono text-sm px-2 py-0.5 rounded',
                                isCritical
                                  ? 'bg-red-200 text-red-950 dark:bg-red-900 dark:text-red-100'
                                  : isAbnormal
                                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                                  : 'bg-muted text-foreground',
                              )}
                            >
                              {result.value} {result.unit || ''}
                            </span>
                          </div>
                          {result.referenceRange && (
                            <div className="text-muted-foreground">
                              <span>Ref: </span>
                              <span className="font-mono text-foreground">{result.referenceRange}</span>
                            </div>
                          )}
                          {result.createdAt && (
                            <div className="text-muted-foreground">
                              Entered {new Date(result.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <Button
                          size="sm"
                          variant={isCritical ? 'destructive' : 'default'}
                          className="h-8 text-xs gap-1 font-medium shadow-xs"
                          disabled={verifyingId === resId}
                          onClick={() => handleVerifySingle(result)}
                        >
                          {verifyingId === resId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Verify & Release
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ───────── STAGE 4: ANALYZERS & QC HUB ───────── */}
        <TabsContent value="analyzers" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Connected Analyzer Status */}
            <div className="bg-card border rounded-xl shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    LIS Automated Analyzers
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bidirectional ASTM / HL7 machine connections
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {onlineMachines} of {machines?.length || 0} Online
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {machines?.map(machine => (
                  <MachineStatusCard key={machine.id} machine={machine as any} />
                ))}
                {(!machines || machines.length === 0) && (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    No automated analyzers configured in LIS
                  </p>
                )}
              </div>
            </div>

            {/* Live Connection Monitor */}
            <LiveConnectionMonitor />
          </div>

          {/* QC Alerts Row */}
          <div className="bg-card border rounded-xl shadow-xs">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Beaker className="w-4 h-4 text-amber-500" />
                  Quality Control (QC) Status & Alerts
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Levey-Jennings monitor and control violations
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => navigate('/lab/qc')}
              >
                QC Data Entry <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="divide-y max-h-64 overflow-y-auto">
              {Array.isArray(qcResults) && qcResults.length > 0 ? (
                qcResults.map((qc: any) => (
                  <div key={qc._id || qc.id} className="px-5 py-3 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{qc.testName || qc.testCode}</p>
                      <p className="text-xs text-muted-foreground">
                        Lot: {qc.lotNumber || 'N/A'} • Expected: {qc.expectedValue} • Measured: {qc.actualValue}
                      </p>
                      <p className="text-xs text-red-600 mt-0.5">
                        Violation recorded {new Date(qc.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                  <CheckCircle className="w-8 h-8 text-emerald-500/60 mx-auto mb-1.5" />
                  No QC failures. All control runs are within Westgard tolerance.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ───────── INLINE PHLEBOTOMY DRAW MODAL ───────── */}
      <Dialog open={collectModalOpen} onOpenChange={setCollectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5 text-primary" />
              Phlebotomy Sample Collection
            </DialogTitle>
            <DialogDescription>
              Record sample draw, generate barcode tube label, and transition order into processing.
            </DialogDescription>
          </DialogHeader>

          {orderToCollect && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-semibold text-foreground">{getPatientName(orderToCollect)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order #:</span>
                  <span className="font-mono text-foreground">#{getOrderNumber(orderToCollect)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority:</span>
                  <Badge variant="outline" className="text-[10px] h-4.5">
                    {getOrderPriority(orderToCollect)}
                  </Badge>
                </div>
                <div className="pt-1 border-t flex justify-between">
                  <span className="text-muted-foreground">Tests:</span>
                  <span className="font-medium text-foreground truncate max-w-[200px]">
                    {getGroupedTestsByPanel(orderToCollect)}
                  </span>
                </div>
              </div>

              {!collectedResult ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Specimen Tube / Container Type
                    </label>
                    <Select value={sampleType} onValueChange={setSampleType}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Select tube type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blood_edta">🟣 Whole Blood — EDTA (Lavender Top)</SelectItem>
                        <SelectItem value="blood_plain">🔴 Serum — Plain / Clot Activator (Red Top)</SelectItem>
                        <SelectItem value="blood_citrate">🔵 Coagulation — Sodium Citrate (Light Blue Top)</SelectItem>
                        <SelectItem value="blood_heparin">🟢 Plasma — Lithium Heparin (Green Top)</SelectItem>
                        <SelectItem value="blood_fluoride">⚪ Glucose — Sodium Fluoride (Grey Top)</SelectItem>
                        <SelectItem value="urine_sterile">🟡 Urine — Sterile Universal Container</SelectItem>
                        <SelectItem value="stool_container">🟤 Stool — Specimen Container</SelectItem>
                        <SelectItem value="swab_sterile">🔘 Swab — Sterile Transport Medium</SelectItem>
                        <SelectItem value="sputum_sterile">⚪ Sputum — Wide-Mouth Sterile Cup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Phlebotomy Notes (Optional)
                    </label>
                    <Input
                      placeholder="e.g. Fasting confirmed, left antecubital fossa..."
                      value={sampleNotes}
                      onChange={(e) => setSampleNotes(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                  <div>
                    <p className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                      Specimen Draw Confirmed
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sample barcode label ready for tube application
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border rounded-lg p-3 font-mono text-center shadow-inner">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">LIS Specimen ID</p>
                    <p className="text-xl font-extrabold text-foreground tracking-widest">
                      {collectedResult.barcode}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!collectedResult ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setCollectModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 font-medium"
                  disabled={createSample.isPending || collectOrder.isPending}
                  onClick={handleConfirmCollection}
                >
                  {createSample.isPending || collectOrder.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Confirm Draw & Generate Barcode
                </Button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => {
                    toast.success(`Printing barcode label for ${collectedResult.barcode}`);
                  }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Tube Label
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setCollectModalOpen(false);
                    setCollectedResult(null);
                    setOrderToCollect(null);
                  }}
                >
                  Done
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── SEND TO ANALYZER DIALOG ───────── */}
      {analyzerOrder && (
        <SendToAnalyzerDialog
          open={analyzerDialogOpen}
          onOpenChange={setAnalyzerDialogOpen}
          orderId={analyzerOrder.id}
          orderNumber={analyzerOrder.number}
          testCodes={analyzerOrder.tests}
        />
      )}
    </RoleLayout>
  );
}
