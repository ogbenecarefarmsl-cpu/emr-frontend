import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { prescriptionService } from '@/services/prescriptionService';
import { inventoryAPI } from '@/services/api';
import { PrescriptionStatusEnum } from '@/types/prescription';
import { cn } from '@/lib/utils';

// UI
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

// Icons
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Package,
  Pill,
  Search,
  User,
  ClipboardList,
  CreditCard,
  Send,
  XCircle,
  ChevronRight,
  ArrowRight,
  Stethoscope,
  ShieldAlert,
  Calendar,
  Printer,
  RefreshCw,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

const getId = (v: any) => v?._id || v?.id || v;
const patientName = (p: any) =>
  p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown Patient' : 'Unknown Patient';

export default function PharmacyDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dispensingNotes, setDispensingNotes] = useState('');

  const {
    data: prescriptions = [],
    isLoading,
    refetch: refetchPrescriptions,
    isFetching,
  } = useQuery({
    queryKey: ['prescriptions', 'pharmacy'],
    queryFn: () => prescriptionService.findAll(),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryAPI.getLowStock(),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: expiringSoon = [] } = useQuery({
    queryKey: ['inventory', 'expiring-soon'],
    queryFn: () => inventoryAPI.getExpiringSoon(90),
    refetchInterval: 5 * 60 * 1000,
  });

  const dispense = useMutation({
    mutationFn: (id: string) => prescriptionService.dispense(id, dispensingNotes.trim() || undefined),
    onSuccess: () => {
      toast.success('Prescription dispensed successfully. Pharmacy stock updated.');
      setSelected(null);
      setConfirmOpen(false);
      setDispensingNotes('');
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to dispense prescription');
    },
  });

  // Filter prescriptions into buckets
  const paidWaiting = useMemo(
    () => prescriptions.filter((rx: any) => rx.status === PrescriptionStatusEnum.PENDING && rx.isPaid),
    [prescriptions],
  );
  const unpaid = useMemo(
    () => prescriptions.filter((rx: any) => rx.status === PrescriptionStatusEnum.PENDING && !rx.isPaid),
    [prescriptions],
  );
  const dispensedToday = useMemo(
    () =>
      prescriptions.filter((rx: any) => {
        if (rx.status !== PrescriptionStatusEnum.DISPENSED || !rx.dispensedAt) return false;
        return new Date(rx.dispensedAt).toDateString() === new Date().toDateString();
      }),
    [prescriptions],
  );

  // Filter by search
  const filter = (list: any[]) => {
    if (!searchTerm) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(
      (rx: any) =>
        patientName(rx.patientId).toLowerCase().includes(q) ||
        rx.prescriptionNumber?.toLowerCase().includes(q),
    );
  };

  const filteredPaid = filter(paidWaiting);
  const filteredUnpaid = filter(unpaid);
  const filteredDispensed = filter(dispensedToday);

  const KNOWN_INTERACTIONS: Record<string, string> = {
    'warfarin,aspirin': 'Increased bleeding risk — monitor INR closely',
    'warfarin,ibuprofen': 'Increased bleeding risk — avoid NSAIDs',
    'metformin,contrast': 'Risk of lactic acidosis — hold metformin 48h',
    'lisinopril,potassium': 'Hyperkalemia risk — monitor K+ levels',
    'simvastatin,erythromycin': 'Rhabdomyolysis risk — avoid combination',
    'ciprofloxacin,theophylline': 'Increased theophylline levels — reduce dose',
    'methotrexate,nsaids': 'Methotrexate toxicity — avoid NSAIDs',
    'digoxin,amiodarone': 'Digoxin toxicity — reduce digoxin by 50%',
    'lithium,ibuprofen': 'Lithium toxicity — avoid NSAIDs',
    'ssri,maoi': 'Serotonin syndrome — contraindicated',
    'metronidazole,alcohol': 'Disulfiram-like reaction — avoid alcohol',
    'sildenafil,nitrates': 'Severe hypotension — contraindicated',
  };

  const checkInteractions = (items: any[]) => {
    if (!items || items.length < 2) return [];
    const names = items.map((i: any) => (i.medicationName || '').toLowerCase().trim());
    const interactions: string[] = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const keyA = `${names[i]},${names[j]}`;
        const keyB = `${names[j]},${names[i]}`;
        for (const [knownKey, warning] of Object.entries(KNOWN_INTERACTIONS)) {
          if (keyA.includes(knownKey) || keyB.includes(knownKey)) {
            interactions.push(warning);
          }
        }
      }
    }
    return [...new Set(interactions)];
  };

  return (
    <RoleLayout
      title="Pharmacy Dispensary"
      subtitle="Prescription fulfillment, inventory stock reconciliation, and patient counseling"
      role="pharmacist"
      userName={profile?.fullName}
    >
      {/* ───────── TOP HIGH-DENSITY STATUS STRIP ───────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ready to Dispense</p>
            <p className="text-2xl font-bold text-primary mt-0.5">{paidWaiting.length}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Awaiting Payment</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{unpaid.length}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/30">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dispensed Today</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{dispensedToday.length}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => navigate('/pharmacy/inventory')}
          className="cursor-pointer rounded-xl border bg-card p-3 flex items-center justify-between shadow-xs hover:border-red-300 transition-colors"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Low Stock Alert</p>
            <p className={cn('text-2xl font-bold mt-0.5', lowStock.length > 0 ? 'text-red-600' : 'text-foreground')}>
              {lowStock.length}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => navigate('/pharmacy/inventory')}
          className="cursor-pointer rounded-xl border bg-card p-3 flex items-center justify-between shadow-xs hover:border-orange-300 transition-colors"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Expiring (90d)</p>
            <p className={cn('text-2xl font-bold mt-0.5', expiringSoon.length > 0 ? 'text-orange-600' : 'text-foreground')}>
              {expiringSoon.length}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950/30">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ───────── SEARCH & ACTION TOOLBAR ───────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-card border rounded-xl p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient name, code, or prescription #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs gap-1"
            onClick={() => refetchPrescriptions()}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={() => navigate('/pharmacy/inventory')}
          >
            <Package className="w-3.5 h-3.5" />
            Inventory & Stock
          </Button>

          <Button
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={() => navigate('/reception/orders')}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Walk-in OTC
          </Button>
        </div>
      </div>

      {/* ───────── MAIN TWO-PANE DISPENSING CONSOLE ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: Prescription queues (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
            <Tabs defaultValue="paid">
              <div className="border-b px-3 pt-2 bg-muted/20">
                <TabsList className="bg-transparent h-auto p-0 gap-1">
                  <TabsTrigger
                    value="paid"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-2 text-xs"
                  >
                    Ready to Dispense
                    {paidWaiting.length > 0 && (
                      <Badge className="ml-1.5 h-4.5 min-w-4.5 text-[10px] bg-emerald-600">
                        {paidWaiting.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="unpaid"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-2 text-xs"
                  >
                    Unpaid
                    {unpaid.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-4.5 min-w-4.5 text-[10px]">
                        {unpaid.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="done"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none pb-2 text-xs"
                  >
                    Dispensed Today
                    {dispensedToday.length > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-1">({dispensedToday.length})</span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Paid waiting list */}
              <TabsContent value="paid" className="mt-0">
                <ScrollArea className="max-h-[calc(100vh-320px)] min-h-[380px]">
                  {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">Loading queue...</p>
                    </div>
                  ) : filteredPaid.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
                      <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground/40" />
                      <p className="font-medium">No prescriptions waiting for dispensing</p>
                      <p className="text-xs text-muted-foreground">
                        {searchTerm ? 'No matches found' : 'Orders paid at reception will appear here immediately'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredPaid.map((rx: any) => (
                        <PrescriptionRow
                          key={getId(rx)}
                          rx={rx}
                          selected={selected && getId(selected) === getId(rx)}
                          onClick={() => setSelected(rx)}
                          badge={<Badge className="bg-emerald-600 text-[10px] font-semibold">Paid • Ready</Badge>}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Unpaid list */}
              <TabsContent value="unpaid" className="mt-0">
                <ScrollArea className="max-h-[calc(100vh-320px)] min-h-[380px]">
                  {filteredUnpaid.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
                      <CreditCard className="w-8 h-8 mx-auto text-muted-foreground/40" />
                      <p className="font-medium">No unpaid prescriptions</p>
                      <p className="text-xs text-muted-foreground">All doctor orders have been paid or completed</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredUnpaid.map((rx: any) => (
                        <PrescriptionRow
                          key={getId(rx)}
                          rx={rx}
                          selected={selected && getId(selected) === getId(rx)}
                          onClick={() => setSelected(rx)}
                          badge={
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              <Clock className="w-3 h-3 mr-0.5" />
                              Awaiting Payment
                            </Badge>
                          }
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Done today */}
              <TabsContent value="done" className="mt-0">
                <ScrollArea className="max-h-[calc(100vh-320px)] min-h-[380px]">
                  {filteredDispensed.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
                      <CheckCircle className="w-8 h-8 mx-auto text-muted-foreground/40" />
                      <p className="font-medium">Nothing dispensed yet today</p>
                      <p className="text-xs text-muted-foreground">Fulfilled prescriptions will be logged here</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredDispensed.map((rx: any) => (
                        <PrescriptionRow
                          key={getId(rx)}
                          rx={rx}
                          selected={selected && getId(selected) === getId(rx)}
                          onClick={() => setSelected(rx)}
                          badge={
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 text-[10px]">
                              <CheckCircle className="w-3 h-3 mr-0.5 text-emerald-600" />
                              Dispensed
                            </Badge>
                          }
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Quick stock warning cards */}
          {lowStock.length > 0 && (
            <div className="bg-card border rounded-xl shadow-xs border-l-4 border-l-red-500 overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold text-xs flex items-center gap-1.5 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Urgent Stock Reorder Needed
                </h3>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-1.5" onClick={() => navigate('/pharmacy/inventory')}>
                  View all <ArrowRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
              <div className="divide-y">
                {lowStock.slice(0, 3).map((m: any) => (
                  <div key={m._id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <p className="font-medium truncate max-w-[200px]">{m.name}</p>
                    <Badge variant="destructive" className="text-[10px] h-4.5">
                      {m.stockQuantity} remaining
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Prescription detail & dispensing console (7 cols) */}
        <div className="lg:col-span-7">
          {selected ? (
            <PrescriptionDetail
              rx={selected}
              onDispense={() => setConfirmOpen(true)}
              isPending={dispense.isPending}
              interactions={checkInteractions(selected.items || [])}
            />
          ) : (
            <div className="bg-card border rounded-xl shadow-xs flex flex-col items-center justify-center min-h-[460px] text-muted-foreground p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Pill className="w-8 h-8" />
              </div>
              <p className="text-lg font-semibold text-foreground">Select Prescription to Dispense</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Choose a patient order from the queue to verify inventory stock availability, check drug-drug interactions, and fulfill medication.
              </p>
              {paidWaiting.length > 0 && (
                <div className="mt-4 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-medium border border-emerald-200">
                  {paidWaiting.length} prescription(s) paid and ready for immediate dispensing
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ───────── DISPENSE CONFIRMATION MODAL ───────── */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setDispensingNotes(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              Confirm Medication Dispensation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Confirming will mark this prescription as fulfilled and automatically deduct the items from pharmacy stock.
            </p>

            <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
              {selected?.items?.map((item: any, i: number) => (
                <div key={i} className="p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{item.medicationName}</span>
                    <Badge variant="outline" className="font-mono">Qty {item.quantity}</Badge>
                  </div>
                  {item.instructions && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      Label: {item.instructions}
                    </p>
                  )}
                  {item.dosage && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.dosage} • {item.frequency} • {item.duration}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Pharmacist Dispensing Notes & Counseling Log (Optional)
              </label>
              <textarea
                className="w-full border rounded-lg p-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
                placeholder="e.g. Counselled on taking with food. Patient informed of potential drowsiness."
                value={dispensingNotes}
                onChange={(e) => setDispensingNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setConfirmOpen(false); setDispensingNotes(''); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5 font-medium"
              onClick={() => dispense.mutate(getId(selected))}
              disabled={dispense.isPending}
            >
              {dispense.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Confirm Dispense & Deduct Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}

// ──────────── Helper Components ────────────

function PrescriptionRow({
  rx, selected, onClick, badge,
}: { rx: any; selected: boolean; onClick: () => void; badge: React.ReactNode }) {
  const p = rx.patientId;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3.5 hover:bg-muted/50 transition-colors flex items-start justify-between gap-3',
        selected && 'bg-primary/5 border-l-4 border-l-primary',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate text-foreground">{patientName(p)}</p>
          {p?.gender && (
            <span className="text-[10px] text-muted-foreground uppercase">({p.gender.charAt(0)})</span>
          )}
        </div>
        <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{rx.prescriptionNumber}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {rx.items?.length || 0} prescribed medication{rx.items?.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {badge}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    </button>
  );
}

function PrescriptionDetail({
  rx, onDispense, isPending, interactions,
}: { rx: any; onDispense: () => void; isPending: boolean; interactions: string[] }) {
  const isDispensed = rx.status === 'dispensed';
  const isUnpaid = rx.status === 'pending' && !rx.isPaid;
  const canDispense = rx.status === 'pending' && rx.isPaid;
  const patient = rx.patientId;
  const total = rx.totalAmount || rx.items?.reduce((s: number, i: any) => s + (i.quantity * (i.unitPrice || 0)), 0) || 0;
  const patientAllergies = patient?.allergies || patient?.allergyDetails || [];
  const hasAlerts = interactions.length > 0 || patientAllergies.length > 0;

  return (
    <div className="bg-card border rounded-xl shadow-xs overflow-hidden">
      {/* Header Banner */}
      <div
        className={cn(
          'p-5 border-b',
          hasAlerts
            ? 'bg-gradient-to-r from-red-50/70 to-amber-50/70 dark:from-red-950/30 dark:to-amber-950/30 border-red-200'
            : 'bg-gradient-to-r from-primary/5 to-transparent',
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">{patientName(patient)}</h2>
              <Badge variant="outline" className="font-mono text-xs">
                {rx.prescriptionNumber}
              </Badge>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {patient?.patientId && <span className="font-mono">{patient.patientId}</span>}
              {patient?.gender && <span>• {patient.gender}</span>}
              {patient?.age && <span>• {patient.age} yrs</span>}
              {rx.createdAt && (
                <span>
                  • Prescribed {new Date(rx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {(rx.prescribedBy || rx.doctorId) && (
              <div className="flex items-center gap-1.5 mt-2 text-xs">
                <Stethoscope className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold text-foreground">
                  Prescriber: {rx.prescribedBy?.fullName || rx.doctorId?.fullName}
                </span>
                {rx.prescribedBy?.department && (
                  <span className="text-muted-foreground">({rx.prescribedBy.department})</span>
                )}
              </div>
            )}

            {/* Allergy Alerts */}
            {patientAllergies.length > 0 && (
              <Alert variant="destructive" className="mt-3 py-2 px-3">
                <ShieldAlert className="w-4 h-4" />
                <AlertTitle className="text-xs font-bold uppercase tracking-wider">Patient Allergies</AlertTitle>
                <AlertDescription className="text-xs mt-0.5">
                  {Array.isArray(patientAllergies) ? patientAllergies.join(', ') : patientAllergies}
                </AlertDescription>
              </Alert>
            )}

            {/* Drug Interaction Alerts */}
            {interactions.length > 0 && (
              <Alert className="mt-3 py-2 px-3 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertTitle className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Drug Interaction Conflict Warning
                </AlertTitle>
                <AlertDescription className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                  <ul className="list-disc list-inside space-y-0.5">
                    {interactions.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="shrink-0 self-start">
            {isDispensed && (
              <Badge className="bg-emerald-600 gap-1 text-xs py-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Fulfilled
              </Badge>
            )}
            {canDispense && (
              <Badge className="bg-primary text-xs py-1 font-semibold">
                Ready to Dispense
              </Badge>
            )}
            {isUnpaid && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs py-1">
                Awaiting Payment
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Medications List */}
      <div className="p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prescribed Medications & Stock Check
        </h3>

        {rx.items?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prescription items found.</p>
        ) : (
          <div className="border rounded-xl overflow-hidden divide-y">
            {rx.items?.map((item: any, i: number) => {
              const medication = typeof item.medicationId === 'object' ? item.medicationId : null;
              const stock = medication?.stockQuantity;
              const hasStockInfo = typeof stock === 'number';
              const enoughStock = hasStockInfo ? stock >= item.quantity : true;

              return (
                <div key={i} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground">{item.medicationName}</p>
                        {hasStockInfo && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] h-5',
                              enoughStock
                                ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                                : 'border-red-300 text-red-700 bg-red-50',
                            )}
                          >
                            {enoughStock ? `In Stock (${stock} avail)` : `Low Stock (only ${stock} left)`}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        Regimen: <span className="text-foreground font-medium">{item.dosage}</span> •{' '}
                        <span className="text-foreground font-medium">{item.frequency}</span> •{' '}
                        <span className="text-foreground font-medium">{item.duration}</span>
                        {item.route && item.route !== 'oral' && ` • Route: ${item.route}`}
                      </p>

                      {item.instructions && (
                        <p className="text-xs italic text-muted-foreground mt-1.5 bg-muted/50 rounded-md px-2.5 py-1">
                          Label Instructions: {item.instructions}
                        </p>
                      )}

                      {item.pharmacistNote && (
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 bg-amber-50 dark:bg-amber-950/20 rounded-md px-2.5 py-1">
                          Pharmacist Note: {item.pharmacistNote}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <Badge variant={enoughStock ? 'outline' : 'destructive'} className="text-xs font-mono font-bold">
                        Qty {item.quantity}
                      </Badge>
                      {item.unitPrice > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          @ Le {Number(item.unitPrice).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rx.notes && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs">
            <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider mb-1">
              Doctor's Clinical Notes
            </p>
            <p className="text-foreground">{rx.notes}</p>
          </div>
        )}

        {rx.dispensingNotes && (
          <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 p-3 text-xs">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300 uppercase text-[10px] tracking-wider mb-1">
              Pharmacist Dispensing Log
            </p>
            <p className="text-foreground">{rx.dispensingNotes}</p>
          </div>
        )}

        <Separator />

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Prescription Total</p>
            <p className="text-2xl font-extrabold text-foreground">Le {total.toLocaleString()}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                toast.success(`Printing label for prescription ${rx.prescriptionNumber}`);
              }}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Label
            </Button>

            {canDispense && (
              <Button size="default" className="font-bold gap-1.5 shadow-xs" onClick={onDispense} disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pill className="w-4 h-4" />}
                Dispense & Deduct Stock
              </Button>
            )}

            {isUnpaid && (
              <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-medium">
                Pending cashier payment
              </div>
            )}

            {isDispensed && (
              <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                Dispensed on {new Date(rx.dispensedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
