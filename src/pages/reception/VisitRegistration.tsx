import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateVisit, useMarkConsultationPaid } from '@/hooks/useVisits';
import { useSearchPatients } from '@/hooks/usePatients';
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
import { Loader2, Search, UserPlus, Stethoscope, ArrowLeft } from 'lucide-react';

export default function VisitRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patient');
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [visitType, setVisitType] = useState<string>('new');
  const [consultationFee, setConsultationFee] = useState<string>('5000');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');

  const { data: searchResults = [], isLoading: searchLoading } = useSearchPatients(searchTerm);
  const { data: allPatients = [] } = useSearchPatients('');
  const createVisit = useCreateVisit();
  const markConsultationPaid = useMarkConsultationPaid();

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
      const visit = await createVisit.mutateAsync({
        patientId: selectedPatient._id || selectedPatient.id,
        visitType: visitType as any,
        consultationFee: parseFloat(consultationFee),
        chiefComplaint,
        notes,
      });

      await markConsultationPaid.mutateAsync({ visitId: visit._id || visit.id, paymentMethod: 'cash' });
      toast.success('Consultation payment confirmed. Patient sent to doctor queue.');
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
                  <Label htmlFor="consultationFee">Consultation Fee (Le)</Label>
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
