import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
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
import { toast } from 'sonner';

// Icons
import {
  AlertTriangle, CheckCircle, Clock, Loader2, Package, Pill, Search, User,
  ClipboardList, CreditCard, Send, XCircle, ChevronRight, ArrowRight, Stethoscope,
} from 'lucide-react';

const getId = (v: any) => v?._id || v?.id || v;
const patientName = (p: any) => p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown Patient' : 'Unknown Patient';

export default function PharmacyDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dispensingNotes, setDispensingNotes] = useState('');

  const { data: prescriptions = [], isLoading } = useQuery({
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

  const dispense = useMutation({
    mutationFn: (id: string) => prescriptionService.dispense(id, dispensingNotes.trim() || undefined),
    onSuccess: () => {
      toast.success('Prescription dispensed, stock deducted');
      setSelected(null);
      setConfirmOpen(false);
      setDispensingNotes('');
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['medications'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to dispense');
    },
  });

  // Filter prescriptions into buckets
  const paidWaiting = prescriptions.filter(
    (rx: any) => rx.status === PrescriptionStatusEnum.PENDING && rx.isPaid,
  );
  const unpaid = prescriptions.filter(
    (rx: any) => rx.status === PrescriptionStatusEnum.PENDING && !rx.isPaid,
  );
  const dispensedToday = prescriptions.filter((rx: any) => {
    if (rx.status !== PrescriptionStatusEnum.DISPENSED || !rx.dispensedAt) return false;
    return new Date(rx.dispensedAt).toDateString() === new Date().toDateString();
  });

  // Filter by search
  const filter = (list: any[]) => {
    if (!searchTerm) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((rx: any) =>
      patientName(rx.patientId).toLowerCase().includes(q) ||
      rx.prescriptionNumber?.toLowerCase().includes(q),
    );
  };

  const filteredPaid = filter(paidWaiting);
  const filteredUnpaid = filter(unpaid);
  const filteredDispensed = filter(dispensedToday);

  return (
    <RoleLayout
      title="Pharmacy"
      subtitle="Dispense prescriptions and monitor stock"
      role="pharmacist"
      userName={profile?.fullName}
    >
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Ready to Dispense"
          value={paidWaiting.length}
          icon={ClipboardList}
          variant={paidWaiting.length > 0 ? 'primary' : 'default'}
        />
        <MetricCard
          title="Awaiting Payment"
          value={unpaid.length}
          icon={CreditCard}
          variant={unpaid.length > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Dispensed Today"
          value={dispensedToday.length}
          icon={CheckCircle}
        />
        <MetricCard
          title="Low Stock Alerts"
          value={lowStock.length}
          icon={AlertTriangle}
          variant={lowStock.length > 0 ? 'critical' : 'default'}
        />
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by patient name or prescription number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Main two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Prescription queues */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-xl shadow-sm">
            <Tabs defaultValue="paid">
              <div className="border-b px-3 pt-2">
                <TabsList className="bg-transparent h-auto p-0 gap-1">
                  <TabsTrigger value="paid" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                    Ready
                    {paidWaiting.length > 0 && (
                      <Badge className="ml-1.5 h-4 min-w-4 text-[10px]">{paidWaiting.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="unpaid" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                    Unpaid
                    {unpaid.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 text-[10px]">{unpaid.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="done" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                    Done
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Paid waiting list */}
              <TabsContent value="paid" className="mt-0">
                <ScrollArea className="max-h-[calc(100vh-340px)]">
                  {isLoading ? (
                    <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : filteredPaid.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      {searchTerm ? 'No matches' : 'No prescriptions ready to dispense'}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredPaid.map((rx: any) => (
                        <PrescriptionRow
                          key={getId(rx)}
                          rx={rx}
                          selected={selected && getId(selected) === getId(rx)}
                          onClick={() => setSelected(rx)}
                          badge={<Badge className="bg-green-500 text-[10px]">Paid</Badge>}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Unpaid list */}
              <TabsContent value="unpaid" className="mt-0">
                <ScrollArea className="max-h-[calc(100vh-340px)]">
                  {filteredUnpaid.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      {searchTerm ? 'No matches' : 'No unpaid prescriptions'}
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
                <ScrollArea className="max-h-[calc(100vh-340px)]">
                  {filteredDispensed.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      Nothing dispensed yet today
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
                            <Badge variant="outline" className="bg-slate-50 text-[10px]">
                              <CheckCircle className="w-3 h-3 mr-0.5" />
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

          {/* Low stock warning card */}
          {lowStock.length > 0 && (
            <div className="bg-card border rounded-xl shadow-sm mt-4 border-l-4 border-l-amber-500">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Low Stock
                </h3>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/pharmacy/inventory')}>
                  View all <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
              <div className="divide-y">
                {lowStock.slice(0, 3).map((m: any) => (
                  <div key={m._id} className="px-4 py-2 flex items-center justify-between">
                    <p className="text-sm truncate">{m.name}</p>
                    <Badge variant="destructive" className="text-[10px]">
                      {m.stockQuantity} left
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Prescription detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <PrescriptionDetail
              rx={selected}
              onDispense={() => setConfirmOpen(true)}
              isPending={dispense.isPending}
            />
          ) : (
            <div className="bg-card border rounded-xl shadow-sm flex flex-col items-center justify-center h-96 text-muted-foreground p-6 text-center">
              <Pill className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No Prescription Selected</p>
              <p className="text-sm mt-1 max-w-sm">
                Select a prescription from the left to review medications and dispense.
              </p>
              {paidWaiting.length > 0 && (
                <p className="text-xs mt-3 text-primary">
                  {paidWaiting.length} ready to dispense
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dispense confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setDispensingNotes(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Dispense</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Dispensing will deduct the following quantities from stock:
            </p>
            <div className="border rounded-lg divide-y">
              {selected?.items?.map((item: any, i: number) => (
                <div key={i} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.medicationName}</span>
                    <Badge variant="outline">Qty {item.quantity}</Badge>
                  </div>
                  {item.instructions && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                      Label: {item.instructions}
                    </p>
                  )}
                  {item.pharmacistNote && (
                    <p className="text-xs text-amber-700 mt-0.5">
                      ⚠ {item.pharmacistNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium">
                Dispensing Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                placeholder="e.g. Counselled patient on storage. Brand substituted — same generic."
                value={dispensingNotes}
                onChange={(e) => setDispensingNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setDispensingNotes(''); }}>Cancel</Button>
            <Button
              onClick={() => dispense.mutate(getId(selected))}
              disabled={dispense.isPending}
            >
              {dispense.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Send className="w-4 h-4 mr-2" />}
              Confirm Dispense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}

// ──────────── Helpers ────────────

function PrescriptionRow({
  rx, selected, onClick, badge,
}: { rx: any; selected: boolean; onClick: () => void; badge: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start justify-between gap-2',
        selected && 'bg-primary/5 border-l-2 border-primary',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{patientName(rx.patientId)}</p>
        <p className="text-xs text-muted-foreground truncate">{rx.prescriptionNumber}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {rx.items?.length || 0} medication{rx.items?.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {badge}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    </button>
  );
}

function PrescriptionDetail({
  rx, onDispense, isPending,
}: { rx: any; onDispense: () => void; isPending: boolean }) {
  const isDispensed = rx.status === 'dispensed';
  const isUnpaid = rx.status === 'pending' && !rx.isPaid;
  const canDispense = rx.status === 'pending' && rx.isPaid;
  const patient = rx.patientId;
  const total = rx.totalAmount || rx.items?.reduce((s: number, i: any) => s + (i.quantity * (i.unitPrice || 0)), 0) || 0;

  return (
    <div className="bg-card border rounded-xl shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">{patientName(patient)}</h2>
              <Badge variant="outline">{rx.prescriptionNumber}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {patient?.patientId && <span>{patient.patientId}</span>}
              {patient?.gender && <><span>·</span><span>{patient.gender}</span></>}
              {patient?.age && <><span>·</span><span>{patient.age} yrs</span></>}
              {rx.createdAt && (
                <>
                  <span>·</span>
                  <span>Prescribed {new Date(rx.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
            {/* Prescribing doctor — always shown so pharmacist knows who wrote it */}
            {(rx.prescribedBy || rx.doctorId) && (
              <div className="flex items-center gap-1.5 mt-1.5 text-sm">
                <Stethoscope className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">
                  {rx.prescribedBy?.fullName || rx.doctorId?.fullName}
                </span>
                {rx.prescribedBy?.department && (
                  <span className="text-muted-foreground">· {rx.prescribedBy.department}</span>
                )}
              </div>
            )}
            {patient?.allergies?.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs text-red-600 font-medium">
                  Allergies: {patient.allergies.join(', ')}
                </span>
              </div>
            )}
          </div>
          <div>
            {isDispensed && <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Dispensed</Badge>}
            {canDispense && <Badge className="bg-primary">Ready to dispense</Badge>}
            {isUnpaid && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Awaiting payment</Badge>}
          </div>
        </div>
      </div>

      {/* Medications list */}
      <div className="p-5">
        <h3 className="text-sm font-semibold mb-3">Medications</h3>
        {rx.items?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items</p>
        ) : (
          <div className="border rounded-lg overflow-hidden divide-y">
            {rx.items?.map((item: any, i: number) => {
              const medication = typeof item.medicationId === 'object' ? item.medicationId : null;
              const stock = medication?.stockQuantity;
              const hasStockInfo = typeof stock === 'number';
              const enoughStock = hasStockInfo ? stock >= item.quantity : true;

              return (
              <div key={i} className="p-4 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{item.medicationName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.dosage} · {item.frequency} · {item.duration}
                      {item.route && item.route !== 'oral' && ` · ${item.route}`}
                    </p>
                    {hasStockInfo && (
                      <p className={cn('text-xs mt-1 font-medium', enoughStock ? 'text-emerald-600' : 'text-red-600')}>
                        Stock: {stock} available{enoughStock ? '' : `, needs ${item.quantity}`}
                      </p>
                    )}
                    {item.instructions && (
                      <p className="text-xs italic text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                        Label: {item.instructions}
                      </p>
                    )}
                    {item.pharmacistNote && (
                      <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded px-2 py-1">
                        ⚠ {item.pharmacistNote}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant={enoughStock ? 'outline' : 'destructive'}>Qty {item.quantity}</Badge>
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
          <>
            <Separator className="my-4" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Doctor's Notes
              </p>
              <p className="text-sm">{rx.notes}</p>
            </div>
          </>
        )}

        {rx.dispensingNotes && (
          <>
            <Separator className="my-4" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Dispensing Notes
              </p>
              <p className="text-sm">{rx.dispensingNotes}</p>
            </div>
          </>
        )}

        <Separator className="my-4" />

        {/* Total + action */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold">Le {total.toLocaleString()}</p>
          </div>
          {canDispense && (
            <Button size="lg" onClick={onDispense} disabled={isPending}>
              {isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Pill className="w-4 h-4 mr-2" />}
              Dispense & Deduct Stock
            </Button>
          )}
          {isUnpaid && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Waiting on reception</p>
              <p className="text-sm font-medium text-amber-700">Cannot dispense yet</p>
            </div>
          )}
          {isDispensed && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Dispensed</p>
              <p className="text-sm font-medium text-green-700">
                {new Date(rx.dispensedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

