import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useCreatePatient } from '@/hooks/usePatients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, ArrowRight, Loader2 } from 'lucide-react';

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

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    ageUnit: 'years' as AgeUnit,
    gender: '' as 'M' | 'F' | 'O' | '',
    phone: '',
    email: '',
    address: '',
  });

  const [createdPatient, setCreatedPatient] = useState<{ id: string; patientId: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.age || !formData.gender) {
      toast.error('Please fill in all required fields');
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
    });
    setCreatedPatient(null);
  };

  if (createdPatient) {
    return (
      <RoleLayout 
        title="Patient Registered" 
        subtitle="Registration successful"
        role="receptionist"
        userName={profile?.full_name}
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
                  navigate(`/reception/new-order?patient=${patientObjectId}`);
                }}
                className="flex-1"
              >
                Create Order
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
      userName={profile?.full_name}
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
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex items-center rounded-md border bg-background">
                <span className="px-3 text-sm text-muted-foreground border-r">+232</span>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                  placeholder="XXXXXXXX"
                  className="border-0 focus-visible:ring-0"
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
          </div>

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
