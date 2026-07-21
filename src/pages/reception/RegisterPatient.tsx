import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useCreatePatient } from '@/hooks/usePatients';
import { useInsuranceLookup } from '@/hooks/useInsurance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, ArrowRight, Loader2, Shield, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { patientsAPI } from '@/services/api';

type AgeUnit = 'years' | 'months' | 'weeks' | 'days';

const convertAgeToYears = (ageValue: number, ageUnit: AgeUnit): number => {
  switch (ageUnit) {
    case 'months':
      return Number((ageValue / 12).toFixed(2));
    case 'weeks':
      return Number((ageValue / 52.1429).toFixed(2));
    case 'days':
      return Number((ageValue / 365.25).toFixed(2));
    case 'years':
    default:
      return ageValue;
  }
};

const normalizeSierraLeonePhone = (value: string): string => {
  const digitsOnly = value.replace(/\D/g, '');

  if (!digitsOnly) {
    return '';
  }

  const localDigits = digitsOnly.startsWith('232')
    ? digitsOnly.slice(3)
    : digitsOnly.startsWith('0')
      ? digitsOnly.slice(1)
      : digitsOnly;

  return `+232${localDigits}`;
};

export default function RegisterPatient() {
  const { profile } = useAuth();
  const createPatient = useCreatePatient();
  const navigate = useNavigate();
  const { data: insuranceLookup = [] } = useInsuranceLookup();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    ageUnit: 'years' as AgeUnit,
    gender: '' as 'M' | 'F' | 'O' | '',
    phone: '',
    email: '',
    address: '',
    bloodType: '' as string,
  });

  const [insuranceForm, setInsuranceForm] = useState({
    programCode: '',
    subEntityCode: '',
    memberNumber: '',
    memberName: '',
    responsiblePerson: '',
    responsiblePhone: '',
    responsibleAddress: '',
  });
  const [isInsurancePatient, setIsInsurancePatient] = useState(false);

  type DuplicateMatch = { patientId: string; firstName: string; lastName: string; phone?: string; createdAt: string };
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duplicateRequestRef = useRef(0);

  const checkForDuplicates = useCallback(async (firstName: string, lastName: string, phone: string) => {
    const normalizedPhone = normalizeSierraLeonePhone(phone);
    const hasName = Boolean(firstName && lastName);
    const hasPhone = normalizedPhone.length >= 10;
    if (!hasName && !hasPhone) {
      duplicateRequestRef.current += 1;
      setDuplicateMatches([]);
      setCheckingDuplicates(false);
      return;
    }
    const requestId = ++duplicateRequestRef.current;
    setCheckingDuplicates(true);
    try {
      const matches = await patientsAPI.checkDuplicates({ firstName: hasName ? firstName : undefined, lastName: hasName ? lastName : undefined, phone: hasPhone ? normalizedPhone : undefined });
      if (requestId === duplicateRequestRef.current) setDuplicateMatches(matches || []);
    } catch {
      if (requestId === duplicateRequestRef.current) setDuplicateMatches([]);
    } finally {
      if (requestId === duplicateRequestRef.current) setCheckingDuplicates(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      checkForDuplicates(formData.firstName.trim(), formData.lastName.trim(), formData.phone);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formData.firstName, formData.lastName, formData.phone, checkForDuplicates]);

  const [createdPatient, setCreatedPatient] = useState<{ id?: string; _id?: string; patientId: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.age || !formData.gender || !formData.phone.trim()) {
      toast.error('Please fill in all required fields (phone number is required)');
      return;
    }

    const ageValue = Number(formData.age);
    if (isNaN(ageValue) || ageValue < 0) {
      toast.error('Please enter a valid age value');
      return;
    }

    const normalizedAge = convertAgeToYears(ageValue, formData.ageUnit);
    if (normalizedAge > 150) {
      toast.error('Age exceeds allowed limit (150 years)');
      return;
    }

    try {
      const normalizedPhone = normalizeSierraLeonePhone(formData.phone);

      const newPatient = await createPatient.mutateAsync({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        age: normalizedAge,
        ageValue,
        ageUnit: formData.ageUnit,
        gender: formData.gender as 'M' | 'F' | 'O',
        phone: normalizedPhone || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        bloodType: formData.bloodType || undefined,
        insurance: isInsurancePatient && insuranceForm.programCode ? {
          programCode: insuranceForm.programCode || undefined,
          subEntityCode: insuranceForm.subEntityCode || undefined,
          memberNumber: insuranceForm.memberNumber || undefined,
          memberName: insuranceForm.memberName || undefined,
          responsiblePerson: insuranceForm.responsiblePerson || undefined,
          responsiblePhone: insuranceForm.responsiblePhone || undefined,
          responsibleAddress: insuranceForm.responsibleAddress || undefined,
        } : undefined,
      });

      setCreatedPatient(newPatient);
      toast.success(`Patient registered: ${newPatient.patientId}`);
    } catch (error) {
      console.error('Failed to register patient:', error);
      toast.error('Failed to register patient. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      age: '',
      ageUnit: 'years',
      gender: '',
      phone: '',
      email: '',
      address: '',
      bloodType: '',
    });
    setInsuranceForm({
      programCode: '',
      subEntityCode: '',
      memberNumber: '',
      memberName: '',
      responsiblePerson: '',
      responsiblePhone: '',
      responsibleAddress: '',
    });
    setIsInsurancePatient(false);
    setCreatedPatient(null);
  };

  if (createdPatient) {
    return (
      <RoleLayout 
        title="Patient Registered" 
        subtitle="Registration successful"
        role="receptionist"
        userName={profile?.fullName}
      >
        <div className="max-w-lg mx-auto">
          <div className="bg-card border rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-status-normal/10 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-status-normal" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Registration Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Patient has been successfully registered in the system.
            </p>
            
            <div className="bg-muted rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">Patient ID</p>
              <p className="text-2xl font-mono font-bold text-primary">
                {createdPatient.patientId}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {formData.firstName} {formData.lastName}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetForm} className="flex-1">
                Register Another
              </Button>
              <Button
                onClick={() => {
                  const patientObjectId = createdPatient.id || createdPatient._id;
                  if (!patientObjectId) {
                    toast.error('Patient record is missing ID');
                    return;
                  }
                  navigate(`/reception/visit-registration?patient=${patientObjectId}`);
                }}
                className="flex-1"
              >
                Create Visit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout 
      title="Register Patient" 
      subtitle="Add a new patient to the system"
      role="receptionist"
      userName={profile?.fullName}
    >
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Enter first name"
                required
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Enter last name"
                required
              />
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label htmlFor="age">Age *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="age"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.age}
                  onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  placeholder="Enter value"
                  required
                />
                <Select
                  value={formData.ageUnit}
                  onValueChange={value => setFormData(prev => ({ ...prev, ageUnit: value as AgeUnit }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="years">Years</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <Checkbox
                id="isInsurancePatient"
                checked={isInsurancePatient}
                onCheckedChange={(checked) => {
                  const isOn = checked === true;
                  setIsInsurancePatient(isOn);
                  if (isOn) {
                    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
                    setInsuranceForm(prev => ({
                      ...prev,
                      memberName: prev.memberName || fullName,
                      responsiblePhone: prev.responsiblePhone || formData.phone || '',
                    }));
                  }
                }}
              />
              <div>
                <Label htmlFor="isInsurancePatient" className="cursor-pointer font-medium">This is an insurance patient</Label>
                <p className="text-xs text-muted-foreground">Select this to enter the patient’s insurance details.</p>
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select 
                value={formData.gender} 
                onValueChange={value => setFormData(prev => ({ ...prev, gender: value as 'M' | 'F' | 'O' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                  <SelectItem value="O">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <div className="flex items-center rounded-md border bg-background">
                <span className="px-3 text-sm text-muted-foreground border-r">+232</span>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="XXXXXXXX"
                  className="border-0 focus-visible:ring-0"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="patient@email.com"
              />
            </div>

            {/* Address */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter address"
              />
            </div>

            {/* Blood Type */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bloodType">Blood Type</Label>
              <Select
                value={formData.bloodType}
                onValueChange={value => setFormData(prev => ({ ...prev, bloodType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Insurance Section */}
            {isInsurancePatient && (
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Shield className="w-4 h-4" />
                Insurance Details
              </div>
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Insurance Program</Label>
                      <Select
                        value={insuranceForm.programCode}
                        onValueChange={(val) => setInsuranceForm(prev => ({ ...prev, programCode: val, subEntityCode: '' }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select program" />
                        </SelectTrigger>
                        <SelectContent>
                          {insuranceLookup.map((prog) => (
                            <SelectItem key={prog._id} value={prog.code}>{prog.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Sub-Entity / Employer</Label>
                      <Select
                        value={insuranceForm.subEntityCode}
                        onValueChange={(val) => setInsuranceForm(prev => ({ ...prev, subEntityCode: val }))}
                        disabled={!insuranceForm.programCode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={insuranceForm.programCode ? "Select sub-entity" : "Select program first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {insuranceLookup
                            .find(p => p.code === insuranceForm.programCode)
                            ?.subEntities?.map((sub) => (
                              <SelectItem key={sub._id} value={sub.code}>{sub.name}</SelectItem>
                            )) || []}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Member Number</Label>
                      <Input
                        value={insuranceForm.memberNumber}
                        onChange={(e) => setInsuranceForm(prev => ({ ...prev, memberNumber: e.target.value }))}
                        placeholder="Policy/member ID"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Member Name</Label>
                      <Input
                        value={insuranceForm.memberName}
                        onChange={(e) => setInsuranceForm(prev => ({ ...prev, memberName: e.target.value }))}
                        placeholder="Name on insurance card"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Person Responsible</Label>
                      <Input
                        value={insuranceForm.responsiblePerson}
                        onChange={(e) => setInsuranceForm(prev => ({ ...prev, responsiblePerson: e.target.value }))}
                        placeholder="Employee / primary insured"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Responsible Phone</Label>
                      <Input
                        value={insuranceForm.responsiblePhone}
                        onChange={(e) => setInsuranceForm(prev => ({ ...prev, responsiblePhone: e.target.value }))}
                        placeholder="Contact number"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Responsible Address</Label>
                    <Input
                      value={insuranceForm.responsibleAddress}
                      onChange={(e) => setInsuranceForm(prev => ({ ...prev, responsibleAddress: e.target.value }))}
                      placeholder="Address of responsible person"
                    />
                  </div>
                </div>
            </div>
            )}
          </div>

          {checkingDuplicates && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking for existing patients…
            </div>
          )}

          {duplicateMatches.length > 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-800">
                    {duplicateMatches.length} potential duplicate{duplicateMatches.length > 1 ? 's' : ''} found
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    A patient with similar details may already exist. Please review before registering.
                  </p>
                  <div className="mt-3 space-y-2">
                    {duplicateMatches.map((match) => (
                      <div key={match.patientId} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between bg-white rounded-md px-3 py-2 border border-amber-100 text-sm">
                        <div>
                          <span className="font-medium">{match.firstName} {match.lastName}</span>
                          {match.phone && <span className="sm:ml-2 text-muted-foreground break-all">{match.phone}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{match.patientId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button type="button" variant="outline" onClick={() => navigate('/reception')}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPatient.isPending}>
              {createPatient.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Register Patient
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </RoleLayout>
  );
}

