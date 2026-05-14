import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { patientService } from '@/services/patientService';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft, User, Activity, Stethoscope, Pill, FileText, FlaskConical, Clock, CheckCircle, AlertTriangle, BedDouble } from 'lucide-react';

const PatientRecord = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { primaryRole, profile } = useAuth();
  const layoutRole = primaryRole || 'doctor';

  const { data: chart, isLoading: chartLoading } = useQuery({
    queryKey: ['patient-chart', patientId],
    queryFn: () => patientService.getChart(patientId!),
    enabled: !!patientId,
  });

  if (chartLoading) {
    return (
      <RoleLayout title="Patient Record" subtitle="Longitudinal clinical history" role={layoutRole} userName={profile?.full_name}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </RoleLayout>
    );
  }

  const patient = chart?.patient;
  const consultations = chart?.consultations || [];
  const prescriptions = chart?.prescriptions || [];
  const soapNotes = chart?.soapNotes || [];
  const orders = chart?.orders || [];
  const admissions = chart?.admissions || [];
  const notes = chart?.notes || [];
  const vitalsHistory = chart?.vitalsHistory || [];
  const summary = chart?.summary || {};

  return (
    <RoleLayout title="Patient Record" subtitle="Longitudinal clinical history" role={layoutRole} userName={profile?.full_name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">
              {patient?.firstName} {patient?.lastName}
            </h1>
            <p className="text-muted-foreground">
              {patient?.patientId} • {patient?.gender} • {patient?.age} {patient?.ageUnit || 'years'}
            </p>
          </div>
          <Badge variant={patient?.isActive ? 'default' : 'secondary'}>
            {patient?.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Patient Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Blood Type</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{patient?.bloodType || 'N/A'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Allergies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {patient?.allergies?.length > 0 ? (
                  patient.allergies.map((a: string) => (
                    <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                  ))
                ) : (
                  <p className="text-gray-500">None</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Chronic Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {patient?.chronicConditions?.length > 0 ? (
                  patient.chronicConditions.map((c: string) => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))
                ) : (
                  <p className="text-gray-500">None</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Insurance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{patient?.insuranceProvider || 'N/A'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Consultations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalConsultations || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Prescriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalPrescriptions || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Lab Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalLabOrders || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Last Visit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{summary.lastVisit ? new Date(summary.lastVisit).toLocaleDateString() : 'N/A'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Detailed Info */}
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="consultations">Consultations</TabsTrigger>
            <TabsTrigger value="lab-results">Lab Results</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="soap-notes">SOAP Notes</TabsTrigger>
            <TabsTrigger value="admissions">Admissions</TabsTrigger>
            <TabsTrigger value="vitals">Vitals</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Patient Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p>{patient?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p>{patient?.email || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Address</p>
                    <p>{patient?.address || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Medical History</p>
                    <p className="whitespace-pre-wrap">{patient?.medicalHistory || 'No medical history recorded'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Current Medications</p>
                    <p className="whitespace-pre-wrap">{patient?.currentMedications || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Emergency Contact</p>
                    <p>{patient?.emergencyContactName || 'N/A'}</p>
                    <p className="text-sm">{patient?.emergencyContactPhone || ''}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consultations Tab */}
          <TabsContent value="consultations" className="space-y-4">
            {consultations.length > 0 ? (
              consultations.map((c: any) => (
                <Card key={c._id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{c.consultationNumber}</p>
                        <p className="text-sm text-gray-500">Dr. {c.doctorId?.fullName}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge>{c.status}</Badge>
                    </div>
                    {c.diagnosis && (
                      <div className="mt-3">
                        <p className="text-sm font-medium">Diagnosis:</p>
                        <p className="text-sm">{c.diagnosis}</p>
                      </div>
                    )}
                    {c.chiefComplaint && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Chief Complaint:</p>
                        <p className="text-sm">{c.chiefComplaint}</p>
                      </div>
                    )}
                    {c.treatmentPlan && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Treatment Plan:</p>
                        <p className="text-sm">{c.treatmentPlan}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No consultations found</p>
            )}
          </TabsContent>

          {/* Lab Results Tab */}
          <TabsContent value="lab-results" className="space-y-4">
            {orders.length > 0 ? (
              orders.map((order: any) => (
                <Card key={order._id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                        <p className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString()} • Dr. {order.doctorId?.fullName || 'N/A'}
                        </p>
                      </div>
                      <Badge>{order.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {order.orderTests?.map((test: any, idx: number) => {
                        const result = order.results?.find((r: any) => 
                          r.orderTestId?.toString() === test._id?.toString()
                        );
                        return (
                          <div key={idx} className="border-l-2 pl-3 py-1">
                            <div className="flex justify-between">
                              <p className="font-medium text-sm">{test.testName || test.testCode}</p>
                              {result && (
                                <Badge variant={
                                  result.flag === 'normal' ? 'default' : 
                                  result.flag === 'critical_high' || result.flag === 'critical_low' ? 'destructive' : 'secondary'
                                }>
                                  {result.flag}
                                </Badge>
                              )}
                            </div>
                            {result ? (
                              <p className="text-sm">
                                <span className="font-semibold">{result.value} {result.unit}</span>
                                {result.referenceRange && (
                                  <span className="text-gray-500 ml-2">({result.referenceRange})</span>
                                )}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500">Pending</p>
                            )}
                          </div>
                        );
                      })}
                      {(!order.orderTests || order.orderTests.length === 0) && (
                        <p className="text-sm text-gray-500">No tests found for this order.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500 py-8">No lab orders found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Prescriptions Tab */}
          <TabsContent value="prescriptions" className="space-y-4">
            {prescriptions.length > 0 ? (
              prescriptions.map((p: any) => (
                <Card key={p._id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{p.prescriptionNumber}</p>
                        <p className="text-sm text-gray-500">Dr. {p.doctorId?.fullName}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={p.isPaid ? 'default' : 'destructive'}>
                        {p.isPaid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {p.items?.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm border-l-2 pl-3">
                          <span className="font-medium">{item.medicationName}</span>
                          {' - '}{item.dosage}, {item.frequency} for {item.duration}
                        </div>
                      ))}
                    </div>
                    {p.treatmentPlan && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">Instructions: {p.treatmentPlan}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No prescriptions found</p>
            )}
          </TabsContent>

          {/* SOAP Notes Tab */}
          <TabsContent value="soap-notes" className="space-y-4">
            {soapNotes.length > 0 ? (
              soapNotes.map((note: any) => (
                <Card key={note._id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">SOAP Note - {note.noteType}</CardTitle>
                        <p className="text-sm text-gray-500">
                          {note.doctorId?.fullName ? `Dr. ${note.doctorId.fullName}` : note.nurseId?.full_name || note.nurseId?.fullName || 'Clinical staff'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {note.isSigned && (
                        <Badge variant="default">Signed</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Subjective */}
                    {note.chiefComplaint && (
                      <div>
                        <p className="text-sm font-semibold text-blue-600">SUBJECTIVE:</p>
                        <p className="text-sm mt-1">{note.chiefComplaint}</p>
                      </div>
                    )}
                    {note.historyPresentIllness && (
                      <div>
                        <p className="text-sm font-semibold text-blue-600">HISTORY OF PRESENT ILLNESS:</p>
                        <p className="text-sm mt-1">{note.historyPresentIllness}</p>
                      </div>
                    )}

                    {/* Objective */}
                    {note.vitalSigns && (
                      <div>
                        <p className="text-sm font-semibold text-green-600">OBJECTIVE - VITALS:</p>
                        <div className="grid grid-cols-3 gap-2 mt-1 text-sm">
                          {note.vitalSigns.bloodPressure && (
                            <p>BP: {note.vitalSigns.bloodPressure}</p>
                          )}
                          {note.vitalSigns.temperature && (
                            <p>Temp: {note.vitalSigns.temperature}°F</p>
                          )}
                          {note.vitalSigns.heartRate && (
                            <p>HR: {note.vitalSigns.heartRate} bpm</p>
                          )}
                          {note.vitalSigns.respiratoryRate && (
                            <p>RR: {note.vitalSigns.respiratoryRate}</p>
                          )}
                          {note.vitalSigns.weight && (
                            <p>Weight: {note.vitalSigns.weight} kg</p>
                          )}
                          {note.vitalSigns.height && (
                            <p>Height: {note.vitalSigns.height} cm</p>
                          )}
                        </div>
                      </div>
                    )}
                    {note.physicalExamination && (
                      <div>
                        <p className="text-sm font-semibold text-green-600">PHYSICAL EXAMINATION:</p>
                        <p className="text-sm mt-1">{note.physicalExamination}</p>
                      </div>
                    )}

                    {/* Assessment */}
                    {note.diagnosis && (
                      <div>
                        <p className="text-sm font-semibold text-orange-600">ASSESSMENT:</p>
                        <p className="text-sm mt-1">{note.diagnosis}</p>
                      </div>
                    )}

                    {/* Plan */}
                    {note.treatmentPlan && (
                      <div>
                        <p className="text-sm font-semibold text-purple-600">PLAN:</p>
                        <p className="text-sm mt-1">{note.treatmentPlan}</p>
                      </div>
                    )}
                    {note.followUpInstructions && (
                      <div>
                        <p className="text-sm font-semibold text-purple-600">FOLLOW-UP:</p>
                        <p className="text-sm mt-1">{note.followUpInstructions}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No SOAP notes found</p>
            )}
          </TabsContent>

          {/* Admissions Tab */}
          <TabsContent value="admissions" className="space-y-4">
            {admissions.length > 0 ? (
              admissions.map((admission: any) => (
                <Card key={admission._id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BedDouble className="w-4 h-4" />
                          {admission.admissionNumber}
                        </CardTitle>
                        <p className="text-sm text-gray-500">
                          {admission.wardType}{admission.bedNumber ? ` - ${admission.bedNumber}` : ''} - {admission.status}
                        </p>
                      </div>
                      <Badge variant={admission.status === 'admitted' ? 'default' : 'secondary'}>
                        {admission.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Reason</p>
                        <p>{admission.admissionReason || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Diagnosis</p>
                        <p>{admission.diagnosis || admission.dischargeDiagnosis || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="border rounded-lg p-3">
                        <p className="text-gray-500">Vitals</p>
                        <p className="font-semibold">{admission.vitalsLog?.length || 0}</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <p className="text-gray-500">MAR Entries</p>
                        <p className="font-semibold">{admission.medicationLog?.length || 0}</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <p className="text-gray-500">Nursing Notes</p>
                        <p className="font-semibold">{admission.nursingNotes?.length || 0}</p>
                      </div>
                    </div>
                    {admission.dischargeInstructions && (
                      <div>
                        <p className="text-sm font-semibold text-purple-600">DISCHARGE / FOLLOW-UP:</p>
                        <p className="text-sm mt-1">{admission.dischargeInstructions}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No admissions found</p>
            )}
          </TabsContent>

          {/* Vitals History Tab */}
          <TabsContent value="vitals" className="space-y-4">
            {vitalsHistory?.length > 0 ? (
              vitalsHistory.map((v: any, idx: number) => (
                <Card key={idx}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium">
                        {new Date(v.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {v.recordedBy?.fullName || 'Unknown'}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {v.vitalSigns?.bloodPressure && (
                        <p>BP: {v.vitalSigns.bloodPressure}</p>
                      )}
                      {v.vitalSigns?.temperature && (
                        <p>Temp: {v.vitalSigns.temperature}°F</p>
                      )}
                      {v.vitalSigns?.heartRate && (
                        <p>HR: {v.vitalSigns.heartRate} bpm</p>
                      )}
                      {v.vitalSigns?.respiratoryRate && (
                        <p>RR: {v.vitalSigns.respiratoryRate}</p>
                      )}
                      {v.vitalSigns?.weight && (
                        <p>Weight: {v.vitalSigns.weight} kg</p>
                      )}
                      {v.vitalSigns?.height && (
                        <p>Height: {v.vitalSigns.height} cm</p>
                      )}
                      {v.vitalSigns?.bmi && (
                        <p>BMI: {v.vitalSigns.bmi}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  No vitals recorded yet
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
