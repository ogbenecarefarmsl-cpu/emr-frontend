import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Pill, Loader2, AlertTriangle, Check, Search } from 'lucide-react';
import { medicationService } from '@/services/medicationService';
import { prescriptionService } from '@/services/prescriptionService';
import type { Medication, Prescription } from '@/types/prescription';

interface DispenseLine {
  lineId: string;
  prescriptionId: string;
  prescriptionNumber: string;
  medicationId: string;
  originalMedicationId: string;
  medicationName: string;
  /** What the doctor prescribed (in base units) */
  prescribedBaseUnits: number;
  /** What we'll actually dispense — sell units */
  sellUnits: number;
  /** Compute from sell units and pack size */
  baseUnits: number;
  /** "individual" or "pack" */
  dispenseMode: 'individual' | 'pack';
  packSizeIndex?: number;
  /** Price snapshot at this moment */
  pricePerSellUnit: number;
  lineTotal: number;
  /** Substitute tracking */
  isSubstitute: boolean;
  /** Live medication object (for showing stock/packs) */
  medication?: Medication;
  /** Error messages from validation */
  error?: string;
}

const getUnitsPerPack = (pack: Medication['packSizes'][number]) =>
  Number(pack.unitsPerPack || (pack as any).quantityPerPack || 1) || 1;

const isSingleUseMedication = (med?: Medication) => {
  const text = `${med?.name || ''} ${med?.dosageForm || ''} ${med?.baseUnit || ''}`.toLowerCase();
  return /\b(vial|ampoule|ampule|infusion|bag)\b/.test(text);
};

export default function ReceptionDispensePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const rxIds = useMemo(() => {
    const raw = searchParams.get('rxIds');
    const ids = raw ? raw.split(',').map((value) => value.trim()).filter(Boolean) : [];
    return ids.length > 0 ? ids : (id ? [id] : []);
  }, [id, searchParams]);

  const [lines, setLines] = useState<DispenseLine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [substituteFor, setSubstituteFor] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Medication[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Fetch one or more paid prescriptions for the same patient.
  const { data: rxBundle = [], isLoading: rxLoading, error: rxError } = useQuery<Prescription[]>({
    queryKey: ['prescription-dispense-bundle', rxIds],
    queryFn: async () => {
      const list = await prescriptionService.findAll();
      const found = rxIds
        .map((rxId) => list.find((p: any) => p._id === rxId))
        .filter(Boolean) as Prescription[];
      if (found.length === 0) throw new Error('Prescription not found');
      return found;
    },
    enabled: rxIds.length > 0,
  });

  const rx = rxBundle[0] || null;
  const prescribedTotal = rxBundle.reduce((sum, prescription) => sum + (prescription.totalAmount || 0), 0);

  // Init lines when prescription loads
  useEffect(() => {
    if (rxBundle.length === 0) return;
    setPrescriptions(rxBundle);
    const initialLines: DispenseLine[] = rxBundle.flatMap((prescription) =>
      (prescription.items || []).map((item: any, idx: number) => {
        const medId = typeof item.medicationId === 'object' ? item.medicationId._id : item.medicationId;
        return {
          lineId: `${prescription._id}-${medId}-${idx}`,
          prescriptionId: prescription._id,
          prescriptionNumber: prescription.prescriptionNumber,
          medicationId: medId,
          originalMedicationId: medId,
          medicationName: item.medicationName,
          prescribedBaseUnits: item.quantity,
          sellUnits: item.quantity,
          baseUnits: item.quantity,
          dispenseMode: 'individual',
          pricePerSellUnit: 0,
          lineTotal: 0,
          isSubstitute: false,
        };
      }),
    );
    setLines(initialLines);
    // Hydrate each line's medication data
    initialLines.forEach((l) => hydrateLine(l));
  }, [rxBundle]);

  // Hydrate a single line with medication details (stock, packs, price)
  const hydrateLine = async (line: DispenseLine) => {
    try {
      const med = await medicationService.findById(line.medicationId);
      updateLineInState(recommendDispenseLine({ ...line, medication: med }));
    } catch {
      // Could be a CAF product, not a local med
      // Try fetching from the search list
      try {
        const results = await medicationService.search(line.medicationName);
        const found = results.find((m: any) => m._id === line.medicationId);
        if (found) updateLineInState(recommendDispenseLine({ ...line, medication: found }));
      } catch {
        // Ignore
      }
    }
  };

  const updateLineInState = (updated: DispenseLine, recompute: boolean = true) => {
    setLines((current) => {
      const next = current.map((l) => {
        if (l.lineId !== updated.lineId) return l;
        if (recompute) {
          return computeLineTotals({ ...l, ...updated });
        }
        return { ...l, ...updated };
      });
      return next;
    });
  };

  const computeLineTotals = (line: DispenseLine): DispenseLine => {
    const med = line.medication;
    let baseUnits = line.sellUnits;
    let pricePerSellUnit = med?.unitPrice || 0;
    if (line.dispenseMode === 'pack' && line.packSizeIndex != null && med?.packSizes?.[line.packSizeIndex]) {
      const pack = med.packSizes[line.packSizeIndex];
      baseUnits = line.sellUnits * getUnitsPerPack(pack);
      pricePerSellUnit = pack.sellingPrice;
    }
    const stock = Number(med?.stockQuantity ?? 0);
    const error = med && baseUnits > stock
      ? `Insufficient stock: have ${stock} ${med.baseUnit || 'units'}, need ${baseUnits} ${med.baseUnit || 'units'}`
      : undefined;
    return {
      ...line,
      baseUnits,
      pricePerSellUnit,
      lineTotal: line.sellUnits * pricePerSellUnit,
      error,
    };
  };

  const recommendDispenseLine = (line: DispenseLine): DispenseLine => {
    const med = line.medication;
    const packs = med?.packSizes || [];
    const needed = Math.max(1, Number(line.prescribedBaseUnits || 1));

    if (!med || packs.length === 0 || med.sellMode === 'individual' || isSingleUseMedication(med)) {
      return computeLineTotals({
        ...line,
        dispenseMode: 'individual',
        packSizeIndex: undefined,
        sellUnits: needed,
      });
    }

    const exactIndex = packs.findIndex((pack) => getUnitsPerPack(pack) === needed);
    if (exactIndex >= 0) {
      return computeLineTotals({
        ...line,
        dispenseMode: 'pack',
        packSizeIndex: exactIndex,
        sellUnits: 1,
      });
    }

    const candidates = packs
      .map((pack, index) => ({ index, units: getUnitsPerPack(pack) }))
      .filter((pack) => pack.units > 1)
      .map((pack) => ({ ...pack, sellUnits: Math.ceil(needed / pack.units) }))
      .map((pack) => ({ ...pack, baseUnits: pack.sellUnits * pack.units }))
      .filter((pack) => pack.baseUnits >= needed)
      .sort((a, b) => a.baseUnits - b.baseUnits || a.units - b.units);

    const best = candidates[0];
    if (!best || med.sellMode === 'both') {
      return computeLineTotals({
        ...line,
        dispenseMode: 'individual',
        packSizeIndex: undefined,
        sellUnits: needed,
      });
    }

    return computeLineTotals({
      ...line,
      dispenseMode: 'pack',
      packSizeIndex: best.index,
      sellUnits: best.sellUnits,
    });
  };

  const setDispenseMode = (lineId: string, mode: 'individual' | 'pack') => {
    setLines((current) =>
      current.map((l) => {
        if (l.lineId !== lineId) return l;
        return computeLineTotals({
          ...l,
          dispenseMode: mode,
          packSizeIndex: mode === 'pack' ? 0 : undefined,
        });
      }),
    );
  };

  const setPackSize = (lineId: string, index: number) => {
    setLines((current) =>
      current.map((l) => {
        if (l.lineId !== lineId) return l;
        return computeLineTotals({ ...l, packSizeIndex: index });
      }),
    );
  };

  const setSellUnits = (lineId: string, units: number) => {
    setLines((current) =>
      current.map((l) => {
        if (l.lineId !== lineId) return l;
        return computeLineTotals({ ...l, sellUnits: Math.max(0, units) });
      }),
    );
  };

  const removeLine = (lineId: string) => {
    setLines((current) => current.filter((l) => l.lineId !== lineId));
  };

  const startSubstitute = (lineId: string) => {
    setSubstituteFor(lineId);
    setSearchTerm('');
  };

  const chooseSubstitute = (med: Medication) => {
    if (!substituteFor) return;
    setLines((current) =>
      current.map((l) => {
        if (l.lineId !== substituteFor) return l;
        // Replace this line with a substitute
        return recommendDispenseLine({
          ...l,
          medicationId: med._id,
          medicationName: med.name,
          pricePerSellUnit: 0,
          lineTotal: 0,
          isSubstitute: true,
          medication: med,
        });
      }),
    );
    setSubstituteFor(null);
    setSearchResults([]);
    setSearchTerm('');
    toast.success(`Substituted: ${med.name}`);
  };

  // Search for substitute medications
  useEffect(() => {
    if (!substituteFor || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await medicationService.search(searchTerm);
        setSearchResults(results.slice(0, 10));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, substituteFor]);

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + (l.lineTotal || 0), 0),
    [lines],
  );

  const hasErrors = lines.some((l) => l.error || l.sellUnits <= 0);
  const canSubmit = lines.length > 0 && !hasErrors;

  const handleConfirm = async () => {
    if (prescriptions.length === 0 || !canSubmit) return;
    setIsSubmitting(true);
    try {
      for (const prescription of prescriptions) {
        const items = lines
          .filter((l) => l.prescriptionId === prescription._id)
          .map((l) => ({
            medicationId: l.originalMedicationId,
            dispenseMode: l.dispenseMode,
            packSizeIndex: l.packSizeIndex,
            sellUnits: l.sellUnits,
            ...(l.medicationId !== l.originalMedicationId ? { substituteMedicationId: l.medicationId } : {}),
          }));
        await prescriptionService.dispense(prescription._id, {
          items,
          dispensingNotes: `Dispensed at reception by ${profile?.fullName || user?.email || 'reception'}`,
          paymentMethod,
        });
      }
      toast.success(
        prescriptions.length === 1
          ? `Prescription ${prescriptions[0].prescriptionNumber} dispensed.`
          : `${prescriptions.length} prescriptions dispensed.`,
      );
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['prescription', id] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      navigate(prescriptions.length === 1 ? `/reception/prescription-receipt/${prescriptions[0]._id}` : '/reception/dispensing');
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to dispense';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  };

  if (rxLoading) {
    return (
      <RoleLayout title="Dispense Prescription" subtitle="Reception dispense" role="receptionist" userName={profile?.fullName}>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </RoleLayout>
    );
  }

  if (rxError || !rx) {
    return (
      <RoleLayout title="Dispense Prescription" subtitle="Reception dispense" role="receptionist" userName={profile?.fullName}>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
            <p className="text-sm text-muted-foreground">Prescription not found.</p>
            <Button variant="outline" className="mt-3" onClick={() => navigate('/reception/payments')}>
              Back to Payments
            </Button>
          </CardContent>
        </Card>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout
      title="Dispense Prescription"
      subtitle={rxBundle.length > 1 ? `Reception dispense for ${rxBundle.length} prescriptions` : `Reception dispense for ${rx.prescriptionNumber}`}
      role="receptionist"
      userName={profile?.fullName}
    >
      <div className="max-w-5xl space-y-4">
        {/* Patient + prescription header */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Patient</p>
              <p className="font-semibold text-lg">
                {rx.patientId?.firstName} {rx.patientId?.lastName}{' '}
                <span className="text-sm text-muted-foreground font-normal">
                  ({rx.patientId?.patientId})
                </span>
              </p>
              {rx.patientId?.allergies && rx.patientId.allergies.length > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Allergies: {rx.patientId.allergies.join(', ')}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Prescribed total</p>
              <p className="text-lg font-semibold">Le {prescribedTotal.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {rxBundle.length} prescription{rxBundle.length !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Per-item dispense rows */}
        {lines.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No items in this prescription.
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-280px)] pr-3">
          <div className="space-y-4">
          {lines.map((line) => {
            const med = line.medication;
            const packSizes = med?.packSizes || [];
            return (
              <Card key={line.lineId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Pill className="w-4 h-4 text-primary" />
                        {line.medicationName}
                        {rxBundle.length > 1 && (
                          <Badge variant="secondary" className="text-[10px]">{line.prescriptionNumber}</Badge>
                        )}
                        {line.isSubstitute && (
                          <Badge variant="outline" className="text-[10px]">Substitute</Badge>
                        )}
                      </CardTitle>
                      {med && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Stock: <strong>{med.stockQuantity}</strong> {med.baseUnit || 'units'} · Base unit price: Le {med.unitPrice?.toLocaleString() || 0}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startSubstitute(line.lineId)}>
                        Substitute
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeLine(line.lineId)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Mode toggle */}
                    <div className="space-y-1">
                      <Label className="text-xs">Sell mode</Label>
                      <Select
                        value={line.dispenseMode}
                        onValueChange={(v: 'individual' | 'pack') => setDispenseMode(line.lineId, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Individual {med?.baseUnit || 'units'}</SelectItem>
                          <SelectItem value="pack" disabled={packSizes.length === 0}>
                            Pack{packSizes.length > 0 ? ` (${packSizes.length} options)` : ' (no packs)'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pack selector (if pack mode) */}
                    {line.dispenseMode === 'pack' && packSizes.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Pack size</Label>
                        <Select
                          value={String(line.packSizeIndex ?? 0)}
                          onValueChange={(v) => setPackSize(line.lineId, Number(v))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {packSizes.map((p, idx) => (
                              <SelectItem key={idx} value={String(idx)}>
                                {p.name} ({getUnitsPerPack(p)} {med?.baseUnit || 'units'}) · Le {p.sellingPrice.toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Sell units */}
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {line.dispenseMode === 'pack'
                          ? `How many ${packSizes[line.packSizeIndex ?? 0]?.unit || 'packs'} to dispense`
                          : `How many ${med?.baseUnit || 'units'} to dispense`}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={line.sellUnits}
                        onChange={(e) => setSellUnits(line.lineId, Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Stock check warning */}
                  {line.error && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {line.error}
                    </p>
                  )}

                  {/* Line total */}
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="text-xs text-muted-foreground">
                      <p>
                        Prescribed: <strong>{line.prescribedBaseUnits} {med?.baseUnit || 'units'}</strong>
                        {' → '}
                        Dispensing: <strong>{line.baseUnits} {med?.baseUnit || 'units'}</strong>
                        {line.dispenseMode === 'pack' && packSizes[line.packSizeIndex ?? 0] && (
                          <> ({line.sellUnits} × {getUnitsPerPack(packSizes[line.packSizeIndex ?? 0])})</>
                        )}
                      </p>
                      <p className="mt-0.5">
                        @ Le {line.pricePerSellUnit.toLocaleString()} per {line.dispenseMode === 'pack' ? (packSizes[line.packSizeIndex ?? 0]?.name || 'pack') : (med?.baseUnit || 'unit')}
                      </p>
                    </div>
                    <p className="font-semibold">Le {line.lineTotal.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
          </ScrollArea>
        )}

        {/* Total + actions */}
        {lines.length > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total bill (recalculated from your dispense selections)</p>
                <p className="text-2xl font-bold">Le {totalAmount.toLocaleString()}</p>
                {Math.abs(totalAmount - prescribedTotal) > 0.01 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Doctor estimated Le {prescribedTotal.toLocaleString()} - difference is the actual pack/individual selection.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Payment method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="orange_money">Orange Money</SelectItem>
                      <SelectItem value="africell_money">Africell Money</SelectItem>
                      <SelectItem value="qmoney">QMoney</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Dispense & Finalize
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Substitute search dialog */}
      <Dialog open={!!substituteFor} onOpenChange={(open) => { if (!open) { setSubstituteFor(null); setSearchResults([]); setSearchTerm(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substitute Medication</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search medication to substitute..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            {isSearching && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {searchResults.map((m) => (
                <button
                  key={m._id}
                  className="w-full text-left p-2 rounded hover:bg-muted border"
                  onClick={() => chooseSubstitute(m)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{m.name}</p>
                    <Badge variant="outline" className="text-[10px]">{m.stockQuantity} in stock</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.baseUnit} · Le {m.unitPrice?.toLocaleString()} per {m.baseUnit}
                    {m.packSizes && m.packSizes.length > 0 && ` · ${m.packSizes.length} pack option(s)`}
                  </p>
                </button>
              ))}
              {searchTerm.length >= 2 && !isSearching && searchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No matches</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Dispense</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              You are about to dispense <strong>{rxBundle.length} prescription{rxBundle.length !== 1 ? 's' : ''}</strong> for{' '}
              <strong>{rx.patientId?.firstName} {rx.patientId?.lastName}</strong>.
            </p>
              <div className="border rounded-lg p-3 space-y-1 text-sm">
              {lines.map((l, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>
                    {l.medicationName} <span className="text-muted-foreground">× {l.sellUnits}</span>
                  </span>
                  <span>Le {l.lineTotal.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                <span>Total</span>
                <span>Le {totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Payment method</span>
                <span className="capitalize">{paymentMethod.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Stock will be deducted and the bill will be saved as the actual dispensed total.
              {rx.visitId ? ' The visit will move to doctor\'s review.' : ''}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Confirm & Dispense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
