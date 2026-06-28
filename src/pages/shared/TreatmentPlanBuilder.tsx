import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MedicationPicker } from '@/components/medications/MedicationPicker';
import {
  buildSmartInstruction,
  buildSmartRegimen,
  computeMedicationQuantity,
  getMedicationBaseUnit,
  getMedicationPrice,
  getMedicationStock,
  isParenteralOrInfusion,
  type MedicationLike,
} from '@/lib/medicationIntelligence';
import { medicationService } from '@/services/medicationService';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import type { CreateTreatmentPlanItemInput } from '@/types/treatment-plan';
import { visitsAPI, ordersAPI } from '@/services/api';
import { Loader2, Pill, Plus, Search, Send, Trash2, Beaker, Scissors, FileText, FlaskConical } from 'lucide-react';

const CLOSED_VISIT_STATUSES = new Set(['completed', 'cancelled']);

const ROUTE_OPTIONS = [
  { value: 'oral', label: 'Oral' },
  { value: 'intravenous', label: 'IV' },
  { value: 'intramuscular', label: 'IM' },
  { value: 'subcutaneous', label: 'SC' },
  { value: 'topical', label: 'Topical' },
  { value: 'inhalation', label: 'Inhalation' },
  { value: 'rectal', label: 'Rectal' },
  { value: 'ophthalmic', label: 'Eye drops' },
  { value: 'otic', label: 'Ear drops' },
  { value: 'nasal', label: 'Nasal' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'other', label: 'Other' },
];

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  drug: { label: 'Drug', icon: Pill, color: 'bg-blue-100 text-blue-700' },
  iv: { label: 'IV', icon: FlaskConical, color: 'bg-purple-100 text-purple-700' },
  lab: { label: 'Lab Test', icon: Beaker, color: 'bg-green-100 text-green-700' },
  procedure: { label: 'Procedure', icon: Scissors, color: 'bg-orange-100 text-orange-700' },
  other: { label: 'Other', icon: FileText, color: 'bg-gray-100 text-gray-700' },
};

const patientName = (visit: any) => {
  const patient = visit?.patientId || visit?.patient;
  return `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unnamed patient';
};

const patientIdStr = (visit: any) => {
  const patient = visit?.patientId || visit?.patient;
  return typeof patient === 'string' ? patient : patient?._id || patient?.id || '';
};

interface TreatmentPlanBuilderProps {
  /** Pre-selected visit ID (optional — if not provided, user selects from list) */
  preselectedVisitId?: string;
  /** Pre-selected patient ID for plans not tied to a visit */
  preselectedPatientId?: string;
  /** Pre-selected patient name for display */
  preselectedPatientName?: string;
  /** Called after plan is created successfully */
  onPlanCreated?: () => void;
  /** Show as inline form (no Card wrapper) */
  inline?: boolean;
}

export function TreatmentPlanBuilder({ preselectedVisitId, preselectedPatientId, preselectedPatientName, onPlanCreated, inline }: TreatmentPlanBuilderProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [visitId, setVisitId] = useState(preselectedVisitId || '');
  const [activeTab, setActiveTab] = useState('drug');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CreateTreatmentPlanItemInput[]>([]);

  // Drug/IV form state
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [strengthPerDose, setStrengthPerDose] = useState('1 tablet');
  const [dosesPerDay, setDosesPerDay] = useState(3);
  const [durationDays, setDurationDays] = useState(7);
  const [route, setRoute] = useState('oral');
  const [itemType, setItemType] = useState<'drug' | 'iv'>('drug');

  // Lab form state
  const [labSearch, setLabSearch] = useState('');
  const [selectedLab, setSelectedLab] = useState<any>(null);

  // Procedure/Other form state
  const [procedureForm, setProcedureForm] = useState({ name: '', amount: 0, notes: '' });
  const [otherForm, setOtherForm] = useState({ description: '', amount: 0, notes: '' });
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  // Fetch visits (only when no preselected patient)
  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['visits', 'tp-candidates'],
    queryFn: () => visitsAPI.getAll({ limit: 200 }),
    staleTime: 15_000,
    enabled: !preselectedPatientId,
  });

  // Fetch all medications for dropdown
  const { data: allMedications = [], isLoading: medsLoading } = useQuery({
    queryKey: ['medications', 'tp-all'],
    queryFn: () => medicationService.findAll(),
    staleTime: 60_000,
  });

  // Fetch LIS catalog for lab tests
  const { data: lisCatalog = [] } = useQuery({
    queryKey: ['lis-catalog'],
    queryFn: () => ordersAPI.getLisCatalog(),
    staleTime: 60_000,
  });

  const activeVisits = useMemo(() => {
    const list = Array.isArray(visits) ? visits : visits?.data || [];
    return list
      .filter((v: any) => !CLOSED_VISIT_STATUSES.has((v.status || '').toLowerCase()))
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [visits]);

  const selectedVisit = activeVisits.find((v: any) => (v._id || v.id) === visitId);
  const selectedPatientId = preselectedPatientId || patientIdStr(selectedVisit);

  const selectMedicationForPlan = (med: MedicationLike, type: 'drug' | 'iv' = itemType) => {
    const regimen = buildSmartRegimen(med);
    setSelectedMed(med);
    setStrengthPerDose(regimen.strengthPerDose);
    setDosesPerDay(regimen.dosesPerDay);
    setDurationDays(regimen.durationDays);
    setRoute(type === 'iv' ? 'intravenous' : regimen.route);
    setItemType(type);
  };

  // Filter lab tests by search
  const filteredLabs = useMemo(() => {
    if (!labSearch.trim()) return (lisCatalog || []).slice(0, 30);
    const q = labSearch.toLowerCase();
    return (lisCatalog || []).filter(
      (t: any) => ((t.testCode || t.code || '') as string).toLowerCase().includes(q) || ((t.testName || t.name || '') as string).toLowerCase().includes(q)
    );
  }, [lisCatalog, labSearch]);

  // Helper: extract units per dose from strengthPerDose string (e.g., "2 tablets" → 2)
  // Estimated total
  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.type === 'drug' || item.type === 'iv') {
        const med = allMedications.find((m: any) => m._id === item.medicationId);
        const unitPrice = med ? getMedicationPrice(med) : 0;
        const qty = computeMedicationQuantity(item, med);
        return sum + unitPrice * qty;
      }
      if (item.type === 'lab') {
        return sum + (item.testPrice || 0);
      }
      // procedure, other — price is in amount
      return sum + (item.amount || 0);
    }, 0);
  }, [items, allMedications]);

  // ── Add handlers ───────────────────────────────────────────────────────

  const addDrugOrIv = () => {
    if (!selectedMed) return toast.error('Select a medication');
    if (!strengthPerDose.trim()) return toast.error('Enter strength per dose');
    if (dosesPerDay < 1) return toast.error('Doses per day must be at least 1');
    if (durationDays < 1) return toast.error('Duration must be at least 1 day');

    const duplicate = items.some((item) => (item.type === 'drug' || item.type === 'iv') && item.medicationId === selectedMed._id);
    const quantity = computeMedicationQuantity({ strengthPerDose, dosesPerDay, durationDays }, selectedMed);
    const newItem: CreateTreatmentPlanItemInput = {
      type: itemType,
      medicationId: selectedMed._id,
      medicationName: selectedMed.name,
      strengthPerDose,
      dosesPerDay,
      durationDays,
      quantity,
      route,
      notes: buildSmartInstruction({ strengthPerDose, dosesPerDay, durationDays, route }),
    };
    setItems((prev) => [...prev, newItem]);
    // Reset form
    setSelectedMed(null);
    setStrengthPerDose('1 tablet');
    setDosesPerDay(3);
    setDurationDays(7);
    toast.success(`Added ${itemType === 'iv' ? 'IV' : 'drug'}: ${selectedMed.name}${duplicate ? ' (duplicate)' : ''}`);
  };

  const addLabTest = () => {
    if (!selectedLab) return toast.error('Select a lab test');
    const duplicate = items.some((item) => item.type === 'lab' && (item.testId || item.testCode) === (selectedLab._id || selectedLab.testId || selectedLab.testCode || selectedLab.code));
    const newItem: CreateTreatmentPlanItemInput = {
      type: 'lab',
      testCode: selectedLab.testCode || selectedLab.code,
      testName: selectedLab.testName || selectedLab.name,
      testPrice: selectedLab.price || selectedLab.testPrice || 0,
      testId: selectedLab._id || selectedLab.testId,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedLab(null);
    setLabSearch('');
    toast.success(`Added lab test: ${newItem.testName}${duplicate ? ' (duplicate)' : ''}`);
  };

  const addProcedure = () => {
    if (!procedureForm.name.trim()) return toast.error('Enter procedure name');
    const newItem: CreateTreatmentPlanItemInput = {
      type: 'procedure',
      description: procedureForm.name,
      amount: procedureForm.amount,
      notes: procedureForm.notes || procedureForm.name,
    };
    setItems((prev) => [...prev, newItem]);
    setProcedureForm({ name: '', amount: 0, notes: '' });
    toast.success(`Added procedure: ${procedureForm.name}`);
  };

  const addOther = () => {
    if (!otherForm.description.trim()) return toast.error('Enter description');
    const newItem: CreateTreatmentPlanItemInput = {
      type: 'other',
      description: otherForm.description,
      amount: otherForm.amount,
      notes: otherForm.notes,
    };
    setItems((prev) => [...prev, newItem]);
    setOtherForm({ description: '', amount: 0, notes: '' });
    toast.success('Added item');
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Create mutation ────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (sendNow: boolean) =>
      treatmentPlanService.create({
        patientId: selectedPatientId,
        visitId: visitId || undefined,
        items,
        notes,
      }),
    onSuccess: async (plan, sendNow) => {
      if (sendNow) {
        try {
          await treatmentPlanService.sendToReception(plan._id);
          toast.success('Treatment plan sent to reception!');
        } catch {
          toast.success('Treatment plan created (draft). You can send it later.');
        }
      } else {
        toast.success('Treatment plan saved as draft');
      }
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      setItems([]);
      setNotes('');
      onPlanCreated?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create treatment plan');
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────

  const content = (
    <div className="space-y-4">
      {/* Visit selector */}
      {!preselectedVisitId && !preselectedPatientId && (
        <div>
          <Label className="text-sm font-medium">Select Visit</Label>
          <Select value={visitId} onValueChange={setVisitId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={visitsLoading ? 'Loading visits...' : 'Choose a visit'} />
            </SelectTrigger>
            <SelectContent>
              {activeVisits.map((v: any) => (
                <SelectItem key={v._id} value={v._id}>
                  {v.visitNumber} — {patientName(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selected patient info */}
      {(selectedVisit || preselectedPatientId) && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
          <span className="font-medium">{preselectedPatientName || patientName(selectedVisit)}</span>
          {selectedVisit && (
            <Badge variant="outline" className="text-xs">
              {(selectedVisit as any).patientId?.patientId || (selectedVisit as any).patient?.patientId}
            </Badge>
          )}
        </div>
      )}

      {/* Item type tabs */}
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        if (value === 'drug') {
          setItemType('drug');
        }
      }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="drug" className="text-xs">
            <Pill className="h-3 w-3 mr-1" /> Drug
          </TabsTrigger>
          <TabsTrigger value="lab" className="text-xs">
            <Beaker className="h-3 w-3 mr-1" /> Lab
          </TabsTrigger>
          <TabsTrigger value="procedure" className="text-xs">
            <Scissors className="h-3 w-3 mr-1" /> Proc
          </TabsTrigger>
          <TabsTrigger value="other" className="text-xs">
            <FileText className="h-3 w-3 mr-1" /> Other
          </TabsTrigger>
        </TabsList>

        {/* Drug tab */}
        <TabsContent value="drug" className="space-y-3">
          <SmartDrugIvForm
            type="drug"
            allMedications={allMedications}
            medsLoading={medsLoading}
            selectedMed={selectedMed}
            setSelectedMed={(med) => selectMedicationForPlan(med)}
            strengthPerDose={strengthPerDose}
            setStrengthPerDose={setStrengthPerDose}
            dosesPerDay={dosesPerDay}
            setDosesPerDay={setDosesPerDay}
            durationDays={durationDays}
            setDurationDays={setDurationDays}
            route={route}
            setRoute={setRoute}
            onAdd={addDrugOrIv}
          />
        </TabsContent>

        {/* Lab tab */}
        <TabsContent value="lab" className="space-y-3">
          <div>
            <Label className="text-sm">Search Lab Tests</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
                value={labSearch}
                onChange={(e) => {
                  setLabSearch(e.target.value);
                  setSelectedLab(null);
                }}
                className="pl-8"
              />
            </div>
            {labSearch.trim().length > 0 && !selectedLab && (
              <div className="mt-1 max-h-48 overflow-y-auto border rounded-md bg-background">
                {filteredLabs.slice(0, 20).map((test: any, i: number) => (
                  <div
                    key={i}
                    className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex justify-between"
                    onClick={() => {
                      setSelectedLab(test);
                      setLabSearch(test.testCode || test.code);
                    }}
                  >
                    <span>
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {test.testCode || test.code}
                      </span>
                      {test.testName || test.name}
                    </span>
                    <span className="text-muted-foreground">Le {(test.price || test.testPrice || 0).toLocaleString()}</span>
                  </div>
                ))}
                {filteredLabs.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No tests found</div>
                )}
              </div>
            )}
          </div>
          {selectedLab && (
            <div className="p-2 bg-muted rounded text-sm">
              <span className="font-mono text-xs mr-2">{selectedLab.testCode || selectedLab.code}</span>
              {selectedLab.testName || selectedLab.name}
              <span className="ml-2 text-muted-foreground">
                Le {(selectedLab.price || selectedLab.testPrice || 0).toLocaleString()}
              </span>
            </div>
          )}
          <Button onClick={addLabTest} disabled={!selectedLab} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Lab Test
          </Button>
        </TabsContent>

        {/* Procedure tab */}
        <TabsContent value="procedure" className="space-y-3">
          <div>
            <Label className="text-sm">Procedure Name</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Wound Dressing, Injection, etc."
              value={procedureForm.name}
              onChange={(e) => setProcedureForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Estimated Cost (Le)</Label>
            <Input
              type="number"
              className="mt-1"
              value={procedureForm.amount}
              onChange={(e) => setProcedureForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label className="text-sm">Notes (optional)</Label>
            <Input
              className="mt-1"
              placeholder="Additional details..."
              value={procedureForm.notes}
              onChange={(e) => setProcedureForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <Button onClick={addProcedure} disabled={!procedureForm.name.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Procedure
          </Button>
        </TabsContent>

        {/* Other tab */}
        <TabsContent value="other" className="space-y-3">
          <div>
            <Label className="text-sm">Description</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Referral, Follow-up, etc."
              value={otherForm.description}
              onChange={(e) => setOtherForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-sm">Estimated Cost (Le)</Label>
            <Input
              type="number"
              className="mt-1"
              value={otherForm.amount}
              onChange={(e) => setOtherForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label className="text-sm">Notes (optional)</Label>
            <Input
              className="mt-1"
              placeholder="Additional details..."
              value={otherForm.notes}
              onChange={(e) => setOtherForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <Button onClick={addOther} disabled={!otherForm.description.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </TabsContent>
      </Tabs>

      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Treatment Plan Items ({items.length})</Label>
          <div className="space-y-2">
            {items.map((item, idx) => {
              const meta = TYPE_META[item.type] || TYPE_META.other;
              const Icon = meta.icon;
              const isDrugOrIv = item.type === 'drug' || item.type === 'iv';
              const med = isDrugOrIv ? allMedications.find((m: any) => m._id === item.medicationId) : null;
              const qty = isDrugOrIv ? Number(item.quantity || computeMedicationQuantity(item, med)) : 0;
              const unitPrice = med ? getMedicationPrice(med) : 0;
              const lineTotal = isDrugOrIv ? unitPrice * qty : (item.type === 'lab' ? item.testPrice || 0 : item.amount || 0);
              const isDuplicate =
                (isDrugOrIv && items.filter((candidate) => (candidate.type === 'drug' || candidate.type === 'iv') && candidate.medicationId === item.medicationId).length > 1) ||
                (item.type === 'lab' && items.filter((candidate) => candidate.type === 'lab' && (candidate.testId || candidate.testCode) === (item.testId || item.testCode)).length > 1);

              return (
                <div key={idx} className="p-3 bg-muted rounded-lg text-sm space-y-1.5">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.color}`}>
                        <Icon className="h-3 w-3 mr-0.5" />
                        {meta.label}
                      </Badge>
                      <span className="font-medium truncate">
                        {isDrugOrIv ? item.medicationName : item.type === 'lab' ? item.testName : item.testName || item.description}
                      </span>
                      {isDuplicate && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                          Duplicate
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold">Le {lineTotal.toLocaleString()}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Detail breakdown */}
                  {isDrugOrIv && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pl-1">
                      <span>Strength: <span className="text-foreground">{item.strengthPerDose}</span></span>
                      <span>Route: <span className="text-foreground capitalize">{item.route}</span></span>
                      <span>Frequency: <span className="text-foreground">{item.dosesPerDay}x/day</span></span>
                      <span>Duration: <span className="text-foreground">{item.durationDays} days</span></span>
                      <span>Qty: <span className="text-foreground">{qty} {med ? getMedicationBaseUnit(med) : 'units'}</span></span>
                      <span>Unit price: <span className="text-foreground">Le {unitPrice.toLocaleString()}</span></span>
                    </div>
                  )}
                  {item.type === 'lab' && (
                    <div className="text-xs text-muted-foreground pl-1">
                      Code: <span className="text-foreground font-mono">{item.testCode}</span>
                    </div>
                  )}
                  {item.type === 'procedure' && item.description && (
                    <div className="text-xs text-muted-foreground pl-1">
                      Notes: <span className="text-foreground">{item.description}</span>
                    </div>
                  )}
                  {item.type === 'other' && item.notes && (
                    <div className="text-xs text-muted-foreground pl-1">
                      Notes: <span className="text-foreground">{item.notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-right font-semibold text-sm">
            Total: Le {estimatedTotal.toLocaleString()}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <Label className="text-sm">General Notes (optional)</Label>
        <Textarea
          className="mt-1"
          placeholder="Any additional notes for this treatment plan..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          disabled={items.length === 0 || !selectedPatientId || createMutation.isPending}
          onClick={() => createMutation.mutate(false)}
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Save Draft
        </Button>
        <Button
          disabled={items.length === 0 || !selectedPatientId || createMutation.isPending}
          onClick={() => setSendConfirmOpen(true)}
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Send to Reception
        </Button>
      </div>
      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send treatment plan to reception?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Reception will see this plan for payment and fulfilment.
            </p>
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex justify-between">
                <span>Items</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total estimate</span>
                <span className="font-semibold">Le {estimatedTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setSendConfirmOpen(false);
                createMutation.mutate(true);
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (inline) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Treatment Plan</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// ── Drug/IV sub-form ───────────────────────────────────────────────────────

interface DrugIvFormProps {
  type: 'drug' | 'iv';
  allMedications: any[];
  medsLoading: boolean;
  selectedMed: any;
  setSelectedMed: (med: any) => void;
  strengthPerDose: string;
  setStrengthPerDose: (v: string) => void;
  dosesPerDay: number;
  setDosesPerDay: (v: number) => void;
  durationDays: number;
  setDurationDays: (v: number) => void;
  route: string;
  setRoute: (v: string) => void;
  onAdd: () => void;
}

function DrugIvForm({
  type,
  allMedications,
  medsLoading,
  selectedMed,
  setSelectedMed,
  strengthPerDose,
  setStrengthPerDose,
  dosesPerDay,
  setDosesPerDay,
  durationDays,
  setDurationDays,
  route,
  setRoute,
  onAdd,
}: DrugIvFormProps) {
  const [medFilter, setMedFilter] = useState('');

  const filteredMeds = useMemo(() => {
    if (!medFilter.trim()) return allMedications.slice(0, 50);
    const q = medFilter.toLowerCase();
    return allMedications.filter(
      (m: any) => m.name.toLowerCase().includes(q) || (m.genericName || '').toLowerCase().includes(q)
    );
  }, [allMedications, medFilter]);

  return (
    <>
      {/* Medication dropdown */}
      <div>
        <Label className="text-sm">{type === 'iv' ? 'IV Fluid / Medication' : 'Medication'}</Label>
        <Select
          value={selectedMed?._id || ''}
          onValueChange={(val) => {
            const med = allMedications.find((m: any) => m._id === val);
            setSelectedMed(med || null);
          }}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={medsLoading ? 'Loading medications...' : `Select ${type === 'iv' ? 'IV fluid' : 'medication'}...`} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <div className="px-2 py-1.5 sticky top-0 bg-background z-10">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter medications..."
                  value={medFilter}
                  onChange={(e) => setMedFilter(e.target.value)}
                  className="h-8 pl-7 text-sm"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            {filteredMeds.map((med: any) => (
              <SelectItem key={med._id} value={med._id} className="text-sm">
                <div className="flex items-center justify-between w-full gap-3">
                  <span className="truncate">
                    {med.name}
                    {med.strength ? ` (${med.strength})` : ''}
                  </span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {med.stockQuantity} in stock · Le {med.unitPrice?.toLocaleString()}
                  </span>
                </div>
              </SelectItem>
            ))}
            {filteredMeds.length === 0 && !medsLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">No medications found</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedMed && (
        <div className="p-2 bg-muted rounded text-sm">
          {selectedMed.name}
          {selectedMed.strength ? ` (${selectedMed.strength})` : ''}
          <span className="ml-2 text-muted-foreground">
            Stock: {selectedMed.stockQuantity} | Le {selectedMed.unitPrice?.toLocaleString()}/unit
          </span>
        </div>
      )}

      {/* Regimen */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Strength/Dose</Label>
          <Input
            className="mt-1"
            value={strengthPerDose}
            onChange={(e) => setStrengthPerDose(e.target.value)}
            placeholder="e.g. 500mg"
          />
        </div>
        <div>
          <Label className="text-xs">Doses/Day</Label>
          <Input
            type="number"
            className="mt-1"
            value={dosesPerDay}
            onChange={(e) => setDosesPerDay(Number(e.target.value))}
            min={1}
          />
        </div>
        <div>
          <Label className="text-xs">Duration (days)</Label>
          <Input
            type="number"
            className="mt-1"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            min={1}
          />
        </div>
      </div>

      {type === 'drug' && (
        <div>
          <Label className="text-xs">Route</Label>
          <Select value={route} onValueChange={setRoute}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUTE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Quantity preview */}
      <div className="text-xs text-muted-foreground">
        Qty: {dosesPerDay * durationDays} {selectedMed?.baseUnit || 'units'} (estimated Le{' '}
        {((selectedMed?.unitPrice || 0) * dosesPerDay * durationDays).toLocaleString()})
      </div>

      <Button onClick={onAdd} size="sm">
        <Plus className="h-4 w-4 mr-1" /> Add {type === 'iv' ? 'IV' : 'Drug'}
      </Button>
    </>
  );
}

function SmartDrugIvForm({
  type,
  allMedications,
  medsLoading,
  selectedMed,
  setSelectedMed,
  strengthPerDose,
  setStrengthPerDose,
  dosesPerDay,
  setDosesPerDay,
  durationDays,
  setDurationDays,
  route,
  setRoute,
  onAdd,
}: DrugIvFormProps) {
  const medicationsForMode = useMemo(() => {
    if (type !== 'iv') return allMedications;
    const ivMeds = allMedications.filter((med: any) => isParenteralOrInfusion(med));
    const otherMeds = allMedications.filter((med: any) => !isParenteralOrInfusion(med));
    return [...ivMeds, ...otherMeds];
  }, [allMedications, type]);

  return (
    <>
      <MedicationPicker
        medications={medicationsForMode}
        loading={medsLoading}
        selectedId={selectedMed?._id}
        onSelect={(med) => setSelectedMed(med)}
        compact
        title={type === 'iv' ? 'IV / injection / infusion products' : 'CAF / local medication catalog'}
      />

      {selectedMed && (
        <div className="p-2 bg-muted rounded text-sm">
          {selectedMed.name}
          {selectedMed.strength ? ` (${selectedMed.strength})` : ''}
          <span className="ml-2 text-muted-foreground">
            Stock: {getMedicationStock(selectedMed)} {getMedicationBaseUnit(selectedMed)} | Le {getMedicationPrice(selectedMed).toLocaleString()}/{getMedicationBaseUnit(selectedMed)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Strength/Dose</Label>
          <Input
            className="mt-1"
            value={strengthPerDose}
            onChange={(e) => setStrengthPerDose(e.target.value)}
            placeholder="e.g. 1 vial"
          />
        </div>
        <div>
          <Label className="text-xs">Doses/Day</Label>
          <Input
            type="number"
            className="mt-1"
            value={dosesPerDay}
            onChange={(e) => setDosesPerDay(Number(e.target.value))}
            min={1}
          />
        </div>
        <div>
          <Label className="text-xs">Duration (days)</Label>
          <Input
            type="number"
            className="mt-1"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            min={1}
          />
        </div>
      </div>

      {type === 'drug' && (
        <div>
          <Label className="text-xs">Route</Label>
          <Select value={route} onValueChange={setRoute}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUTE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Qty: {dosesPerDay * durationDays} {selectedMed ? getMedicationBaseUnit(selectedMed) : 'units'} (estimated Le{' '}
        {((selectedMed ? getMedicationPrice(selectedMed) : 0) * dosesPerDay * durationDays).toLocaleString()})
      </div>

      <Button onClick={onAdd} size="sm">
        <Plus className="h-4 w-4 mr-1" /> Add {type === 'iv' ? 'IV' : 'Drug'}
      </Button>
    </>
  );
}
