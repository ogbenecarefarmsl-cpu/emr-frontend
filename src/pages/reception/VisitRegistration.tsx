import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateVisit, useInsuranceEligibility, useMarkConsultationPaid } from '@/hooks/useVisits';
import { useSearchPatients } from '@/hooks/usePatients';
import { useDoctors } from '@/hooks/useDoctors';
import { useMyServicePrices } from '@/hooks/useServicePrices';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { InsuranceStatusBadge } from '@/components/insurance/InsuranceStatusBadge';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Loader2, Search, UserPlus, Stethoscope, ArrowLeft, Thermometer, Scissors, UserCog, ShieldOff, AlertTriangle } from 'lucide-react';

type ServiceId = 'normal_consultation' | 'specialist_consultation' | 'observation_4h' | 'procedure';

interface BillableService {
  id: ServiceId;
  label: string;
  fee: number;
  visitType: 'new';
  icon: any;
  description: string;
  flag: 'none' | 'specialist' | 'procedure';
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
  const [wantsMalariaTest, setWantsMalariaTest] = useState(false);
  const [wantsTyphoidTest, setWantsTyphoidTest] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const { data: doctors = [] } = useDoctors();
  const specialistOptions = useMemo(
    () => doctors.filter((d: any) => d.isActive !== false && (d.doctorType === 'specialist' || !!d.specialty)),
    [doctors],
  );

  const { data: searchResults = [], isLoading: searchLoading } = useSearchPatients(searchTerm);
  const { data: allPatients = [] } = useSearchPatients('');
  const { data: servicePrices = [] } = useMyServicePrices();
  const createVisit = useCreateVisit();
  const markConsultationPaid = useMarkConsultationPaid();
  const servicePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(servicePrices)) {
      servicePrices.forEach((price: any) => {
        map[price.code] = Number(price.amount || 0);
      });
    }
    return map;
  }, [servicePrices]);
  const pricedServices = useMemo(
    () => BILLABLE_SERVICES.map((service) => ({
      ...service,
      fee: servicePriceMap[service.id] ?? service.fee,
    })),
    [servicePriceMap],
  );
  const selectedService = pricedServices.find((service) => service.id === selectedServiceId) || pricedServices[0];
  const hasInsurance = !!selectedPatient?.insurance?.programCode;
  const [acknowledgedBlock, setAcknowledgedBlock] = useState(false);
  const [selfPayOverride, setSelfPayOverride] = useState(false);
  const selectedPatientId = selectedPatient?._id || selectedPatient?.id;
  const {
    data: insuranceEligibility,
    isLoading: checkingBlock,
    isError: eligibilityCheckFailed,
    refetch: retryEligibilityCheck,
  } = useInsuranceEligibility(selectedPatientId);
  const insuranceBlock = insuranceEligibility?.block ? insuranceEligibility : null;
  const isBlocked = insuranceEligibility?.status === 'blocked';
  const isWaitingPeriod = insuranceEligibility?.status === 'waiting_period';
  const insuranceEligible = insuranceEligibility?.status === 'eligible';

  useEffect(() => {
    setAcknowledgedBlock(false);
    setSelfPayOverride(false);
  }, [selectedPatientId]);

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

  useEffect(() => {
    const serviceFee = selectedService.fee;
    let extraFee = 0;
    if (wantsMalariaTest) extraFee += servicePriceMap.rapid_malaria ?? 50;
    if (wantsTyphoidTest) extraFee += servicePriceMap.rapid_typhoid ?? 50;
    setConsultationFee(String(serviceFee + extraFee));
  }, [selectedService.fee, servicePriceMap, wantsMalariaTest, wantsTyphoidTest]);

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    // Block check: require acknowledgment
    if (isBlocked && !acknowledgedBlock) {
      toast.error('Please acknowledge the insurance block before proceeding');
      return;
    }
    if (isWaitingPeriod && !selfPayOverride) {
      toast.error('This insurance consultation is not eligible yet. Select self-pay to continue.');
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

      const rapidTestsRequested: ('malaria' | 'typhoid')[] = [];
      if (wantsMalariaTest) rapidTestsRequested.push('malaria');
      if (wantsTyphoidTest) rapidTestsRequested.push('typhoid');

      const visit = await createVisit.mutateAsync({
        patientId: selectedPatient._id || selectedPatient.id,
        visitType: visitType as any,
        consultationFee: parseFloat(consultationFee) || 0,
        chiefComplaint,
        selfPayOverride: (isBlocked || selfPayOverride) || undefined,
        notes: [
          `Service: ${selectedService.label}`,
          procedureType ? `Procedure: ${procedureType}` : undefined,
          rapidTestsRequested.length > 0 ? `Rapid tests requested: ${rapidTestsRequested.join(', ')}` : undefined,
          notes.trim() || undefined,
        ].filter(Boolean).join('\n'),
        temperature: temperature ? parseFloat(temperature) : undefined,
        serviceType: selectedService.id,
        specialistId: selectedService.flag === 'specialist' ? specialistId : undefined,
        procedureType: selectedService.flag === 'procedure' ? procedureType : undefined,
        rapidTestsRequested: rapidTestsRequested.length > 0 ? rapidTestsRequested : undefined,
      });

      if ((visit as any).consultationFeeWaived) {
        toast.success('Included follow-up visit. Patient sent to nurse vitals.');
      } else if ((visit as any).consultationCoveredByInsurance) {
        toast.success('Consultation covered by insurance. Patient sent to nurse vitals.');
      } else {
        await markConsultationPaid.mutateAsync({ visitId: visit._id || visit.id, paymentMethod });
        toast.success('Consultation payment confirmed. Patient sent to nurse vitals.');
      }
      navigate(`/reception/visit-receipt?visitId=${visit._id || visit.id}`);
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
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-green-800">
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </p>
                        <InsuranceStatusBadge
                          insurance={selectedPatient.insurance}
                          eligibility={insuranceEligibility}
                          compact
                          className="text-xs"
                        />
                      </div>
                      <p className="text-sm text-green-600">
                        {selectedPatient.patientId} • {selectedPatient.age}y • {selectedPatient.gender === 'M' ? 'Male' : 'Female'}
                      </p>
                      {selectedPatient.phone && (
                        <p className="text-sm text-green-600">{selectedPatient.phone}</p>
                      )}
                      {selectedPatient.insurance?.memberNumber && (
                        <p className="text-xs text-green-700 mt-1">
                          Member #{selectedPatient.insurance.memberNumber}
                          {selectedPatient.insurance.responsiblePerson
                            ? ` · Resp: ${selectedPatient.insurance.responsiblePerson}`
                            : ''}
                        </p>
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

        {hasInsurance && !isBlocked && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox id="selfPayOverride" checked={selfPayOverride} onCheckedChange={(checked) => setSelfPayOverride(checked === true)} />
                <div>
                  <Label htmlFor="selfPayOverride" className="cursor-pointer font-medium text-blue-900">
                    {isWaitingPeriod ? 'Insurance is not eligible yet — register as self-pay' : 'Register this visit as self-pay'}
                  </Label>
                  <p className="mt-1 text-sm text-blue-800">
                    {isWaitingPeriod && insuranceEligibility?.nextEligibleAt
                      ? `The next covered consultation is ${new Date(insuranceEligibility.nextEligibleAt).toLocaleDateString()}. Select self-pay to continue today.`
                      : 'Insurance covers one consultation every 14 days. Self-pay can be used for an additional visit.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {hasInsurance && eligibilityCheckFailed ? (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-amber-900">Insurance eligibility could not be verified</p>
                <p className="text-sm text-amber-800">Retry, or select self-pay above to continue without delaying care.</p>
              </div>
              <Button variant="outline" onClick={() => retryEligibilityCheck()}>Retry</Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Insurance Block Warning */}
        {isBlocked && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ShieldOff className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Insurance Coverage Blocked
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    <strong>{insuranceBlock.reason}</strong>
                    {insuranceBlock.block?.programCode && ` — ${insuranceBlock.block.programCode}`}
                    {insuranceBlock.block?.effectiveDate && ` (effective ${new Date(insuranceBlock.block.effectiveDate).toLocaleDateString()})`}
                  </p>
                  {insuranceBlock.block?.reasonDetail && (
                    <p className="text-xs text-red-600 mt-1">{insuranceBlock.block.reasonDetail}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Checkbox
                      id="ackBlock"
                      checked={acknowledgedBlock}
                      onCheckedChange={(c) => setAcknowledgedBlock(!!c)}
                    />
                    <label htmlFor="ackBlock" className="text-sm font-medium text-red-800">
                      I understand — register this patient as <strong>self-pay</strong> (patient pays out of pocket)
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                      const service = pricedServices.find((item) => item.id === value);
                      setSelectedServiceId(value as ServiceId);
                      if (service) {
                        setVisitType(service.visitType);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                    {pricedServices.map((service) => {
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

                {(wantsMalariaTest || wantsTyphoidTest) && (
                  <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <strong>Rapid test workflow:</strong> After vitals, the nurse will run the bedside
                    rapid test and record the result on the visit. You will not need to route a lab order.
                  </div>
                )}

                {/* Rapid Tests check */}
                <div className="col-span-2 space-y-2 mt-2">
                  <Label>Rapid Tests (done by Nurse at Triage)</Label>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="rapidMalaria" checked={wantsMalariaTest} onCheckedChange={(c) => setWantsMalariaTest(!!c)} />
                      <label htmlFor="rapidMalaria" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Rapid Malaria (+{servicePriceMap.rapid_malaria ?? 50})
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="rapidTyphoid" checked={wantsTyphoidTest} onCheckedChange={(c) => setWantsTyphoidTest(!!c)} />
                      <label htmlFor="rapidTyphoid" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Rapid Typhoid (+{servicePriceMap.rapid_typhoid ?? 50})
                      </label>
                    </div>
                  </div>
                </div>

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
                  {hasInsurance && insuranceEligible && !selfPayOverride ? (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                      <InsuranceStatusBadge insurance={selectedPatient.insurance} eligibility={insuranceEligibility} compact />
                      <span className="text-sm text-blue-700">Consultation covered — no payment required</span>
                    </div>
                  ) : (isBlocked || isWaitingPeriod || selfPayOverride) ? (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                      <InsuranceStatusBadge insurance={selectedPatient.insurance} coverageType="paid" compact />
                      <span className="text-sm text-amber-700">
                        {isBlocked
                          ? 'Insurance blocked — patient pays consultation out of pocket'
                          : isWaitingPeriod
                            ? 'Waiting period — consultation is self-pay (labs/pharmacy can still use insurance)'
                            : 'Self-pay selected — consultation out of pocket (labs/pharmacy can still use insurance)'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="consultationFee"
                        type="number"
                        value={consultationFee}
                        readOnly
                        className="bg-muted"
                        placeholder="Configured service fee"
                        min="0"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        A paid consultation includes this visit and one follow-up visit.
                      </p>
                    </>
                  )}
                </div>

                {(!hasInsurance || isBlocked || isWaitingPeriod || selfPayOverride) && (
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="orange_money">Orange Money</SelectItem>
                        <SelectItem value="afrimoney">Afrimoney</SelectItem>
                        <SelectItem value="wallet">Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
            disabled={!selectedPatient || checkingBlock || (hasInsurance && eligibilityCheckFailed && !selfPayOverride) || createVisit.isPending || markConsultationPaid.isPending || (isBlocked && !acknowledgedBlock) || (isWaitingPeriod && !selfPayOverride)}
          >
            {createVisit.isPending || markConsultationPaid.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : isBlocked ? (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Visit (Self-Pay Override)
              </>
            ) : hasInsurance && insuranceEligible && !selfPayOverride ? (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Visit (Insurance)
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
