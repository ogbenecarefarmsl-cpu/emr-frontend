import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MedicationPicker } from '@/components/medications/MedicationPicker';
import { Loader2, Trash2, Send, AlertTriangle, ShieldCheck, Pill } from 'lucide-react';

export interface PrescriptionModalItem {
  medicationId: string;
  medicationName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  computedQuantity?: number;
  quantityTouched?: boolean;
  route?: string;
  unitPrice?: number;
  instructions?: string;
  pharmacistNote?: string;
  strengthPerDose?: string;
  dosesPerDay?: number;
  durationDays?: number;
  isControlled?: boolean;
  requiresPrescription?: boolean;
  baseUnit?: string;
  sellMode?: string;
  packSizes?: any[];
  isPrn?: boolean;
  __cafProduct?: boolean;
}

interface DoctorPrescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPrescription: any | null;
  patientName: string;
  patientId?: string;
  allergies?: string[];
  medications: any[];
  medicationsLoading: boolean;
  prescriptionItems: PrescriptionModalItem[];
  onSelectMedication: (med: any) => void;
  onUpdateItem: (index: number, field: string, value: any) => void;
  onRemoveItem: (index: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function DoctorPrescriptionModal({
  open,
  onOpenChange,
  editingPrescription,
  patientName,
  patientId,
  allergies = [],
  medications,
  medicationsLoading,
  prescriptionItems,
  onSelectMedication,
  onUpdateItem,
  onRemoveItem,
  onCancel,
  onSubmit,
  isPending,
}: DoctorPrescriptionModalProps) {
  const [searchMedication, setSearchMedication] = useState('');

  const filteredMedications = useMemo(() => {
    if (!searchMedication) return medications.slice(0, 30);
    const q = searchMedication.toLowerCase();
    return medications.filter((m: any) =>
      m.name?.toLowerCase().includes(q) ||
      m.genericName?.toLowerCase().includes(q) ||
      m.medicationCode?.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [medications, searchMedication]);

  const hasInstruction = (item: PrescriptionModalItem) => {
    return Boolean(
      item.instructions?.trim() ||
      (item.strengthPerDose && item.dosesPerDay && item.durationDays) ||
      (item.dosage && item.frequency && item.duration)
    );
  };

  const canSubmit =
    prescriptionItems.length > 0 &&
    prescriptionItems.every(hasInstruction) &&
    !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-2xl sm:h-[min(900px,92vh)] sm:w-[min(1100px,96vw)] sm:max-w-none sm:rounded-2xl sm:border">
        <DialogHeader className="shrink-0 space-y-0 border-b border-slate-200 bg-white px-4 py-3 pr-14 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold sm:text-lg">
                {editingPrescription ? 'Edit Prescription' : 'Prescribe Medication'}
              </DialogTitle>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {patientName}
                {patientId ? ` · ${patientId}` : ''}
                <span className="hidden sm:inline"> · Estimate only — reception finalizes packs</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {allergies.length > 0 ? (
                <Badge variant="destructive" className="h-7 max-w-[220px] truncate px-2.5 text-xs">
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Allergy: {allergies.slice(0, 2).join(', ')}</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="h-7 border-emerald-200 bg-emerald-50 px-2.5 text-xs text-emerald-700">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> No allergies
                </Badge>
              )}
              <Badge variant="secondary" className="h-7 px-2.5 text-xs">
                {prescriptionItems.length} item{prescriptionItems.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
          {allergies.length > 0 && (
            <div className="flex shrink-0 items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs text-red-800">
                <span className="font-semibold">Allergy alert: </span>
                {allergies.join(', ')}. Verify each medication before prescribing.
              </p>
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
            <MedicationPicker
              medications={filteredMedications}
              loading={medicationsLoading}
              searchTerm={searchMedication}
              onSearchTermChange={setSearchMedication}
              onSelect={onSelectMedication}
              allowOutOfStock
              title="Search drugs"
              className="min-h-[240px] rounded-xl border-slate-200 bg-white shadow-sm lg:min-h-0"
              listClassName="h-full max-h-none"
            />

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">Prescription items</p>
                  <p className="text-[11px] text-muted-foreground">Add a drug, set route, write dosing instructions.</p>
                </div>
                <Badge variant="outline" className="shrink-0 bg-slate-50 text-[10px]">Reception prices</Badge>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {prescriptionItems.length === 0 ? (
                  <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                      <Pill className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">No medications yet</p>
                    <p className="max-w-[240px] text-xs text-muted-foreground">
                      Search and select a drug on the left to add it here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 p-3">
                    {prescriptionItems.map((item, index) => {
                      const duplicateCount = prescriptionItems.filter((c) => c.medicationId === item.medicationId).length;
                      const isDuplicate = duplicateCount > 1;
                      return (
                        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-semibold text-slate-950">{item.medicationName}</p>
                                {item.isControlled && <Badge variant="destructive" className="text-[10px]">Controlled</Badge>}
                                {isDuplicate && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">Duplicate</Badge>}
                                {(item.route === 'intravenous' || item.route === 'intramuscular') && (
                                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">
                                    {item.route === 'intravenous' ? 'IV' : 'IM'}
                                  </Badge>
                                )}
                                {item.__cafProduct && <Badge variant="outline" className="border-purple-200 bg-purple-50 text-[10px] text-purple-700">CAF</Badge>}
                                {item.isPrn && <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[10px] text-orange-700">PRN</Badge>}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={() => onRemoveItem(index)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
                            <Select value={item.route || 'oral'} onValueChange={(v) => onUpdateItem(index, 'route', v)}>
                              <SelectTrigger className="h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="oral">Oral</SelectItem>
                                <SelectItem value="intravenous">IV</SelectItem>
                                <SelectItem value="intramuscular">IM</SelectItem>
                                <SelectItem value="subcutaneous">SC</SelectItem>
                                <SelectItem value="topical">Topical</SelectItem>
                                <SelectItem value="ophthalmic">Eye</SelectItem>
                                <SelectItem value="otic">Ear</SelectItem>
                                <SelectItem value="nasal">Nasal</SelectItem>
                                <SelectItem value="inhalation">Inhale</SelectItem>
                              </SelectContent>
                            </Select>
                            <Textarea
                              placeholder="e.g. 500mg BD × 5 days after food"
                              value={item.instructions || ''}
                              onChange={(e) => onUpdateItem(index, 'instructions', e.target.value)}
                              className="min-h-[72px] resize-none bg-white text-sm"
                            />
                          </div>

                          <details className="group mt-2">
                            <summary className="cursor-pointer select-none text-[10px] text-muted-foreground hover:text-slate-700">
                              Pharmacist note
                            </summary>
                            <Input
                              placeholder="Internal note for pharmacist"
                              value={item.pharmacistNote || ''}
                              onChange={(e) => onUpdateItem(index, 'pharmacistNote', e.target.value)}
                              className="mt-1 h-8 bg-white text-[11px]"
                            />
                          </details>

                          {!hasInstruction(item) && (
                            <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] text-red-700">
                              Instruction required before creating prescription.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {prescriptionItems.length > 0 && (
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    {prescriptionItems.length} med{prescriptionItems.length !== 1 ? 's' : ''} · priced at dispense
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">Reception finalizes packs</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-0 shrink-0 gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:space-x-0 sm:px-5">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {editingPrescription ? 'Update Prescription' : 'Create Prescription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
