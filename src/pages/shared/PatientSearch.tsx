import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useSearchPatients } from '@/hooks/usePatients';
import { getPatientAgeDisplay, getPatientFullName } from '@/utils/orderHelpers';
import { UserRole } from '@/types/lis';

const roleTitle: Partial<Record<UserRole, string>> = {
  doctor: 'Patient History',
  nurse: 'Patients',
  pharmacist: 'Patients',
  lab_tech: 'Patients',
  admin: 'Patients',
  receptionist: 'Patients',
};

export default function PatientSearch() {
  const navigate = useNavigate();
  const { profile, primaryRole } = useAuth();
  const role = (primaryRole || 'doctor') as UserRole;
  const [searchTerm, setSearchTerm] = useState('');
  const { data: patients = [], isLoading } = useSearchPatients(searchTerm);

  return (
    <RoleLayout
      title={roleTitle[role] || 'Patients'}
      subtitle="Find a patient record and review clinical history"
      role={role}
      userName={profile?.fullName}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, hospital number, or phone..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Hospital No.</th>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Registered</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient: any) => {
                const patientObjectId = patient.id || patient._id;
                return (
                  <tr key={patientObjectId || patient.patientId}>
                    <td className="font-mono text-sm">{patient.patientId}</td>
                    <td className="font-medium">{getPatientFullName(patient)}</td>
                    <td>{getPatientAgeDisplay(patient)}</td>
                    <td>
                      <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                        {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{patient.phone || '-'}</td>
                    <td className="text-sm text-muted-foreground">
                      {patient.createdAt ? format(new Date(patient.createdAt), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!patientObjectId}
                        onClick={() => navigate(`/patient/${patientObjectId}`)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!patients.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    No patients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </RoleLayout>
  );
}

