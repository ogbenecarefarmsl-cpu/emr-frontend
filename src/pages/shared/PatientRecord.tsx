import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { patientService } from '@/services/patientService';
import { soapNoteService } from '@/services/soapNoteService';
import { ordersAPI } from '@/services/api';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { InsuranceStatusBadge } from '@/components/insurance/InsuranceStatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Loader2, ArrowLeft, User, Activity, Stethoscope, Pill, FileText, FlaskConical,
  Clock, AlertTriangle, ChevronDown, Calendar, Droplets, ExternalLink, RefreshCw,
  Phone, Hash, TrendingUp, ClipboardList
} from 'lucide-react';
import { PatientTreatmentPlans } from './PatientTreatmentPlans';
import { toast } from 'sonner';

const FBC_TEST_ORDER = [
  'WBC', 'NEUTA', 'LYMPHA', 'MONOA', 'EOSA', 'BASOA',
  'RBC', 'HB', 'HCT', 'MCV', 'MCH', 'MCHC', 'RDWCV', 'RDWSD',
  'PLT', 'MPV', 'PDW', 'PLTCT', 'PLCC', 'PLCR',
];

function getFbcOrderIndex(testCode: string | undefined) {
  const index = FBC_TEST_ORDER.indexOf((testCode || '').toUpperCase());
  return index === -1 ? 999 : index;
}

const PatientRecord = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { primaryRole, profile } = useAuth();
  const layoutRole = primaryRole || 'doctor';
  const queryClient = useQueryClient();
  const [addendumTarget, setAddendumTarget] = useState<string | null>(null);
  const [addendumText, setAddendumText] = useState('');

  const createAddendum = useMutation({
    mutationFn: ({ noteId, text }: { noteId: string; text: string }) => soapNoteService.createAddendum(noteId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-chart', patientId] });
      setAddendumTarget(null);
      setAddendumText('');
      toast.success('Signed addendum recorded');
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Failed to record addendum'),
  });

  const { data: chart, isLoading: chartLoading } = useQuery({
    queryKey: ['patient-chart', patientId],
    queryFn: () => patientService.getChart(patientId!),
    enabled: !!patientId,
  });

  const fetchLisResults = useMutation({
    mutationFn: (orderId: string) => ordersAPI.fetchLisResults(orderId),
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported || 0} LIS result${data.imported === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: ['patient-chart', patientId] });
    },
    onError: () => toast.error('Could not fetch LIS results'),
  });

  const syncLisPayment = useMutation({
    mutationFn: (orderId: string) => ordersAPI.syncLisPayment(orderId),
    onSuccess: (data) => {
      toast.success('Payment synced to LIS');
      queryClient.invalidateQueries({ queryKey: ['patient-chart', patientId] });
    },
    onError: () => toast.error('Could not sync payment to LIS'),
  });

  const syncToLis = useMutation({
    mutationFn: (orderId: string) => ordersAPI.syncToLis(orderId),
    onSuccess: () => {
      toast.success('Order synced to LIS');
      queryClient.invalidateQueries({ queryKey: ['patient-chart', patientId] });
    },
    onError: () => toast.error('Could not sync order to LIS'),
  });

  if (chartLoading) {
    return (
      <RoleLayout title="Patient Record" subtitle="Loading clinical history..." role={layoutRole} userName={profile?.fullName}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </RoleLayout>
    );
  }

  if (!chart?.patient) {
    return (
      <RoleLayout title="Patient Record" subtitle="" role={layoutRole} userName={profile?.fullName}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Patient not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />Go Back
          </Button>
        </div>
      </RoleLayout>
    );
  }

  const patient = chart.patient;
  const consultations = chart.consultations || [];
  const prescriptions = chart.prescriptions || [];
  const soapNotes = chart.soapNotes || [];
  const orders = chart.orders || [];
  const vitalsHistory = chart.vitalsHistory || [];
  const summary = chart.summary || {};

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case 'critical_high':
      case 'critical_low':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
      case 'low':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      default:
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }
  };

  const getFlagLabel = (flag: string) => {
    switch (flag) {
      case 'critical_high': return 'CRITICAL HIGH';
      case 'critical_low': return 'CRITICAL LOW';
      case 'high': return 'HIGH';
      case 'low': return 'LOW';
      default: return null;
    }
  };

  const getAllFlaggedResults = () => {
    const flagged: any[] = [];
    orders.forEach((order: any) => {
      if (!order.results) return;
      order.results.forEach((result: any) => {
        if (result.flag && result.flag !== 'normal') {
          flagged.push({ ...result, orderNumber: order.orderNumber, orderId: order._id });
        }
      });
    });
    flagged.sort((a: any, b: any) => {
      const priority: Record<string, number> = { critical_high: 0, critical_low: 0, high: 1, low: 1 };
      return (priority[a.flag] ?? 2) - (priority[b.flag] ?? 2);
    });
    return flagged;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      completed: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Completed' },
      pending_collection: { className: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Pending' },
      processing: { className: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Processing' },
      cancelled: { className: 'bg-red-50 text-red-700 border-red-200', label: 'Cancelled' },
      awaiting_payment: { className: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Unpaid' },
      paid: { className: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Paid' },
    };
    const config = statusMap[status] || { className: 'bg-gray-50 text-gray-700 border-gray-200', label: status };
    return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
  };

  const groupResultsByPanel = (order: any) => {
    const panels: Record<string, { name: string; tests: any[] }> = {};
    const standalone: any[] = [];
    const orderedTests = [...(order.orderTests || [])].sort((a: any, b: any) => {
      if (a.panelCode === 'FBC' && b.panelCode === 'FBC') return getFbcOrderIndex(a.testCode) - getFbcOrderIndex(b.testCode);
      return 0;
    });
    orderedTests.forEach((test: any) => {
      const result = order.results?.find((r: any) =>
        r.orderTestId?.toString() === test._id?.toString() ||
        (r.testCode || '').toUpperCase() === (test.testCode || '').toUpperCase()
      );
      const testWithResult = { ...test, result };
      if (test.panelCode) {
        if (!panels[test.panelCode]) panels[test.panelCode] = { name: test.panelName || test.panelCode, tests: [] };
        panels[test.panelCode].tests.push(testWithResult);
      } else {
        standalone.push(testWithResult);
      }
    });
    return { panels, standalone };
  };

  const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const getInitials = (first?: string, last?: string) => `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '?';
  const initials = getInitials(patient.firstName, patient.lastName);

  return (
    <RoleLayout title="Patient Record" subtitle="Longitudinal clinical history" role={layoutRole} userName={profile?.fullName}>
      <div className="space-y-6">
        {/* Patient Header */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-primary">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold tracking-tight">{patient.firstName} {patient.lastName}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{patient.patientId}</span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}
                  </span>
                  <span>{patient.age} {patient.ageUnit || 'years'}</span>
                  {patient.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{patient.phone}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {patient.bloodType && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-red-50 text-red-700 border-red-200">
                      <Droplets className="w-3 h-3" />{patient.bloodType}
                    </Badge>
                  )}
                  {patient.allergies?.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <AlertTriangle className="w-3 h-3" />{patient.allergies.join(', ')}
                    </Badge>
                  )}
                  {patient.chronicConditions?.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{patient.chronicConditions.join(', ')}</Badge>
                  )}
                  <InsuranceStatusBadge insurance={patient.insurance} compact className="text-[10px]" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-t">
            {[
              { label: 'Consultations', value: summary.totalConsultations || 0, icon: Stethoscope, color: 'text-blue-600' },
              { label: 'Prescriptions', value: summary.totalPrescriptions || 0, icon: Pill, color: 'text-emerald-600' },
              { label: 'Test Orders', value: summary.totalLabOrders || 0, icon: FlaskConical, color: 'text-purple-600' },
              { label: 'Last Visit', value: summary.lastVisit ? formatDate(summary.lastVisit) : 'N/A', icon: Calendar, color: 'text-amber-600' },
            ].map((stat, i) => (
              <div key={stat.label} className={`px-5 py-4 ${i < 3 ? 'border-r' : ''}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold mt-0.5">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-5 h-5 ${stat.color} opacity-60`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="bg-transparent h-auto p-0 min-w-max border-b">
            <TabsTrigger value="timeline" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="lab-results" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
              Test Results <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">{orders.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
              Prescriptions <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">{prescriptions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="soap-notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
              SOAP Notes <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">{soapNotes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vitals" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
              Vitals
            </TabsTrigger>
            <TabsTrigger value="treatment-plans" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
              Treatment Plans
            </TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-3">
            {soapNotes.length === 0 && consultations.length === 0 && orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">No clinical history yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Encounters will appear here as they are recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {soapNotes.map((note: any) => (
                  <div key={note._id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Stethoscope className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="w-0.5 flex-1 bg-border mt-1" />
                    </div>
                    <Card className="flex-1">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-sm">Consultation</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {note.doctorId?.fullName ? `Dr. ${note.doctorId.fullName}` : 'Clinical staff'} &bull; {formatDate(note.createdAt)} {formatTime(note.createdAt)}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {note.chiefComplaint && (
                          <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                            <span className="font-semibold text-blue-700 text-xs uppercase">Complaint:</span> {note.chiefComplaint}
                          </div>
                        )}
                        {note.diagnosis && (
                          <div className="p-2.5 bg-orange-50 rounded-lg border border-orange-200">
                            <span className="font-semibold text-orange-700 text-xs uppercase">Diagnosis:</span> {note.diagnosis}
                          </div>
                        )}
                        {note.treatmentPlan && (
                          <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                            <span className="font-semibold text-purple-700 text-xs uppercase">Plan:</span> {note.treatmentPlan}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {orders.map((order: any) => (
                  <div key={order._id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <FlaskConical className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="w-0.5 flex-1 bg-border mt-1" />
                    </div>
                    <Card className="flex-1">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-sm">{order.orderNumber}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(order.createdAt)} {formatTime(order.createdAt)} &bull; Dr. {order.doctorId?.fullName || 'N/A'}
                            </p>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1">
                          {order.orderTests?.slice(0, 6).map((test: any, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] font-normal">{test.testName || test.testCode}</Badge>
                          ))}
                          {order.orderTests?.length > 6 && (
                            <Badge variant="secondary" className="text-[10px]">+{order.orderTests.length - 6} more</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Lab Results Tab */}
          <TabsContent value="lab-results" className="space-y-4">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FlaskConical className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">No test orders yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Test results will appear here once ordered</p>
              </div>
            ) : (() => {
              const flaggedResults = getAllFlaggedResults();
              return (
                <>
                  {flaggedResults.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                          <AlertTriangle className="w-4 h-4" />
                          Abnormal Results ({flaggedResults.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {flaggedResults.map((r: any, idx: number) => (
                            <div key={idx} className={`flex items-center justify-between p-2.5 rounded-lg border ${getFlagColor(r.flag)}`}>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{r.testName}</p>
                                <p className="text-xs opacity-70">{r.panelName || r.panelCode || r.orderNumber}</p>
                              </div>
                              <div className="text-right ml-3 shrink-0">
                                <p className="text-sm font-bold">{r.value} {r.unit}</p>
                                <p className="text-[10px] opacity-70">{getFlagLabel(r.flag)} &bull; Ref: {r.referenceRange}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {orders.map((order: any) => {
                    const { panels, standalone } = groupResultsByPanel(order);
                    const hasResults = order.results?.length > 0;
                    const resultCount = order.results?.length || 0;

                    return (
                      <Card key={order._id}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(order.createdAt)} &bull; Dr. {order.doctorId?.fullName || 'N/A'}
                                {resultCount > 0 && <span className="ml-2 text-emerald-600 font-medium">{resultCount} results</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(order.status)}
                              {order.lisSyncStatus === 'synced' && order.lisPaymentSyncStatus !== 'synced' && order.paymentStatus === 'paid' && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                  Payment not synced to LIS
                                </Badge>
                              )}
                              {order.lisSyncStatus === 'synced' && order.lisPaymentSyncStatus === 'synced' && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                  LIS synced
                                </Badge>
                              )}
                              {order.lisSyncStatus === 'failed' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-red-300 text-red-700"
                                  onClick={() => syncToLis.mutate(order._id)}
                                  disabled={syncToLis.isPending}
                                  title={order.lisSyncError || 'Retry LIS sync'}
                                >
                                  {syncToLis.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                  Retry LIS
                                </Button>
                              )}
                              {order.lisPaymentSyncStatus === 'failed' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-amber-300 text-amber-700"
                                  onClick={() => syncLisPayment.mutate(order._id)}
                                  disabled={syncLisPayment.isPending}
                                  title={order.lisPaymentSyncError || 'Retry payment sync'}
                                >
                                  {syncLisPayment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                  Retry Payment
                                </Button>
                              )}
                              {order.lisSyncStatus === 'synced' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                                  onClick={() => fetchLisResults.mutate(order._id)}
                                  disabled={fetchLisResults.isPending}
                                  title={order.lisResultsFetchedAt ? `Last fetched ${formatDate(order.lisResultsFetchedAt)}` : 'Fetch LIS results'}
                                >
                                  <RefreshCw className={`w-3 h-3 ${fetchLisResults.isPending ? 'animate-spin' : ''}`} />Sync
                                </Button>
                              )}
                              {order.status === 'completed' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                                  onClick={() => {
                                    const reportPath = primaryRole === 'receptionist'
                                      ? `/reception/reports/${order._id}`
                                      : primaryRole === 'nurse'
                                        ? `/nurse/reports/${order._id}`
                                        : `/lab/reports/${order._id}`;
                                    navigate(reportPath);
                                  }}
                                >
                                  <ExternalLink className="w-3 h-3" />Report
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {Object.entries(panels).map(([code, panel]: [string, any]) => {
                            const flaggedCount = panel.tests.filter((t: any) => t.result?.flag && t.result.flag !== 'normal').length;
                            return (
                              <Collapsible key={code} defaultOpen={flaggedCount > 0}>
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                                    <ChevronDown className="w-4 h-4 text-muted-foreground collapsible-icon" />
                                    <span className="font-medium text-sm">{panel.name}</span>
                                    <Badge variant="outline" className="ml-auto text-[10px]">{panel.tests.length} tests</Badge>
                                    {flaggedCount > 0 && (
                                      <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">{flaggedCount} abnormal</Badge>
                                    )}
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-2 space-y-1 pl-6">
                                  {panel.tests.map((test: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{test.testName}</p>
                                        <p className="text-xs text-muted-foreground">{test.testCode}</p>
                                      </div>
                                      {test.result ? (
                                        <div className="text-right">
                                          <p className={`text-sm font-semibold px-2 py-0.5 rounded border ${getFlagColor(test.result.flag)}`}>
                                            {test.result.value} {test.result.unit}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-0.5">{test.result.referenceRange}</p>
                                        </div>
                                      ) : (
                                        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                                      )}
                                    </div>
                                  ))}
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}

                          {standalone.length > 0 && (
                            <div className="space-y-1">
                              {standalone.map((test: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{test.testName}</p>
                                    <p className="text-xs text-muted-foreground">{test.testCode}</p>
                                  </div>
                                  {test.result ? (
                                    <div className="text-right">
                                      <p className={`text-sm font-semibold px-2 py-0.5 rounded border ${getFlagColor(test.result.flag)}`}>
                                        {test.result.value} {test.result.unit}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{test.result.referenceRange}</p>
                                    </div>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {!hasResults && order.orderTests?.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No tests recorded for this order</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              );
            })()}
          </TabsContent>

          {/* Prescriptions Tab */}
          <TabsContent value="prescriptions" className="space-y-3">
            {prescriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Pill className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">No prescriptions yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Prescriptions will appear here</p>
              </div>
            ) : (
              prescriptions.map((p: any) => (
                <Card key={p._id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{p.prescriptionNumber}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Dr. {p.prescribedBy?.fullName || p.doctorId?.fullName || 'N/A'} &bull; {formatDate(p.createdAt)}
                        </p>
                      </div>
                      <Badge variant={p.isPaid ? 'default' : 'destructive'} className="text-[10px]">
                        {p.isPaid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {p.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                          <Pill className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.medicationName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.dosage} &bull; {item.frequency} &bull; {item.duration}
                            </p>
                            {item.route && (
                              <p className="text-xs text-muted-foreground">Route: {item.route}</p>
                            )}
                            {item.instructions && (
                              <p className="text-xs text-muted-foreground mt-1 italic">"{item.instructions}"</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">{item.quantity} units</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* SOAP Notes Tab */}
          <TabsContent value="soap-notes" className="space-y-3">
            {soapNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">No SOAP notes yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Clinical notes will appear here</p>
              </div>
            ) : (
              soapNotes.map((note: any) => (
                <Card key={note._id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Stethoscope className="w-4 h-4" />{note.addendumTo ? 'Signed Addendum' : 'Consultation Note'}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {note.doctorId?.fullName ? `Dr. ${note.doctorId.fullName}` : 'Clinical staff'} &bull; {formatDate(note.createdAt)} {formatTime(note.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {note.isSigned && <Badge className="text-[10px]">Signed</Badge>}
                        {note.isSigned && !note.addendumTo && ['admin', 'doctor', 'specialist'].includes((primaryRole || '').toLowerCase()) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddendumTarget(note._id)}>
                            Add correction
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {note.addendumText && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold uppercase text-amber-700">Addendum</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{note.addendumText}</p>
                      </div>
                    )}
                    {note.chiefComplaint && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 uppercase">Subjective</p>
                        <p className="text-sm mt-1">{note.chiefComplaint}</p>
                      </div>
                    )}
                    {note.historyPresentIllness && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs font-semibold uppercase text-blue-700">History of present illness</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{note.historyPresentIllness}</p>
                      </div>
                    )}
                    {note.vitalSigns && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-xs font-semibold text-emerald-700 uppercase">Objective - Vitals</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-sm">
                          {note.vitalSigns.bloodPressure && <div><span className="text-muted-foreground">BP:</span> <span className="font-medium">{note.vitalSigns.bloodPressure}</span></div>}
                          {note.vitalSigns.temperature && <div><span className="text-muted-foreground">Temp:</span> <span className="font-medium">{note.vitalSigns.temperature}&deg;C</span></div>}
                          {note.vitalSigns.heartRate && <div><span className="text-muted-foreground">HR:</span> <span className="font-medium">{note.vitalSigns.heartRate} bpm</span></div>}
                          {note.vitalSigns.respiratoryRate && <div><span className="text-muted-foreground">RR:</span> <span className="font-medium">{note.vitalSigns.respiratoryRate}</span></div>}
                          {note.vitalSigns.weight && <div><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{note.vitalSigns.weight} kg</span></div>}
                          {note.vitalSigns.oxygenSaturation && <div><span className="text-muted-foreground">SpO2:</span> <span className="font-medium">{note.vitalSigns.oxygenSaturation}%</span></div>}
                        </div>
                      </div>
                    )}
                    {note.diagnosis && (
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-xs font-semibold text-orange-700 uppercase">Assessment</p>
                        <p className="text-sm mt-1">{note.diagnosis}</p>
                      </div>
                    )}
                    {note.assessment && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                        <p className="text-xs font-semibold uppercase text-orange-700">Clinical assessment</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{note.assessment}</p>
                      </div>
                    )}
                    {note.treatmentPlan && (
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-xs font-semibold text-purple-700 uppercase">Plan</p>
                        <p className="text-sm mt-1">{note.treatmentPlan}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Vitals Tab */}
          <TabsContent value="vitals" className="space-y-3">
            {vitalsHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Activity className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground">No vitals recorded yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Vitals will appear here after nurse triage</p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">BP</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Temp</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">HR</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">RR</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Weight</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">SpO2</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">BMI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {vitalsHistory.map((v: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium">{formatDate(v.date)}</td>
                            <td className="px-4 py-3">{v.vitalSigns?.bloodPressure || '—'}</td>
                            <td className="px-4 py-3">{v.vitalSigns?.temperature ? `${v.vitalSigns.temperature}°C` : '—'}</td>
                            <td className="px-4 py-3">{v.vitalSigns?.heartRate ? `${v.vitalSigns.heartRate} bpm` : '—'}</td>
                            <td className="px-4 py-3">{v.vitalSigns?.respiratoryRate || '—'}</td>
                            <td className="px-4 py-3">{v.vitalSigns?.weight ? `${v.vitalSigns.weight} kg` : '—'}</td>
                            <td className="px-4 py-3">{v.vitalSigns?.oxygenSaturation ? `${v.vitalSigns.oxygenSaturation}%` : '—'}</td>
                            <td className="px-4 py-3">{v.vitalSigns?.bmi || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Treatment Plans Tab */}
          <TabsContent value="treatment-plans" className="space-y-3">
            <PatientTreatmentPlans patientId={patient._id} />
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={!!addendumTarget} onOpenChange={(open) => { if (!open) { setAddendumTarget(null); setAddendumText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add correction to signed SOAP note</DialogTitle>
            <DialogDescription>The original note remains unchanged. This correction will be signed and timestamped separately.</DialogDescription>
          </DialogHeader>
          <Textarea value={addendumText} onChange={(event) => setAddendumText(event.target.value)} rows={5} placeholder="State the correction and clinical reason…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddendumTarget(null); setAddendumText(''); }}>Cancel</Button>
            <Button
              onClick={() => addendumTarget && createAddendum.mutate({ noteId: addendumTarget, text: addendumText.trim() })}
              disabled={!addendumText.trim() || createAddendum.isPending}
            >
              {createAddendum.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign addendum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
};

export default PatientRecord;
