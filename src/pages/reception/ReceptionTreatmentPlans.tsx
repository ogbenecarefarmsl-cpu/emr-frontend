import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import { patientsAPI } from '@/services/api';
import { useMyBranch } from '@/hooks/useBranch';
import { buildTreatmentPlanESCPOS } from '@/utils/escpos';
import { usbPrinterService } from '@/services/usbPrinterService';
import { btPrinterService } from '@/services/bluetoothPrinterService';
import type { TreatmentPlan } from '@/types/treatment-plan';
import { Printer, Eye, Loader2, Send, DollarSign, Wallet, Banknote, Plus, X } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent_to_reception: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-700' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
};

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'orange_money', label: 'Orange Money', icon: Wallet },
  { value: 'afrimoney', label: 'AfriMoney', icon: Wallet },
  { value: 'wallet', label: 'Wallet Balance', icon: Wallet },
];

export default function ReceptionTreatmentPlans() {
  const queryClient = useQueryClient();
  const { data: branch } = useMyBranch();
  const [viewPlan, setViewPlan] = useState<TreatmentPlan | null>(null);
  const [payPlan, setPayPlan] = useState<TreatmentPlan | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [splits, setSplits] = useState<{ amount: string; method: string }[]>([]);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans', 'reception'],
    queryFn: () => treatmentPlanService.findAll(),
    staleTime: 10_000,
  });

  const markPrintedMutation = useMutation({
    mutationFn: (id: string) => treatmentPlanService.markPrinted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount, paymentMethod, payments, notes }: { id: string; amount?: number; paymentMethod?: string; payments?: { amount: number; paymentMethod: string }[]; notes?: string }) =>
      treatmentPlanService.pay(id, payments ? { payments, notes } : { amount, paymentMethod, notes }),
    onSuccess: async (updatedPlan) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      setPayPlan(null);
      setPayAmount('');
      setPayNotes('');
      toast.success(`Payment received — Le ${updatedPlan.amountPaid.toLocaleString()}`);

      // Auto-print treatment plan receipt after payment
      try {
        const patient = typeof updatedPlan.patientId === 'object' ? updatedPlan.patientId : null;
        const visit = typeof updatedPlan.visitId === 'object' ? updatedPlan.visitId : null;
        const bytes = buildTreatmentPlanESCPOS(
          {
            planNumber: updatedPlan.planNumber,
            patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
            patientId: patient?.patientId || '',
            patientAge: patient?.age?.toString(),
            patientGender: patient?.gender,
            patientPhone: patient?.phone,
            visitNumber: visit?.visitNumber,
            items: updatedPlan.items.map((i) => ({ type: i.type, description: i.description, amount: i.amount })),
            totalAmount: updatedPlan.totalAmount,
            amountPaid: updatedPlan.amountPaid,
            balance: updatedPlan.balance,
            paymentStatus: updatedPlan.paymentStatus,
            notes: updatedPlan.notes,
          },
          branch
        );

        let printed = false;
        if (usbPrinterService.isConnected) {
          try { await usbPrinterService.print(bytes); printed = true; } catch {}
        }
        if (!printed && btPrinterService.isConnected) {
          try { await btPrinterService.print(bytes); printed = true; } catch {}
        }
        if (!printed && !usbPrinterService.isConnected) {
          try { if (await usbPrinterService.autoConnect()) { await usbPrinterService.print(bytes); printed = true; } } catch {}
        }
        if (!printed && !btPrinterService.isConnected) {
          try { if (await btPrinterService.autoConnect()) { await btPrinterService.print(bytes); printed = true; } } catch {}
        }
        if (printed) toast.success('Treatment plan receipt printed');
      } catch {
        // Silent — payment succeeded, print is best-effort
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Payment failed');
    },
  });

  const handlePrint = async (plan: TreatmentPlan) => {
    setIsPrinting(true);
    try {
      const freshPlan = await treatmentPlanService.findById(plan._id);
      const patient = typeof freshPlan.patientId === 'object' ? freshPlan.patientId : null;
      const visit = typeof freshPlan.visitId === 'object' ? freshPlan.visitId : null;
      const bytes = buildTreatmentPlanESCPOS(
        {
          planNumber: freshPlan.planNumber,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
          patientId: patient?.patientId || '',
          patientAge: patient?.age?.toString(),
          patientGender: patient?.gender,
          patientPhone: patient?.phone,
          visitNumber: visit?.visitNumber,
          items: freshPlan.items.map((i) => ({ type: i.type, description: i.description, amount: i.amount })),
          totalAmount: freshPlan.totalAmount,
          amountPaid: freshPlan.amountPaid,
          balance: freshPlan.balance,
          paymentStatus: freshPlan.paymentStatus,
          notes: freshPlan.notes,
        },
        branch
      );

      const isPaid = freshPlan.paymentStatus === 'paid' || (freshPlan.balance || 0) <= 0;
      let printed = false;

      // Try USB first
      if (usbPrinterService.isConnected) {
        try { await usbPrinterService.print(bytes); printed = true; } catch {}
      }
      // Try Bluetooth
      if (!printed && btPrinterService.isConnected) {
        try { await btPrinterService.print(bytes); printed = true; } catch {}
      }
      // Try USB auto-connect
      if (!printed && !usbPrinterService.isConnected) {
        try { if (await usbPrinterService.autoConnect()) { await usbPrinterService.print(bytes); printed = true; } } catch {}
      }
      // Try BT auto-connect
      if (!printed && !btPrinterService.isConnected) {
        try { if (await btPrinterService.autoConnect()) { await btPrinterService.print(bytes); printed = true; } } catch {}
      }

      if (printed) {
        // If paid, print second copy
        if (isPaid) {
          await new Promise(r => setTimeout(r, 1000));
          if (usbPrinterService.isConnected) {
            try { await usbPrinterService.print(bytes); } catch {}
          } else if (btPrinterService.isConnected) {
            try { await btPrinterService.print(bytes); } catch {}
          } else {
            // Try reconnect and print second copy
            try {
              if (await btPrinterService.autoConnect()) {
                await btPrinterService.print(bytes);
              } else if (await usbPrinterService.autoConnect()) {
                await usbPrinterService.print(bytes);
              }
            } catch {}
          }
          toast.success('Treatment plan printed (2 copies)');
        } else {
          toast.success('Treatment plan printed (1 copy)');
        }
        markPrintedMutation.mutate(plan._id);
        setViewPlan(null);
        return;
      }

      // No thermal printer available — skip browser print dialog (background only)
      toast.error('No printer connected. Connect a USB or Bluetooth thermal printer.');
    } catch (err: any) {
      toast.error(`Print failed: ${err.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePay = () => {
    if (!payPlan) return;

    // Check if split payments are being used
    const validSplits = splits.filter(s => parseFloat(s.amount) > 0 && s.method);
    if (validSplits.length > 0) {
      const payments = validSplits.map(s => ({ amount: parseFloat(s.amount), paymentMethod: s.method }));
      const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = (payPlan.totalAmount || 0) - (payPlan.amountPaid || 0);
      if (totalPayment > remaining + 0.01) {
        toast.error(`Total payment (Le ${totalPayment.toLocaleString()}) exceeds remaining balance (Le ${remaining.toLocaleString()})`);
        return;
      }
      payMutation.mutate({ id: payPlan._id, payments, notes: payNotes || undefined });
      return;
    }

    // Single payment fallback
    if (!payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const remaining = (payPlan.totalAmount || 0) - (payPlan.amountPaid || 0);
    if (amount > remaining + 0.01) {
      toast.error(`Amount exceeds remaining balance of Le ${remaining.toLocaleString()}`);
      return;
    }
    payMutation.mutate({ id: payPlan._id, amount, paymentMethod: payMethod, notes: payNotes || undefined });
  };

  const addSplit = () => {
    setSplits([...splits, { amount: '', method: 'cash' }]);
  };

  const removeSplit = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: 'amount' | 'method', value: string) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: value };
    setSplits(updated);
  };

  const totalSplitAmount = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  const openPayDialog = async (plan: TreatmentPlan) => {
    setPayPlan(plan);
    const remaining = (plan.totalAmount || 0) - (plan.amountPaid || 0);
    setPayAmount(remaining > 0 ? remaining.toString() : '');
    setPayMethod('cash');
    setPayNotes('');
    setSplits([]);
    // Fetch wallet balance for the patient
    const patientId = typeof plan.patientId === 'object' ? plan.patientId?._id || plan.patientId?.id : plan.patientId;
    if (patientId) {
      try {
        const wallet = await patientsAPI.getWallet(patientId);
        setWalletBalance(wallet?.balance || 0);
      } catch {
        setWalletBalance(0);
      }
    } else {
      setWalletBalance(null);
    }
  };

  const sentPlans = useMemo(
    () => plans.filter((p: TreatmentPlan) => p.status === 'sent_to_reception'),
    [plans]
  );
  const otherPlans = useMemo(
    () => plans.filter((p: TreatmentPlan) => p.status !== 'sent_to_reception'),
    [plans]
  );

  const renderPlanRow = (plan: TreatmentPlan, showPayButton = false) => {
    const status = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft;
    const payStatus = PAYMENT_STATUS_CONFIG[plan.paymentStatus || 'unpaid'];
    const patient = typeof plan.patientId === 'object' ? plan.patientId : null;
    const creator = typeof plan.createdBy === 'object' ? plan.createdBy : null;
    const remaining = (plan.totalAmount || 0) - (plan.amountPaid || 0);

    return (
      <div key={plan._id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs">{plan.planNumber}</span>
            <Badge variant="outline" className={`text-[10px] ${status.color}`}>{status.label}</Badge>
            {payStatus && (
              <Badge variant="outline" className={`text-[10px] ${payStatus.color}`}>
                {payStatus.label}
              </Badge>
            )}
          </div>
          <div className="text-sm mt-1">
            {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
          </div>
          <div className="text-xs text-muted-foreground">
            {plan.items.length} items — Le {plan.totalAmount.toLocaleString()}
            {plan.amountPaid > 0 && ` — Paid: Le ${plan.amountPaid.toLocaleString()}`}
            {remaining > 0 && plan.amountPaid > 0 && ` — Bal: Le ${remaining.toLocaleString()}`}
            {creator && ` — by ${creator.fullName}`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setViewPlan(plan)}>
            <Eye className="h-4 w-4 mr-1" /> View
          </Button>
          {showPayButton && remaining > 0.01 && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => openPayDialog(plan)}
            >
              <DollarSign className="h-4 w-4 mr-1" /> Pay
            </Button>
          )}
          <Button
            size="sm"
            disabled={isPrinting}
            onClick={() => handlePrint(plan)}
          >
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-1" />
            )}
            Print
          </Button>
        </div>
      </div>
    );
  };

  return (
    <RoleLayout title="Treatment Plans" subtitle="View, pay, and print treatment plans" role="receptionist">
      <div className="space-y-6">
        {/* Sent plans queue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Pending Treatment Plans
              {sentPlans.length > 0 && (
                <Badge className="bg-blue-100 text-blue-700">{sentPlans.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentPlans.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No pending treatment plans
              </div>
            ) : (
              <div className="space-y-2">
                {sentPlans.map((plan) => renderPlanRow(plan, true))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Other plans */}
        {otherPlans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Treatment Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {otherPlans.map((plan) => renderPlanRow(plan, plan.status === 'paid' || plan.paymentStatus === 'partial'))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* View plan dialog */}
        {viewPlan && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-6">
            <Card className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border-white/70 shadow-[0_28px_90px_-28px_rgba(15,23,42,0.55)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{viewPlan.planNumber}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setViewPlan(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_CONFIG[viewPlan.status]?.color}>
                    {STATUS_CONFIG[viewPlan.status]?.label}
                  </Badge>
                  {PAYMENT_STATUS_CONFIG[viewPlan.paymentStatus || 'unpaid'] && (
                    <Badge className={PAYMENT_STATUS_CONFIG[viewPlan.paymentStatus || 'unpaid'].color}>
                      {PAYMENT_STATUS_CONFIG[viewPlan.paymentStatus || 'unpaid'].label}
                    </Badge>
                  )}
                  {typeof viewPlan.createdBy === 'object' && (
                    <span className="text-sm text-muted-foreground">
                      by {viewPlan.createdBy.fullName}
                    </span>
                  )}
                </div>

                {typeof viewPlan.patientId === 'object' && (
                  <div className="text-sm">
                    Patient: {viewPlan.patientId.firstName} {viewPlan.patientId.lastName} ({viewPlan.patientId.patientId})
                  </div>
                )}

                <div className="space-y-1">
                  {viewPlan.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span>
                        <Badge variant="outline" className="text-[10px] mr-1">{item.type.toUpperCase()}</Badge>
                        {item.description}
                      </span>
                      <span>Le {item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-semibold">Le {(viewPlan.totalAmount || 0).toLocaleString()}</span>
                  </div>
                  {viewPlan.amountPaid > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Paid:</span>
                      <span>Le {viewPlan.amountPaid.toLocaleString()}</span>
                    </div>
                  )}
                  {(viewPlan.balance || 0) > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Balance:</span>
                      <span className="font-semibold">Le {viewPlan.balance.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {viewPlan.notes && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Notes:</strong> {viewPlan.notes}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {(viewPlan.balance || 0) > 0.01 && (
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => { setViewPlan(null); openPayDialog(viewPlan); }}
                    >
                      <DollarSign className="h-4 w-4 mr-1" /> Receive Payment
                    </Button>
                  )}
                  <Button
                    disabled={isPrinting}
                    onClick={() => handlePrint(viewPlan)}
                  >
                    {isPrinting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4 mr-1" />
                    )}
                    Print Treatment Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payment dialog */}
        {payPlan && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-6">
            <Card className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border-white/70 shadow-[0_28px_90px_-28px_rgba(15,23,42,0.55)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Receive Payment — {payPlan.planNumber}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => { setPayPlan(null); setSplits([]); }}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {typeof payPlan.patientId === 'object' && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Patient: {payPlan.patientId.firstName} {payPlan.patientId.lastName}</span>
                    {walletBalance !== null && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                        <Wallet className="h-3 w-3 mr-1" />Wallet: Le {walletBalance.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="bg-muted p-3 rounded text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>Le {(payPlan.totalAmount || 0).toLocaleString()}</span>
                  </div>
                  {payPlan.amountPaid > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Already Paid:</span>
                      <span>Le {payPlan.amountPaid.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Balance Due:</span>
                    <span>Le {((payPlan.totalAmount || 0) - (payPlan.amountPaid || 0)).toLocaleString()}</span>
                  </div>
                </div>

                {/* Split Payments */}
                {splits.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Split Payment</Label>
                      <span className="text-xs text-muted-foreground">
                        Total: Le {totalSplitAmount.toLocaleString()} / Le {((payPlan.totalAmount || 0) - (payPlan.amountPaid || 0)).toLocaleString()}
                      </span>
                    </div>
                    {splits.map((split, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          step="100"
                          placeholder="Amount"
                          value={split.amount}
                          onChange={(e) => updateSplit(idx, 'amount', e.target.value)}
                          className="flex-1"
                        />
                        <Select value={split.method} onValueChange={(v) => updateSplit(idx, 'method', v)}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => removeSplit(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Single payment (when no splits) */}
                {splits.length === 0 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pay-amount">Amount (Le)</Label>
                      <Input
                        id="pay-amount"
                        type="number"
                        min="1"
                        step="100"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="Enter amount"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select value={payMethod} onValueChange={setPayMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                              {m.value === 'wallet' && walletBalance !== null && walletBalance > 0 && (
                                <span className="text-xs text-muted-foreground ml-1">(Le {walletBalance.toLocaleString()})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="pay-notes">Notes (optional)</Label>
                  <Input
                    id="pay-notes"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Payment notes..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={payMutation.isPending || (splits.length === 0 && !payAmount)}
                    onClick={handlePay}
                  >
                    {payMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <DollarSign className="h-4 w-4 mr-1" />
                    )}
                    {splits.length > 0 ? `Pay Le ${totalSplitAmount.toLocaleString()}` : (payMethod === 'wallet' ? 'Pay from Wallet' : 'Receive Payment')}
                  </Button>
                  {splits.length === 0 && (
                    <Button variant="outline" onClick={addSplit}>
                      <Plus className="h-4 w-4 mr-1" />Split
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setPayPlan(null); setSplits([]); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </RoleLayout>
  );
}
