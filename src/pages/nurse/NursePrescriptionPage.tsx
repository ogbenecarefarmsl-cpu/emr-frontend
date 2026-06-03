import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { medicationService } from '@/services/medicationService';
import { prescriptionService, CreatePrescriptionItemInput } from '@/services/prescriptionService';
import { visitsAPI } from '@/services/api';
import { RouteOfAdministrationEnum } from '@/types/prescription';
import { Loader2, Pill, Plus, Search, Send, Trash2 } from 'lucide-react';

const CLOSED_VISIT_STATUSES = new Set(['completed', 'cancelled']);

const ROUTE_LABELS: Record<RouteOfAdministrationEnum, string> = {
  oral: 'Oral',
  sublingual: 'Sublingual',
  topical: 'Topical',
  intravenous: 'IV',
  intramuscular: 'IM',
  subcutaneous: 'Subcutaneous',
  inhalation: 'Inhalation',
  rectal: 'Rectal',
  ophthalmic: 'Eye drops',
  otic: 'Ear drops',
  nasal: 'Nasal',
  other: 'Other',
};

interface SelectedMed extends CreatePrescriptionItemInput {
  unitPrice: number;
  stockQuantity?: number;
}

const patientName = (visit: any) => {
  const patient = visit?.patientId || visit?.patient;
  return `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unnamed patient';
};

const patientId = (visit: any) => {
  const patient = visit?.patientId || visit?.patient;
  return typeof patient === 'string' ? patient : patient?._id || patient?.id || '';
};

export default function NursePrescriptionPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [visitId, setVisitId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMedicationPickerOpen, setIsMedicationPickerOpen] = useState(false);
  const [selectedMeds, setSelectedMeds] = useState<SelectedMed[]>([]);
  const [notes, setNotes] = useState('');

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['visits', 'nurse-prescription-candidates'],
    queryFn: () => visitsAPI.getAll({ limit: 200 }),
    staleTime: 15 * 1000,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['medications', 'nurse-search', searchTerm],
    queryFn: () => medicationService.search(searchTerm),
    enabled: searchTerm.trim().length > 2,
  });

  const { data: allMedicationOptions = [], isLoading: medicationsLoading } = useQuery({
    queryKey: ['medications', 'nurse-all-options'],
    queryFn: () => medicationService.findAll(),
    staleTime: 60 * 1000,
  });

  const activeVisits = useMemo(() => {
    const list = Array.isArray(visits) ? visits : visits?.data || [];
    return list
      .filter((visit: any) => !CLOSED_VISIT_STATUSES.has((visit.status || '').toLowerCase()))
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [visits]);

  const selectedVisit = activeVisits.find((visit: any) => (visit._id || visit.id) === visitId);
  const selectedPatientId = patientId(selectedVisit);

  const totalAmount = selectedMeds.reduce((sum, med) => sum + med.unitPrice * med.quantity, 0);

  const medicationOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const byId = new Map<string, any>();

    [...searchResults, ...allMedicationOptions].forEach((med: any) => {
      if (med?._id) byId.set(med._id, med);
    });

    const list = Array.from(byId.values());
    const filtered = term
      ? list.filter((med: any) => {
          const packText = Array.isArray(med.packSizes)
            ? med.packSizes.map((pack: any) => `${pack.name || ''} ${pack.unit || ''} ${pack.barcode || ''}`).join(' ')
            : '';
          const searchable = [
            med.name,
            med.genericName,
            med.medicationCode,
            med.category,
            med.strength,
            med.dosageForm,
            med.unit,
            packText,
          ].join(' ').toLowerCase();
          return searchable.includes(term);
        })
      : list;

    return filtered
      .sort((a: any, b: any) => {
        const aStock = Number(a.stockQuantity || 0) > 0 ? 0 : 1;
        const bStock = Number(b.stockQuantity || 0) > 0 ? 0 : 1;
        if (aStock !== bStock) return aStock - bStock;
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
      .slice(0, 80);
  }, [allMedicationOptions, searchResults, searchTerm]);

  const createPrescription = useMutation({
    mutationFn: async () => {
      if (!selectedVisit || !selectedPatientId) throw new Error('Select a patient visit before prescribing');
      if (selectedMeds.length === 0) throw new Error('Add at least one medication');

      for (const med of selectedMeds) {
        if (!med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()) {
          throw new Error(`Complete dosage, frequency and duration for ${med.medicationName}`);
        }
        if (med.quantity < 1) throw new Error(`Quantity for ${med.medicationName} must be at least 1`);
      }

      return prescriptionService.create({
        patientId: selectedPatientId,
        visitId,
        items: selectedMeds.map(({ unitPrice, stockQuantity, ...item }) => ({
          ...item,
          instructions: item.instructions?.trim() || undefined,
          pharmacistNote: item.pharmacistNote?.trim() || undefined,
        })),
        notes: notes.trim() || undefined,
        totalAmount: Math.round(totalAmount * 100) / 100,
      });
    },
    onSuccess: (prescription: any) => {
      toast.success(`${prescription?.prescriptionNumber || 'Prescription'} sent to reception for payment`);
      setSelectedMeds([]);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['prescriptions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to create prescription');
    },
  });

  const addMedication = (med: any) => {
    if (selectedMeds.some((item) => item.medicationId === med._id)) {
      toast.error(`${med.name} is already added`);
      return;
    }
    setSelectedMeds((current) => [
      ...current,
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
        unitPrice: Number(med.unitPrice || 0),
        stockQuantity: med.stockQuantity,
      },
    ]);
    setSearchTerm('');
    setIsMedicationPickerOpen(false);
  };

  const updateMedication = (index: number, field: keyof SelectedMed, value: any) => {
    setSelectedMeds((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  return (
    <RoleLayout
      title="Nurse Prescribing"
      subtitle="Write prescriptions for active visits; reception collects payment and dispenses"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Patient Visit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Active visit</Label>
                <Select value={visitId} onValueChange={setVisitId}>
                  <SelectTrigger>
                    <SelectValue placeholder={visitsLoading ? 'Loading active visits' : 'Select patient visit'} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeVisits.map((visit: any) => (
                      <SelectItem key={visit._id || visit.id} value={visit._id || visit.id}>
                        {patientName(visit)} - {visit.visitNumber || 'No visit number'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedVisit && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{patientName(selectedVisit)}</span>
                    <Badge variant="outline">{selectedVisit.visitNumber}</Badge>
                    <Badge variant="secondary" className="capitalize">{(selectedVisit.status || '').replace(/_/g, ' ')}</Badge>
                  </div>
                  {selectedVisit.chiefComplaint && <p className="mt-2 text-muted-foreground">{selectedVisit.chiefComplaint}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Add Medications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setIsMedicationPickerOpen(true);
                  }}
                  onFocus={() => setIsMedicationPickerOpen(true)}
                  placeholder="Search by drug name, generic, brand, SKU, strength..."
                  className="pl-9"
                />
                {isMedicationPickerOpen && (
                  <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border bg-background shadow-xl">
                    {(searchLoading || medicationsLoading) && (
                      <p className="p-3 text-sm text-muted-foreground">Loading products...</p>
                    )}
                    {!searchLoading && !medicationsLoading && medicationOptions.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">No medications or CAF products found</p>
                    )}
                    {medicationOptions.map((med: any) => (
                    <button
                      key={med._id}
                      type="button"
                      onClick={() => addMedication(med)}
                      className="flex w-full items-center justify-between gap-3 border-b p-3 text-left last:border-b-0 hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{med.name}</p>
                          {med.__cafProduct && <Badge variant="secondary">CAF</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {med.genericName || med.medicationCode || 'Medication'} {med.strength ? `- ${med.strength}` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {med.medicationCode || 'No code'} {med.unit ? `- ${med.unit}` : ''} {med.category ? `- ${med.category}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={Number(med.stockQuantity || 0) > 0 ? 'outline' : 'destructive'}>
                          {Number(med.stockQuantity || 0).toLocaleString()} stock
                        </Badge>
                        <Plus className="h-4 w-4" />
                      </div>
                    </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedMeds.length > 0 && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Medication Orders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedMeds.map((med, index) => (
                  <div key={med.medicationId} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{med.medicationName}</p>
                        <p className="text-sm text-muted-foreground">Le {med.unitPrice.toLocaleString()} per unit</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedMeds((current) => current.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Dosage</Label>
                        <Input value={med.dosage} onChange={(event) => updateMedication(index, 'dosage', event.target.value)} placeholder="500mg, 1 tablet" />
                      </div>
                      <div className="space-y-1">
                        <Label>Frequency</Label>
                        <Input value={med.frequency} onChange={(event) => updateMedication(index, 'frequency', event.target.value)} placeholder="3 times daily" />
                      </div>
                      <div className="space-y-1">
                        <Label>Duration</Label>
                        <Input value={med.duration} onChange={(event) => updateMedication(index, 'duration', event.target.value)} placeholder="7 days" />
                      </div>
                      <div className="space-y-1">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={med.quantity}
                          onChange={(event) => updateMedication(index, 'quantity', Math.max(1, Number(event.target.value)))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Route</Label>
                        <Select value={med.route || RouteOfAdministrationEnum.ORAL} onValueChange={(value) => updateMedication(index, 'route', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROUTE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Pharmacist note</Label>
                        <Input value={med.pharmacistNote || ''} onChange={(event) => updateMedication(index, 'pharmacistNote', event.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Patient instructions</Label>
                      <Textarea
                        value={med.instructions || ''}
                        onChange={(event) => updateMedication(index, 'instructions', event.target.value)}
                        placeholder="Leave blank to auto-generate from dosage, frequency, duration and route"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="h-5 w-5 text-primary" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>General notes</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between text-sm">
                <span>Medications</span>
                <Badge variant="outline">{selectedMeds.length}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Patient pays at reception</span>
                <span className="font-semibold">Le {totalAmount.toLocaleString()}</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => createPrescription.mutate()}
              disabled={createPrescription.isPending || !selectedVisit || selectedMeds.length === 0}
            >
              {createPrescription.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send To Reception
            </Button>
          </CardContent>
        </Card>
      </div>
    </RoleLayout>
  );
}
