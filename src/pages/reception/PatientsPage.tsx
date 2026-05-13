import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useSearchPatients, useCreatePatient, useDeletePatient } from '@/hooks/usePatients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {Search, Plus, Eye, ClipboardList, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { getPatientAgeDisplay, getPatientFullName } from '@/utils/orderHelpers';

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

const formatAgeDisplay = (patient: { age: number; ageValue?: number; ageUnit?: AgeUnit }) => {
  return getPatientAgeDisplay(patient);
};

export default function PatientsPage() {
  const { profile, primaryRole } = useAuth();
  const currentRole = primaryRole === 'admin' ? 'admin' : primaryRole === 'lab_tech' ? 'lab_tech' : 'receptionist';
  const navigate = useNavigate();
  const isAdmin = primaryRole === 'admin';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  
  const { data: patients, isLoading } = useSearchPatients(searchTerm);
  const createPatient = useCreatePatient();
  const deletePatient = useDeletePatient();

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

  const handleCreatePatient = async () => {
    if (!formData.firstName || !formData.lastName || !formData.age || !formData.gender) {
      toast.error('Please fill in required fields');
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
      const result = await createPatient.mutateAsync({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        age: normalizedAge,
        ageValue,
        ageUnit: formData.ageUnit,
        gender: formData.gender,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
      });

      toast.success(`Patient registered: ${result.patientId}`);
      setShowAddDialog(false);
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
    } catch (error) {
      toast.error('Failed to register patient');
    }
  };

  const handleDeletePatient = async () => {
    if (!deleteConfirmId) return;
    try {
      await deletePatient.mutateAsync(deleteConfirmId);
      toast.success('Patient deleted');
      setDeleteConfirmId(null);
    } catch {
      toast.error('Failed to delete patient');
    }
  };

  return (
    <RoleLayout 
      title="Patients" 
      subtitle="Search and manage patient records"
      role={currentRole}
      userName={profile?.full_name}
    >
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, ID, or phone..." 
            className="pl-10 w-96"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Register Patient
        </Button>
      </div>

      {/* Patients Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients?.map(patient => (
                <tr key={patient.id || patient._id}>
                  <td className="font-mono text-sm">{patient.patientId}</td>
                  <td className="font-medium">
                    {getPatientFullName(patient)}
                  </td>
                  <td>{formatAgeDisplay(patient)}</td>
                  <td>
                    <span className="px-2 py-1 bg-muted rounded text-xs font-medium">
                      {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{patient.phone || '-'}</td>
                  <td className="text-muted-foreground text-sm">
                    {format(new Date(patient.createdAt), 'MMM dd, yyyy')}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const patientObjectId = patient.id || patient._id;
                          if (!patientObjectId) {
                            toast.error('Patient record is missing ID');
                            return;
                          }

                          navigate(
                            currentRole === 'lab_tech'
                              ? `/lab/patients/${patientObjectId}`
                              : currentRole === 'admin'
                                ? `/admin/patients/${patientObjectId}`
                                : `/reception/patients/${patientObjectId}`,
                          );
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          const patientObjectId = patient.id || patient._id;
                          if (!patientObjectId) {
                            toast.error('Patient record is missing ID');
                            return;
                          }
                          navigate(`/reception/new-order?patient=${patientObjectId}`);
                        }}
                      >
                        <ClipboardList className="w-4 h-4 mr-1" />
                        Order
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-status-critical hover:text-status-critical hover:bg-status-critical/10"
                          onClick={() => {
                            setDeleteConfirmId(patient.id);
                            setDeleteConfirmName(getPatientFullName(patient));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!patients || patients.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No patients found matching your search' : 'No patients registered yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Patient Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input 
                value={formData.firstName}
                onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Enter first name"
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input 
                value={formData.lastName}
                onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Enter last name"
              />
            </div>
            <div className="space-y-2">
              <Label>Age *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input 
                  type="number"
                  min="0"
                  step="1"
                  value={formData.age}
                  onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  placeholder="Enter value"
                />
                <Select value={formData.ageUnit} onValueChange={v => setFormData(prev => ({ ...prev, ageUnit: v as AgeUnit }))}>
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
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select value={formData.gender} onValueChange={v => setFormData(prev => ({ ...prev, gender: v as 'M' | 'F' | 'O' }))}>
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
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input 
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+234 XXX XXX XXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="patient@email.com"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Address</Label>
              <Input 
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter address"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePatient} disabled={createPatient.isPending}>
              {createPatient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Register Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Patient</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteConfirmName}</strong>? This action cannot be undone and will remove all associated records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeletePatient}
              disabled={deletePatient.isPending}
            >
              {deletePatient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
