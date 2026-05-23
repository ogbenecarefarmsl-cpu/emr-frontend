import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { patientService } from '@/services/patientService';
import { ordersAPI } from '@/services/api';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ArrowLeft, User, Activity, Stethoscope, Pill, FileText, FlaskConical, Clock, AlertTriangle, ChevronDown, Calendar, Droplets, ExternalLink, RefreshCw, Cloud } from 'lucide-react';
import { toast } from 'sonner';

const PatientRecord = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { primaryRole, profile } = useAuth();
  const layoutRole = primaryRole || 'doctor';
  const queryClient = useQueryClient();

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
      <RoleLayout title="Patient Record" subtitle="Patient not found" role={layoutRole} userName={profile?.fullName}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <User className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground">Patient not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
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
  const admissions = chart.admissions || [];
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
        return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      completed: { variant: 'default', label: 'Completed' },
      pending_collection: { variant: 'secondary', label: 'Pending Collection' },
      processing: { variant: 'outline', label: 'Processing' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
      awaiting_payment: { variant: 'secondary', label: 'Awaiting Payment' },
      paid: { variant: 'default', label: 'Paid' },
    };
    const config = statusMap[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getLisBadge = (order: any) => {
    if (!order.lisSyncStatus) return null;
    const className =
      order.lisSyncStatus === 'synced'
        ? 'bg-green-50 text-green-700 border-green-200'
        : order.lisSyncStatus === 'failed'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-muted text-muted-foreground border-border';

    return (
      <Badge variant="outline" className={`gap-1 ${className}`} title={order.lisSyncError || undefined}>
        <Cloud className="w-3 h-3" />
        LIS {String(order.lisSyncStatus).replace('_', ' ')}
      </Badge>
    );
  };

  const groupResultsByPanel = (order: any) => {
    const panels: Record<string, { name: string; tests: any[] }> = {};
    const standalone: any[] = [];

    order.orderTests?.forEach((test: any) => {
      const result = order.results?.find((r: any) =>
        r.orderTestId?.toString() === test._id?.toString()
      );
      const testWithResult = { ...test, result };

      if (test.panelCode) {
        if (!panels[test.panelCode]) {
          panels[test.panelCode] = { name: test.panelName || test.panelCode, tests: [] };
        }
        panels[test.panelCode].tests.push(testWithResult);
      } else {
        standalone.push(testWithResult);
      }
    });

    return { panels, standalone };
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <RoleLayout title="Patient Record" subtitle="Longitudinal clinical history" role={layoutRole} userName={profile?.fullName}>
      <div className="space-y-6">
        {/* Patient Header */}
        <div className="flex items-start gap-4 bg-card border rounded-xl p-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {patient.firstName} {patient.lastName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {patient.patientId} • {patient.gender === 'M' ? 'Male' : 'Female'} • {patient.age} {patient.ageUnit || 'years'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {patient.bloodType && (
                <Badge variant="outline" className="gap-1">
                  <Droplets className="w-3 h-3" />
                  {patient.bloodType}
                </Badge>
              )}
              {patient.allergies?.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {patient.allergies.join(', ')}
                </Badge>
              )}
              {patient.chronicConditions?.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  {patient.chronicConditions.join(', ')}
                </Badge>
              )}
              {patient.insuranceProvider && (
                <Badge variant="outline">{patient.insuranceProvider}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Consultations', value: summary.totalConsultations || 0, icon: Stethoscope, color: 'text-blue-600' },
            { label: 'Prescriptions', value: summary.totalPrescriptions || 0, icon: Pill, color: 'text-green-600' },
            { label: 'Lab Orders', value: summary.totalLabOrders || 0, icon: FlaskConical, color: 'text-purple-600' },
            { label: 'Last Visit', value: summary.lastVisit ? formatDate(summary.lastVisit) : 'N/A', icon: Calendar, color: 'text-amber-600' },
          ].map((stat) => (
            <Card key={stat.label} className="border-l-4 border-l-primary">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-semibold mt-0.5">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="lab-results">Lab Results</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="soap-notes">SOAP Notes</TabsTrigger>
            <TabsTrigger value="vitals">Vitals</TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4">
            {soapNotes.length === 0 && consultations.length === 0 && orders.length === 0 ? (
              <Card>
                <CardContent className="pt-12 text-center">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground">No clinical history yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Encounters will appear here as they are recorded</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* SOAP Notes */}
                {soapNotes.map((note: any) => (
                  <div key={note._id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Stethoscope className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="w-0.5 h-full bg-border mt-1" />
                    </div>
                    <Card className="flex-1">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-sm">Consultation</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {note.doctorId?.fullName ? `Dr. ${note.doctorId.fullName}` : 'Clinical staff'} • {formatDate(note.createdAt)} {formatTime(note.createdAt)}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {note.chiefComplaint && (
                          <div>
                            <span className="font-medium text-blue-600">Complaint:</span> {note.chiefComplaint}
                          </div>
                        )}
                        {note.diagnosis && (
                          <div>
                            <span className="font-medium text-orange-600">Diagnosis:</span> {note.diagnosis}
                          </div>
                        )}
                        {note.treatmentPlan && (
                          <div>
                            <span className="font-medium text-purple-600">Plan:</span> {note.treatmentPlan}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {/* Lab Orders */}
                {orders.map((order: any) => (
                  <div key={order._id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <FlaskConical className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="w-0.5 h-full bg-border mt-1" />
                    </div>
                    <Card className="flex-1">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-sm">{order.orderNumber}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(order.createdAt)} {formatTime(order.createdAt)} • Dr. {order.doctorId?.fullName || 'N/A'}
                            </p>
                          </div>
                          {getStatusBadge(order.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1">
                          {order.orderTests?.slice(0, 5).map((test: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">{test.testName || test.testCode}</Badge>
                          ))}
                          {order.orderTests?.length > 5 && (
                            <Badge variant="outline" className="text-xs">+{order.orderTests.length - 5} more</Badge>
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
              <Card>
                <CardContent className="pt-12 text-center">
                  <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground">No lab orders yet</p>
                </CardContent>
              </Card>
            ) : (
              orders.map((order: any) => {
                const { panels, standalone } = groupResultsByPanel(order);
                const hasResults = order.results?.length > 0;

                return (
                  <Card key={order._id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(order.createdAt)} • Dr. {order.doctorId?.fullName || 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(order.status)}
                          {getLisBadge(order)}
                          {order.lisSyncStatus === 'synced' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => fetchLisResults.mutate(order._id)}
                              disabled={fetchLisResults.isPending}
                              title={order.lisResultsFetchedAt ? `Last fetched ${formatDate(order.lisResultsFetchedAt)}` : 'Fetch LIS results'}
                            >
                              <RefreshCw className={`w-3 h-3 ${fetchLisResults.isPending ? 'animate-spin' : ''}`} />
                              Sync Results
                            </Button>
                          )}
                          {order.status === 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                const reportPath = primaryRole === 'receptionist'
                                  ? `/reception/reports/${order._id}`
                                  : `/lab/reports/${order._id}`;
                                navigate(reportPath);
                              }}
                            >
                              <ExternalLink className="w-3 h-3" />
                              Full Report
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Panel Groups */}
                      {Object.entries(panels).map(([code, panel]: [string, any]) => (
                        <Collapsible key={code}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                              <ChevronDown className="w-4 h-4 text-muted-foreground collapsible-icon" />
                              <span className="font-medium text-sm">{panel.name}</span>
                              <Badge variant="outline" className="ml-auto text-xs">{panel.tests.length} tests</Badge>
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
                                  <Badge variant="secondary" className="text-xs">Pending</Badge>
                                )}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}

                      {/* Standalone Tests */}
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
                                <Badge variant="secondary" className="text-xs">Pending</Badge>
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
              })
            )}
          </TabsContent>

          {/* Prescriptions Tab */}
          <TabsContent value="prescriptions" className="space-y-4">
            {prescriptions.length === 0 ? (
              <Card>
                <CardContent className="pt-12 text-center">
                  <Pill className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground">No prescriptions yet</p>
                </CardContent>
              </Card>
            ) : (
              prescriptions.map((p: any) => (
                <Card key={p._id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{p.prescriptionNumber}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Dr. {p.prescribedBy?.fullName || p.doctorId?.fullName || 'N/A'} • {formatDate(p.createdAt)}
                        </p>
                      </div>
                      <Badge variant={p.isPaid ? 'default' : 'destructive'}>
                        {p.isPaid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {p.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                          <Pill className="w-4 h-4 text-primary mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.medicationName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.dosage} • {item.frequency} • {item.duration}
                            </p>
                            {item.route && (
                              <p className="text-xs text-muted-foreground">Route: {item.route}</p>
                            )}
                            {item.instructions && (
                              <p className="text-xs text-muted-foreground mt-1">Instructions: {item.instructions}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">{item.quantity} units</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* SOAP Notes Tab */}
          <TabsContent value="soap-notes" className="space-y-4">
            {soapNotes.length === 0 ? (
              <Card>
                <CardContent className="pt-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground">No SOAP notes yet</p>
                </CardContent>
              </Card>
            ) : (
              soapNotes.map((note: any) => (
                <Card key={note._id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Stethoscope className="w-4 h-4" />
                          Consultation Note
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {note.doctorId?.fullName ? `Dr. ${note.doctorId.fullName}` : 'Clinical staff'} • {formatDate(note.createdAt)} {formatTime(note.createdAt)}
                        </p>
                      </div>
                      {note.isSigned && <Badge>Signed</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {note.chiefComplaint && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 uppercase">Subjective</p>
                        <p className="text-sm mt-1">{note.chiefComplaint}</p>
                      </div>
                    )}
                    {note.vitalSigns && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs font-semibold text-green-700 uppercase">Objective - Vitals</p>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                          {note.vitalSigns.bloodPressure && <p>BP: {note.vitalSigns.bloodPressure}</p>}
                          {note.vitalSigns.temperature && <p>Temp: {note.vitalSigns.temperature}°C</p>}
                          {note.vitalSigns.heartRate && <p>HR: {note.vitalSigns.heartRate} bpm</p>}
                          {note.vitalSigns.respiratoryRate && <p>RR: {note.vitalSigns.respiratoryRate}</p>}
                          {note.vitalSigns.weight && <p>Weight: {note.vitalSigns.weight} kg</p>}
                          {note.vitalSigns.oxygenSaturation && <p>SpO2: {note.vitalSigns.oxygenSaturation}%</p>}
                        </div>
                      </div>
                    )}
                    {note.diagnosis && (
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-xs font-semibold text-orange-700 uppercase">Assessment</p>
                        <p className="text-sm mt-1">{note.diagnosis}</p>
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
          <TabsContent value="vitals" className="space-y-4">
            {vitalsHistory.length === 0 ? (
              <Card>
                <CardContent className="pt-12 text-center">
                  <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground">No vitals recorded yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">BP</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Temp</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">HR</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">RR</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Weight</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">SpO2</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">BMI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vitalsHistory.map((v: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/50">
                            <td className="py-3 px-4">{formatDate(v.date)}</td>
                            <td className="py-3 px-4">{v.vitalSigns?.bloodPressure || '—'}</td>
                            <td className="py-3 px-4">{v.vitalSigns?.temperature ? `${v.vitalSigns.temperature}°C` : '—'}</td>
                            <td className="py-3 px-4">{v.vitalSigns?.heartRate ? `${v.vitalSigns.heartRate} bpm` : '—'}</td>
                            <td className="py-3 px-4">{v.vitalSigns?.respiratoryRate || '—'}</td>
                            <td className="py-3 px-4">{v.vitalSigns?.weight ? `${v.vitalSigns.weight} kg` : '—'}</td>
                            <td className="py-3 px-4">{v.vitalSigns?.oxygenSaturation ? `${v.vitalSigns.oxygenSaturation}%` : '—'}</td>
                            <td className="py-3 px-4">{v.vitalSigns?.bmi || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RoleLayout>
  );
};

export default PatientRecord;
