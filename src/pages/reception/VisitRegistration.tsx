import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateVisit, useMarkConsultationPaid } from '@/hooks/useVisits';
import { useSearchPatients } from '@/hooks/usePatients';
import { useDoctors } from '@/hooks/useDoctors';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2, Search, UserPlus, Stethoscope, ArrowLeft, Thermometer, TestTube, Scissors, UserCog } from 'lucide-react';

type ServiceId = 'normal_consultation' | 'specialist_consultation' | 'observation_4h' | 'procedure' | 'rapid_malaria' | 'rapid_typhoid';

interface BillableService {
  id: ServiceId;
  label: string;
  fee: number;
  visitType: 'new';
  icon: any;
  description: string;
  flag: 'none' | 'specialist' | 'procedure' | 'rapid_test';
}

const BILLABLE_SERVICES: BillableService[] = [
  {
    id: 'normal_consultation', label: 'Normal Consultation', fee: 150, visitType: 'new',
    icon: Stethoscope, flag: 'none', description: 'Standard general-practice visit',
  },
  {
    id: 'specialist_consultation', label: 'Specialist Consultation', fee: 250, visitType: 'new',
    icon: UserCog, flag: 'specialist', description: 'Direct booking to a named specialist',
  },
  {
    id: 'observation_4h', label: 'Observation (4 hours)', fee: 100, visitType: 'new',
    icon: Stethoscope, flag: 'none', description: 'Short-stay monitoring in the observation room',
  },
  {
    id: 'procedure', label: 'Procedure', fee: 50, visitType: 'new',
    icon: Scissors, flag: 'procedure', description: 'Nurse-prepped procedure room booking',
  },
  {
    id: 'rapid_malaria', label: 'Rapid Test - Malaria', fee: 50, visitType: 'new',
    icon: TestTube, flag: 'rapid_test', description: 'EMR-internal rapid test (nurse-entered result)',
  },
  {
    id: 'rapid_typhoid', label: 'Rapid Test - Typhoid', fee: 50, visitType: 'new',
    icon: TestTube, flag: 'rapid_test', description: 'EMR-internal rapid test (nurse-entered result)',
  },
];

export default function VisitRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patient');
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<ServiceId>('normal_consultation');
  const [visitType, setVisitType] = useState<string>('new');
  const [consultationFee, setConsultationFee] = useState<string>('150');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [temperature, setTemperature] = useState('');
  const [specialistId, setSpecialistId] = useState('');
  const [procedureType, setProcedureType] = useState('');

  const { data: doctors = [] } = useDoctors();
  const specialistOptions = useMemo(
    () => doctors.filter((d: any) => d.isActive !== false && (d.doctorType === 'specialist' || !!d.specialty)),
    [doctors],
  );

  const { data: searchResults = [], isLoading: searchLoading } = useSearchPatients(searchTerm);
  const { data: allPatients = [] } = useSearchPatients('');
  const createVisit = useCreateVisit();
  const markConsultationPaid = useMarkConsultationPaid();
  const selectedService = BILLABLE_SERVICES.find((service) => service.id === selectedServiceId) || BILLABLE_SERVICES[0];

  const recentPatients = useMemo(() => {
    if (!Array.isArray(allPatients)) return [];

    const getTimestamp = (patient: any) => {
      const raw = patient?.createdAt || patient?.registeredAt || patient?.updatedAt;
      if (!raw) return 0;
      const parsed = new Date(raw).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return [...allPatients]
      .sort((a: any, b: any) => getTimestamp(b) - getTimestamp(a))
      .slice(0, 8);
  }, [allPatients]);

  useEffect(() => {
    if (!preselectedPatientId || selectedPatient || !Array.isArray(allPatients)) return;

    const patient = allPatients.find((item: any) => {
      const id = item._id || item.id;
      return id === preselectedPatientId;
    });

    if (patient) {
      setSelectedPatient(patient);
    }
  }, [allPatients, preselectedPatientId, selectedPatient]);

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    if (!consultationFee || parseFloat(consultationFee) <= 0) {
      toast.error('Please enter a valid consultation fee');
      return;
    }

    try {
      if (selectedService.flag === 'specialist' && !specialistId) {
        toast.error('Please select a specialist for this consultation');
        return;
      }
      if (selectedService.flag === 'procedure' && !procedureType.trim()) {
        toast.error('Please enter a procedure name');
        return;
      }

      const visit = await createVisit.mutateAsync({
        patientId: selectedPatient._id || selectedPatient.id,
        visitType: visitType as any,
        consultationFee: parseFloat(consultationFee),
        chiefComplaint,
        notes: [
          `Service: ${selectedService.label}`,
          procedureType ? `Procedure: ${procedureType}` : undefined,
          notes.trim() || undefined,
        ].filter(Boolean).join('\n'),
        temperature: temperature ? parseFloat(temperature) : undefined,
        serviceType: selectedService.id,
        specialistId: selectedService.flag === 'specialist' ? specialistId : undefined,
        procedureType: selectedService.flag === 'procedure' ? procedureType : undefined,
      });

      await markConsultationPaid.mutateAsync({ visitId: visit._id || visit.id, paymentMethod: 'cash' });
      toast.success('Consultation payment confirmed. Patient sent to nurse vitals.');
      navigate('/reception');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create visit');
    }
  };

  return (
    <RoleLayout
      title="Register Visit"
      subtitle="Create a new patient visit"
      role="receptionist"
      userName={user?.fullName}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/reception')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Select Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients by name, ID, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>

              {searchLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}

              {searchTerm.length > 0 && searchResults.length > 0 && !selectedPatient && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.slice(0, 5).map((p: any) => (
                    <div
                      key={p._id || p.id}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b"
                      onClick={() => {
                        setSelectedPatient(p);
                        setSearchTerm('');
                      }}
                    >
                      <p className="font-semibold">{p.firstName} {p.lastName}</p>
                      <p className="text-sm text-gray-500">
                        {p.patientId} • {p.age}y • {p.gender === 'M' ? 'Male' : 'Female'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!searchTerm && !selectedPatient && recentPatients.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Recent Patients</p>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/reception/register')}>
                      Register New
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recentPatients.map((p: any) => (
                      <button
                        key={p._id || p.id}
                        type="button"
                        className="text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedPatient(p)}
                      >
                        <p className="font-semibold text-sm">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.patientId} - {p.age}y - {p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : 'Other'}
                        </p>
                        {p.phone && <p className="text-xs text-muted-foreground mt-0.5">{p.phone}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPatient && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-green-800">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </p>
                      <p className="text-sm text-green-600">
                        {selectedPatient.patientId} • {selectedPatient.age}y • {selectedPatient.gender === 'M' ? 'Male' : 'Female'}
                      </p>
                      {selectedPatient.phone && (
                        <p className="text-sm text-green-600">{selectedPatient.phone}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPatient(null)}
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visit Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Visit Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service">Service</Label>
                  <Select
                    value={selectedServiceId}
                    onValueChange={(value) => {
                      const service = BILLABLE_SERVICES.find((item) => item.id === value);
                      setSelectedServiceId(value as ServiceId);
                      if (service) {
                        setConsultationFee(String(service.fee));
                        setVisitType(service.visitType);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLABLE_SERVICES.map((service) => {
                        const Icon = service.icon;
                        return (
                          <SelectItem key={service.id} value={service.id}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5" />
                              <span>{service.label}</span>
                              <span className="text-muted-foreground">- Le {service.fee}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedService.description && (
                    <p className="text-xs text-muted-foreground">{selectedService.description}</p>
                  )}
                </div>

                {selectedService.flag === 'specialist' && (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="specialist">Receiving Specialist *</Label>
                    <Select value={specialistId} onValueChange={setSpecialistId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a specialist" />
                      </SelectTrigger>
                      <SelectContent>
                        {specialistOptions.length === 0 ? (
                          <SelectItem value="__none__" disabled>No specialists registered</SelectItem>
                        ) : (
                          specialistOptions.map((d: any) => (
                            <SelectItem key={d._id} value={d._id}>
                              {d.fullName}{d.specialty ? ` - ${String(d.specialty).replace(/_/g, ' ')}` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {specialistOptions.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Register a specialist in the Doctors page first.
                      </p>
                    )}
                  </div>
                )}

                {selectedService.flag === 'procedure' && (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="procedureType">Procedure *</Label>
                    <Input
                      id="procedureType"
                      value={procedureType}
                      onChange={(e) => setProcedureType(e.target.value)}
                      placeholder="e.g., Wound dressing, Suturing, Incision & drainage"
                    />
                  </div>
                )}

                {selectedService.flag === 'rapid_test' && (
                  <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <strong>Rapid test workflow:</strong> After vitals, the nurse will run the bedside
                    rapid test and record the result on the visit. You will not need to route a lab order.
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="visitType">Visit Type</Label>
                  <Select value={visitType} onValueChange={setVisitType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visit type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New Visit</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consultationFee">Service Fee (Le)</Label>
                  <Input
                    id="consultationFee"
                    type="number"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    placeholder="Enter consultation fee"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="chiefComplaint">Chief Complaint</Label>
                <Textarea
                  id="chiefComplaint"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Enter patient's chief complaint..."
                  rows={3}
                />
              </div>

              {/* Quick Temperature Check */}
              <div className="space-y-2">
                <Label htmlFor="temperature" className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  Temperature (°C) — Quick Check
                </Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="36.5"
                  className="max-w-xs"
                />
                {temperature && (
                  <p className={cn(
                    'text-xs font-medium',
                    parseFloat(temperature) >= 38 ? 'text-red-600' : parseFloat(temperature) >= 37.5 ? 'text-amber-600' : 'text-green-600',
                  )}>
                    {parseFloat(temperature) >= 38 ? '⚠ Fever detected' : parseFloat(temperature) >= 37.5 ? 'Elevated temperature' : 'Normal temperature'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/reception')}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedPatient || createVisit.isPending || markConsultationPaid.isPending}
          >
            {createVisit.isPending || markConsultationPaid.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Visit & Confirm Payment
              </>
            )}
          </Button>
        </div>
      </div>
    </RoleLayout>
  );
}
