import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { medicationService } from '@/services/medicationService';
import { prescriptionService } from '@/services/prescriptionService';
import { consultationService } from '@/services/consultationService';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Search, Pill, Plus, Trash2 } from 'lucide-react';

const PrescriptionForm = () => {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeds, setSelectedMeds] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  const { data: consultation } = useQuery({
    queryKey: ['consultation', consultationId],
    queryFn: () => consultationService.findById(consultationId!),
    enabled: !!consultationId,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['medications', 'search', searchTerm],
    queryFn: () => medicationService.search(searchTerm),
    enabled: searchTerm.length > 2,
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: (data: any) => prescriptionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      toast({ title: 'Success', description: 'Prescription created successfully' });
      navigate('/doctor');
    },
  });

  const addMedication = (med: any) => {
    setSelectedMeds([
      ...selectedMeds,
      {
        medicationId: med._id,
        medicationName: med.name,
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        instructions: '',
        unitPrice: med.unitPrice,
      },
    ]);
    setSearchTerm('');
  };

  const updateMedication = (index: number, field: string, value: any) => {
    const updated = [...selectedMeds];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedMeds(updated);
  };

  const removeMedication = (index: number) => {
    setSelectedMeds(selectedMeds.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultationId || selectedMeds.length === 0) return;

    // Calculate total from medication prices
    const totalAmount = selectedMeds.reduce((sum, med) => {
      // Find medication to get its price
      const medDetail = searchResults.find((m: any) => m._id === med.medicationId);
      const price = medDetail?.unitPrice || 0;
      return sum + (price * med.quantity);
    }, 0);

    createPrescriptionMutation.mutate({
      patientId: consultation?.patientId?._id,
      consultationId,
      doctorId: consultation?.doctorId?._id,
      items: selectedMeds,
      notes,
      totalAmount: Math.round(totalAmount * 100) / 100,
    });
  };

  return (
    <RoleLayout title="Create Prescription" subtitle="Write medication orders from consultation" role="doctor">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create Prescription</h1>
          {consultation && (
            <p className="text-muted-foreground">
              Patient: {consultation.patientId?.firstName} {consultation.patientId?.lastName}
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Medications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search medications by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.map((med: any) => (
                    <div
                      key={med._id}
                      className="p-3 hover:bg-gray-100 cursor-pointer border-b flex justify-between items-center"
                      onClick={() => addMedication(med)}
                    >
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-gray-500">
                          {med.medicationCode} - {med.strength}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={med.stockQuantity > 0 ? 'default' : 'destructive'}>
                          {med.stockQuantity} in stock
                        </Badge>
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedMeds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prescribed Medications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedMeds.map((med, index) => (
                  <div key={index} className="border p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold">{med.medicationName}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMedication(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Dosage</Label>
                        <Input
                          placeholder="e.g., 500mg"
                          value={med.dosage}
                          onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Frequency</Label>
                        <Input
                          placeholder="e.g., 3 times daily"
                          value={med.frequency}
                          onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Duration</Label>
                        <Input
                          placeholder="e.g., 7 days"
                          value={med.duration}
                          onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={med.quantity}
                          onChange={(e) =>
                            updateMedication(index, 'quantity', Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Instructions</Label>
                      <Input
                        placeholder="Special instructions..."
                        value={med.instructions}
                        onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Additional prescription notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={createPrescriptionMutation.isPending || selectedMeds.length === 0}
            className="flex-1"
          >
            <Pill className="w-4 h-4 mr-2" />
            {createPrescriptionMutation.isPending ? 'Creating...' : 'Create Prescription'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/doctor')}>
            Cancel
          </Button>
        </div>
      </div>
    </RoleLayout>
  );
};

export default PrescriptionForm;
