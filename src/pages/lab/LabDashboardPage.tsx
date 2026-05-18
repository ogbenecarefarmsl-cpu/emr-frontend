import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePendingCollectionOrders, useProcessingOrders, useTodayOrders } from '@/hooks/useOrders';
import { useCriticalResults, usePendingVerificationResults } from '@/hooks/useResults';
import { useMachines } from '@/hooks/useMachines';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { useRealtimeResults } from '@/hooks/useRealtimeResults';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MachineStatusCard } from '@/components/dashboard/MachineStatusCard';
import { LiveConnectionMonitor } from '@/components/machines/LiveConnectionMonitor';
import { LabQueue } from '@/components/lab/LabQueue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getPatientName, getGroupedTestsByPanel, getOrderId, getOrderPriority } from '@/utils/orderHelpers';
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export default function LabDashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useRealtimeOrders();
  useRealtimeResults();
  useRealtimePatients();

  const { data: pendingOrders, isLoading: pendingLoading } = usePendingCollectionOrders();
  const { data: processingOrders, isLoading: processingLoading } = useProcessingOrders();
  const { data: todayOrders } = useTodayOrders();
  const { data: criticalResults } = useCriticalResults();
  const { data: pendingVerification } = usePendingVerificationResults();
  const { data: machines } = useMachines();

  const { data: qcResults = [] } = useQuery({
    queryKey: ['qc', 'recent-failures'],
    queryFn: async () => {
      const res = await api.get('/qc-results?status=fail&limit=5');
      return res.data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const completedToday = Array.isArray(todayOrders) ? todayOrders.filter(o => o.status === 'completed').length : 0;
  const onlineMachines = Array.isArray(machines) ? machines.filter(m => m.status === 'online' || m.status === 'processing').length : 0;

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

  const isLoading = pendingLoading || processingLoading;
  const [searchTerm, setSearchTerm] = useState('');

  const worklistByPriority = useMemo(() => {
    const all = [...(pendingOrders || []), ...(processingOrders || [])];
    const seen = new Set<string>();
    const unique = all.filter(o => {
      const id = getOrderId(o);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const stat = unique.filter(o => o.priority === 'stat');
    const urgent = unique.filter(o => o.priority === 'urgent');
    const routine = unique.filter(o => !o.priority || o.priority === 'routine');
    return { stat, urgent, routine };
  }, [pendingOrders, processingOrders]);

  const filteredOrders = searchTerm
    ? (pendingOrders || []).filter((o: any) =>
        getPatientName(o)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : (pendingOrders || []);

  return (
    <RoleLayout 
      title="Lab Dashboard" 
      subtitle="Paid lab orders, sample collection, results and analyzers"
      role="lab_tech"
      userName={profile?.fullName}
    >
      {/* Patient Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter paid/pending orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button 
          onClick={() => navigate('/lab/collect')}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary hover:border-primary transition-all duration-200 relative"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <TestTube className="w-6 h-6 text-primary group-hover:text-white transition-colors" />
          </div>
          <span className="text-sm font-semibold text-primary group-hover:text-white transition-colors">Collect Samples</span>
          {(pendingOrders?.length || 0) > 0 && (
            <Badge className="absolute top-2 right-2 h-5 min-w-5 text-[10px] justify-center">{pendingOrders?.length}</Badge>
          )}
        </button>
        <button 
          onClick={() => navigate('/lab/processing')}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border bg-card hover:bg-secondary hover:shadow-md transition-all duration-200 relative"
        >
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <FlaskConical className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold text-foreground">Enter Results</span>
          {(processingOrders?.length || 0) > 0 && (
            <Badge variant="secondary" className="absolute top-2 right-2 h-5 min-w-5 text-[10px] justify-center">{processingOrders?.length}</Badge>
          )}
        </button>
        <button 
          onClick={() => navigate('/lab/verify-results')}
          className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border bg-card hover:bg-secondary hover:shadow-md transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <FileText className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-semibold text-foreground">Verify Results</span>
        </button>
            <button
              onClick={() => navigate('/lab/completed-orders')}
              className="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border bg-card hover:bg-secondary hover:shadow-md transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <CheckCircle className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-semibold text-foreground">Verify / Print</span>
            </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard
          title="Pending Collection"
          value={pendingOrders?.length || 0}
          icon={TestTube}
          variant={(pendingOrders?.length || 0) > 5 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Processing"
          value={processingOrders?.length || 0}
          icon={FlaskConical}
        />
        <MetricCard
          title="Completed Today"
          value={completedToday}
          icon={CheckCircle}
        />
        <MetricCard
          title="Critical Results"
          value={criticalResults?.length || 0}
          icon={AlertTriangle}
          variant={(criticalResults?.length || 0) > 0 ? 'critical' : 'default'}
        />
        <MetricCard
          title="Avg TAT"
          value={avgTurnaround ? `${avgTurnaround}m` : '—'}
          icon={Timer}
          variant={avgTurnaround && avgTurnaround > 60 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Machines Online"
          value={`${onlineMachines}/${machines?.length || 0}`}
          icon={Cpu}
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Lab Queue - Paid orders from doctors ready for processing */}
      <div className="mb-6">
        <LabQueue onStartTest={(order) => navigate(`/lab/processing?order=${order._id || order.id}`)} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pending Samples Queue */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Pending Sample Collection</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/lab/collect')}>
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {Array.isArray(filteredOrders) && filteredOrders.slice(0, 5).map(order => {
                const patientName = getPatientName(order);
                
                return (
                  <div key={getOrderId(order)} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{patientName}</p>
                          <Badge variant="outline" className={cn(
                            'text-[10px] h-5 flex-shrink-0',
                            order.priority === 'stat' ? 'bg-status-critical/10 text-status-critical border-status-critical/30' :
                            order.priority === 'urgent' ? 'bg-status-warning/10 text-status-warning border-status-warning/30' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {getOrderPriority(order)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{getGroupedTestsByPanel(order)}</p>
                      </div>
                      <Button size="sm" className="text-xs flex-shrink-0 h-8" onClick={() => navigate(`/lab/collect?order=${getOrderId(order)}`)}>
                        Collect
                      </Button>
                    </div>
                  </div>
                );
              })}
              {(!filteredOrders || !Array.isArray(filteredOrders) || filteredOrders.length === 0) && (
                <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                  {searchTerm ? 'No matching sample orders' : 'Paid doctor orders appear here after reception payment'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Processing Queue */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Awaiting Results</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/lab/processing')}>
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {Array.isArray(processingOrders) && processingOrders.slice(0, 5).map(order => (
                <div key={getOrderId(order)} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{getPatientName(order)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{getGroupedTestsByPanel(order)}</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs flex-shrink-0 h-8" onClick={() => navigate(`/lab/processing?order=${getOrderId(order)}`)}>
                      Enter Results
                    </Button>
                  </div>
                </div>
              ))}
              {(!processingOrders || !Array.isArray(processingOrders) || processingOrders.length === 0) && (
                <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                  No samples currently processing
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Machine Status */}
        <div className="bg-card border rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-sm mb-4">Analyzer Status</h3>
          <div className="grid grid-cols-1 gap-3">
            {machines?.slice(0, 3).map(machine => (
              <MachineStatusCard key={machine.id} machine={machine as any} />
            ))}
            {(!machines || machines.length === 0) && (
              <p className="text-muted-foreground text-sm text-center py-6">No analyzers configured</p>
            )}
          </div>
        </div>

        {/* Live Connection Monitor */}
        <LiveConnectionMonitor />
      </div>

      {/* QC Alerts + Worklist by Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* QC Alerts */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Beaker className="w-4 h-4 text-amber-500" />
              QC Alerts
            </h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/lab/qc')}>
              QC Entry <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {Array.isArray(qcResults) && qcResults.length > 0 ? qcResults.map((qc: any) => (
              <div key={qc._id || qc.id} className="px-5 py-3 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{qc.testName || qc.testCode}</p>
                  <p className="text-xs text-muted-foreground">
                    Lot: {qc.lotNumber || 'N/A'} · Expected: {qc.expectedValue} · Got: {qc.actualValue}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Failed {new Date(qc.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )) : (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No QC failures — all controls within range
              </div>
            )}
            {pendingVerification && Array.isArray(pendingVerification) && pendingVerification.length > 0 && (
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-3">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {pendingVerification.length} result(s) awaiting verification
                  </p>
                  <Button variant="link" size="sm" className="text-xs p-0 h-auto text-amber-700" onClick={() => navigate('/lab/verify-results')}>
                    Review now →
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Worklist by Priority */}
        <div className="bg-card border rounded-xl shadow-sm">
          <div className="px-5 py-4 border-b">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              Worklist by Priority
            </h3>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {worklistByPriority.stat.length > 0 && (
              <div className="px-5 py-3 bg-red-50 dark:bg-red-950/20">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2">
                  STAT ({worklistByPriority.stat.length})
                </p>
                {worklistByPriority.stat.slice(0, 3).map(order => (
                  <div key={getOrderId(order)} className="flex items-center justify-between py-1">
                    <p className="text-sm truncate">{getPatientName(order)}</p>
                    <Button size="sm" className="text-xs h-7 flex-shrink-0 ml-2" onClick={() => navigate(`/lab/processing?order=${getOrderId(order)}`)}>
                      Process
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {worklistByPriority.urgent.length > 0 && (
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/20">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                  Urgent ({worklistByPriority.urgent.length})
                </p>
                {worklistByPriority.urgent.slice(0, 3).map(order => (
                  <div key={getOrderId(order)} className="flex items-center justify-between py-1">
                    <p className="text-sm truncate">{getPatientName(order)}</p>
                    <Button variant="outline" size="sm" className="text-xs h-7 flex-shrink-0 ml-2" onClick={() => navigate(`/lab/processing?order=${getOrderId(order)}`)}>
                      Process
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {worklistByPriority.routine.length > 0 && (
              <div className="px-5 py-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Routine ({worklistByPriority.routine.length})
                </p>
                {worklistByPriority.routine.slice(0, 3).map(order => (
                  <div key={getOrderId(order)} className="flex items-center justify-between py-1">
                    <p className="text-sm truncate">{getPatientName(order)}</p>
                    <Button variant="ghost" size="sm" className="text-xs h-7 flex-shrink-0 ml-2" onClick={() => navigate(`/lab/processing?order=${getOrderId(order)}`)}>
                      Process
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {worklistByPriority.stat.length === 0 && worklistByPriority.urgent.length === 0 && worklistByPriority.routine.length === 0 && (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No orders in worklist
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}

