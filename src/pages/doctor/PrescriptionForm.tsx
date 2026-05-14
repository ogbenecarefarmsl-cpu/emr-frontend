import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { medicationService } from '@/services/medicationService';
import { prescriptionService, CreatePrescriptionItemInput } from '@/services/prescriptionService';
import { consultationService } from '@/services/consultationService';
import { RouteOfAdministrationEnum } from '@/types/prescription';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Search, Pill, Plus, Trash2, Info } from 'lucide-react';

const ROUTE_LABELS: Record<RouteOfAdministrationEnum, string> = {
  oral: 'Oral (by mouth)',
  sublingual: 'Sublingual (under tongue)',
  topical: 'Topical (skin)',
  intravenous: 'Intravenous (IV)',
  intramuscular: 'Intramuscular (IM)',
  subcutaneous: 'Subcutaneous (SC)',
  inhalation: 'Inhalation',
  rectal: 'Rectal',
  ophthalmic: 'Ophthalmic (eye drops)',
  otic: 'Otic (ear drops)',
  nasal: 'Nasal',
  other: 'Other',
};

interface SelectedMed extends CreatePrescriptionItemInput {
  unitPrice: number;
}

const PrescriptionForm = () => {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeds, setSelectedMeds] = useState<SelectedMed[]>([]);
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
      toast({ title: 'Prescription created', description: 'Patient sent to pharmacy queue.' });
      navigate('/doctor');
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to create prescription',
        description: err?.response?.data?.message || 'Please check all fields.',
        variant: 'destructive',
      });
    },
  });

  const addMedication = (med: any) => {
    // Don't add duplicates
    if (selectedMeds.some((m) => m.medicationId === med._id)) {
      toast({ title: 'Already added', description: `${med.name} is already in the prescription.` });
      return;
    }
    setSelectedMeds([
      ...selectedMeds,
      {
        medicationId: med._id,
        medicationName: med.name,
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        route: RouteOfAdministrationEnum.ORAL,
        instructions: '',
        pharmacistNote: '',
        unitPrice: med.unitPrice || 0,
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

  const totalAmount = selectedMeds.reduce(
    (sum, med) => sum + med.unitPrice * med.quantity,
    0,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultationId || selectedMeds.length === 0) return;

    // Validate required fields
    for (const med of selectedMeds) {
      if (!med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()) {
        toast({
          title: 'Incomplete prescription',
          description: `Please fill in dosage, frequency, and duration for ${med.medicationName}.`,
          variant: 'destructive',
        });
        return;
      }
      if (med.quantity < 1) {
        toast({
          title: 'Invalid quantity',
          description: `Quantity for ${med.medicationName} must be at least 1.`,
          variant: 'destructive',
        });
        return;
      }
    }

    createPrescriptionMutation.mutate({
      patientId: consultation?.patientId?._id,
      consultationId,
      visitId: consultation?.visitId,
      doctorId: consultation?.doctorId?._id,
      items: selectedMeds.map(({ unitPrice, ...item }) => ({
        ...item,
        // Strip empty optional strings so backend doesn't store blanks
        instructions: item.instructions?.trim() || undefined,
        pharmacistNote: item.pharmacistNote?.trim() || undefined,
      })),
      notes: notes.trim() || undefined,
      totalAmount: Math.round(totalAmount * 100) / 100,
    });
  };

  return (
    <RoleLayout title="Create Prescription" subtitle="Write medication orders for patient" role="doctor">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create Prescription</h1>
          {consultation && (
            <p className="text-muted-foreground">
              Patient:{' '}
              <span className="font-medium">
                {consultation.patientId?.firstName} {consultation.patientId?.lastName}
              </span>
            </p>
          )}
        </div>

        {/* Medication search */}
        <Card>
          <CardHeader>
            <CardTitle>Add Medications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search medications by name, generic name, or code..."
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
                          {med.genericName} · {med.medicationCode}
                          {med.strength ? ` · ${med.strength}` : ''}
                          {med.dosageForm ? ` · ${med.dosageForm}` : ''}
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

        {/* Prescribed medications */}
        {selectedMeds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prescribed Medications ({selectedMeds.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {selectedMeds.map((med, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    {/* Medication header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-base">{med.medicationName}</p>
                        {med.unitPrice > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Le {med.unitPrice.toLocaleString()} / unit
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMedication(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>

                    {/* Core fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>
                          Dosage <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="e.g. 500mg, 1 tablet, 5ml"
                          value={med.dosage}
                          onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>
                          Frequency <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="e.g. 3 times daily, every 8 hours"
                          value={med.frequency}
                          onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>
                          Duration <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="e.g. 7 days, 2 weeks"
                          value={med.duration}
                          onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>
                          Quantity (units to dispense) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={med.quantity}
                          onChange={(e) =>
                            updateMedication(index, 'quantity', Math.max(1, Number(e.target.value)))
                          }
                        />
                      </div>
                    </div>

                    {/* Route of administration */}
                    <div>
                      <Label>Route of Administration</Label>
                      <Select
                        value={med.route || RouteOfAdministrationEnum.ORAL}
                        onValueChange={(v) => updateMedication(index, 'route', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROUTE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Patient-facing instructions */}
                    <div>
                      <Label className="flex items-center gap-1">
                        Patient Instructions (printed on label)
                        <span className="text-xs text-muted-foreground font-normal">
                          — leave blank to auto-generate
                        </span>
                      </Label>
                      <Textarea
                        placeholder={`e.g. Take 1 tablet by mouth 3 times daily with food for 7 days`}
                        value={med.instructions}
                        onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>

                    {/* Pharmacist note */}
                    <div>
                      <Label className="flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        Pharmacist Note
                        <span className="text-xs text-muted-foreground font-normal">
                          — internal only, not printed on label
                        </span>
                      </Label>
                      <Input
                        placeholder="e.g. Counsel patient on photosensitivity. Refrigerate after opening."
                        value={med.pharmacistNote}
                        onChange={(e) => updateMedication(index, 'pharmacistNote', e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                {/* Running total */}
                {totalAmount > 0 && (
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Estimated Total</p>
                      <p className="text-xl font-bold">Le {totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* General notes */}
        <Card>
          <CardHeader>
            <CardTitle>
              General Notes
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — visible to pharmacist and patient
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g. Complete the full course even if symptoms improve. Return if rash develops."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
