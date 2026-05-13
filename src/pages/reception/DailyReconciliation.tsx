import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useExpectedAmounts,
  useCreateReconciliation,
  useReconciliations,
} from '@/hooks/useReconciliation';
import { useDailyIncome, useOutstandingBalances } from '@/hooks/useOrders';
import { useExpenditures, useCreateExpenditure, useDeleteExpenditure } from '@/hooks/useExpenditures';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Calculator,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Banknote,
  Smartphone,
  TrendingDown,
  Receipt,
  Plus,
  Trash2,
  ShoppingCart,
  FlaskConical,
  Wrench,
  Zap,
  Truck,
  Users,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'supplies', label: 'Supplies', icon: ShoppingCart },
  { value: 'reagents', label: 'Reagents', icon: FlaskConical },
  { value: 'equipment', label: 'Equipment', icon: Wrench },
  { value: 'utilities', label: 'Utilities', icon: Zap },
  { value: 'transport', label: 'Transport', icon: TransportIcon },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'staff', label: 'Staff', icon: Users },
  { value: 'cleaning', label: 'Cleaning', icon: Sparkles },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

function TransportIcon(props: any) {
  return <Truck {...props} />;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'afrimoney', label: 'Afrimoney' },
  { value: 'other', label: 'Other' },
];

export default function DailyReconciliation() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  
  // Reconciliation Form State
  const [actualCash, setActualCash] = useState('');
  const [actualOrangeMoney, setActualOrangeMoney] = useState('');
  const [actualAfrimoney, setActualAfrimoney] = useState('');
  const [notes, setNotes] = useState('');

  // Expenditure Form State
  const [showAddExpenditure, setShowAddExpenditure] = useState(false);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState('supplies');
  const [payMethod, setPayMethod] = useState('cash');
  const [receiptNum, setReceiptNum] = useState('');
  const [vend, setVend] = useState('');
  const [expNotes, setExpNotes] = useState('');

  const todayStart = new Date(selectedDate);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(selectedDate);
  todayEnd.setHours(23, 59, 59, 999);

  const { data: expected, isLoading: loadingExpected } = useExpectedAmounts(selectedDate);
  const { data: reconciliations } = useReconciliations('all');
  const createReconciliation = useCreateReconciliation();

  const { data: dailyIncome } = useDailyIncome(todayStart.toISOString(), todayEnd.toISOString());
  const todayData = Array.isArray(dailyIncome) && dailyIncome.length > 0 ? dailyIncome[0] : null;

  const { data: outstandingData } = useOutstandingBalances();

  const { data: expenditures, isLoading: loadingExp } = useExpenditures({
    startDate: todayStart.toISOString(),
    endDate: todayEnd.toISOString(),
  });
  const createExpenditure = useCreateExpenditure();
  const deleteExpenditure = useDeleteExpenditure();

  const actualCashNum = parseFloat(actualCash) || 0;
  const actualOrangeNum = parseFloat(actualOrangeMoney) || 0;
  const actualAfriNum = parseFloat(actualAfrimoney) || 0;
  const actualTotal = actualCashNum + actualOrangeNum + actualAfriNum;

  // Expenditures per method — for display purposes only
  const cashExpendituresTotal = Array.isArray(expenditures) 
    ? expenditures.filter(e => e.paymentMethod === 'cash').reduce((sum, e) => sum + (e.amount || 0), 0)
    : 0;

  const orangeExpendituresTotal = Array.isArray(expenditures)
    ? expenditures.filter(e => e.paymentMethod === 'orange_money').reduce((sum, e) => sum + (e.amount || 0), 0)
    : 0;

  const afriExpendituresTotal = Array.isArray(expenditures)
    ? expenditures.filter(e => e.paymentMethod === 'afrimoney').reduce((sum, e) => sum + (e.amount || 0), 0)
    : 0;

  // Net expected cash at hand = backend already deducts per-method expenditures from income
  // Do NOT re-deduct here — that caused double-counting
  const netExpectedCash = expected?.expectedCash || 0;
  const netExpectedOrange = expected?.expectedOrangeMoney || 0;
  const netExpectedAfri = expected?.expectedAfrimoney || 0;
  const netExpectedTotal = netExpectedCash + netExpectedOrange + netExpectedAfri;

  // Variance = expected − actual: positive = shortage, negative = surplus
  const cashVariance = netExpectedCash - actualCashNum;
  const orangeVariance = netExpectedOrange - actualOrangeNum;
  const afriVariance = netExpectedAfri - actualAfriNum;
  const totalVariance = netExpectedTotal - actualTotal;

  const hasVariance = Math.abs(totalVariance) > 0.01;

  const handleSubmitReconciliation = async () => {
    if (actualCash === '' || actualOrangeMoney === '' || actualAfrimoney === '') {
      toast.error('Please enter all actual amounts (enter 0 if none)');
      return;
    }

    if (hasVariance && !notes) {
      toast.error('Please provide notes explaining the variance');
      return;
    }

    try {
      await createReconciliation.mutateAsync({
        reconciliationDate: new Date(selectedDate),
        actualCash: actualCashNum,
        actualOrangeMoney: actualOrangeNum,
        actualAfrimoney: actualAfriNum,
        notes: notes || undefined,
      });

      toast.success('Reconciliation submitted successfully');
      setActualCash('');
      setActualOrangeMoney('');
      setActualAfrimoney('');
      setNotes('');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to submit reconciliation');
    }
  };

  const handleAddExpenditure = async () => {
    if (!desc.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (!amt || parseFloat(amt) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await createExpenditure.mutateAsync({
        description: desc.trim(),
        amount: parseFloat(amt),
        category: cat,
        expenditureDate: new Date(selectedDate),
        paymentMethod: payMethod,
        receiptNumber: receiptNum || undefined,
        vendor: vend || undefined,
        notes: expNotes || undefined,
      });

      toast.success('Expenditure recorded successfully');
      setShowAddExpenditure(false);
      setDesc('');
      setAmt('');
      setCat('supplies');
      setPayMethod('cash');
      setReceiptNum('');
      setVend('');
      setExpNotes('');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || 'Failed to record expenditure');
    }
  };

  const handleDeleteExpenditure = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expenditure?')) return;
    try {
      await deleteExpenditure.mutateAsync(id);
      toast.success('Expenditure deleted');
    } catch {
      toast.error('Failed to delete expenditure');
    }
  };

  const getCategoryIcon = (categoryVal: string) => {
    const found = CATEGORIES.find((c) => c.value === categoryVal);
    return found ? found.icon : HelpCircle;
  };

  const todayReconciliation = reconciliations?.find((r: any) => {
    const recDate = new Date(r.reconciliationDate).toISOString().split('T')[0];
    return recDate === selectedDate;
  });

  const statusStyles = {
    pending: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    approved: 'bg-status-normal/10 text-status-normal border-status-normal/20',
    rejected: 'bg-status-critical/10 text-status-critical border-status-critical/20',
  };

  return (
    <RoleLayout
      title="Daily Reconciliation"
      subtitle="Submit end-of-day cash reconciliation and record expenses"
      role="receptionist"
      userName={profile?.full_name}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Label className="text-muted-foreground">Select Date</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-40"
          />
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Expected After Expenses */}
        <div className="bg-card border-l-4 border-l-primary border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Net Expected Total</p>
            <p className="text-3xl font-bold mt-1">
              Le {netExpectedTotal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-amber-600">
              Le {(expected?.incomeCash || 0) + (expected?.incomeOrangeMoney || 0) + (expected?.incomeAfrimoney || 0) > 0
                ? `Le ${((expected?.incomeCash || 0) + (expected?.incomeOrangeMoney || 0) + (expected?.incomeAfrimoney || 0)).toLocaleString()} (Collected) − Le ${(expected?.totalExpenditures || cashExpendituresTotal + orangeExpendituresTotal + afriExpendituresTotal).toLocaleString()} (Expenses)`
                : 'Gross collected minus expenditures'}
            </p>
          </div>
        </div>

        {/* Collected Today */}
        <div className="bg-card border-l-4 border-l-status-normal border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-status-normal/10">
            <Banknote className="w-6 h-6 text-status-normal" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Gross Collected Today</p>
            <p className="text-3xl font-bold text-status-normal mt-1">
              Le {(todayData?.totalIncome || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From {todayData?.paymentCount || 0} order payments today
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Banknote className="w-3 h-3" /> Expected Cash
          </p>
          <p className="text-xl font-bold mt-1">
            Le {netExpectedCash.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Less cash expenses</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-orange-500" /> Orange / Afrimoney
          </p>
          <p className="text-xl font-bold mt-1">
            Le {(netExpectedOrange + netExpectedAfri).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Expected mobile</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Receipt className="w-3 h-3 text-status-critical" /> Total Expenses
          </p>
          <p className="text-xl font-bold text-status-critical mt-1">
            Le {(cashExpendituresTotal + orangeExpendituresTotal + afriExpendituresTotal).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{Array.isArray(expenditures) ? expenditures.length : 0} items</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-amber-600" /> Outstanding
          </p>
          <p className="text-xl font-bold text-amber-600 mt-1">
            Le {(outstandingData?.summary?.totalOutstanding || 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            System total pending
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Expenditures Section */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              Expenditures & Expenses
            </h3>
            <Button size="sm" onClick={() => setShowAddExpenditure(true)} disabled={!!todayReconciliation}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          
          <div className="space-y-3">
            {loadingExp ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : Array.isArray(expenditures) && expenditures.length > 0 ? (
              expenditures.map((exp: any) => {
                const CatIcon = getCategoryIcon(exp.category);
                return (
                  <div key={exp._id || exp.id} className="flex flex-col border rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium">{exp.description}</p>
                      <p className="font-bold text-status-critical">Le {Number(exp.amount).toLocaleString()}</p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 capitalize"><CatIcon className="w-3.5 h-3.5" /> {exp.category}</span>
                        <span className="capitalize">{exp.paymentMethod?.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {exp.flagged && (
                          <Badge variant="outline" className="bg-status-critical/10 text-status-critical text-[10px] py-0">Flagged</Badge>
                        )}
                        {!todayReconciliation && !exp.flagged && (
                          <button onClick={() => handleDeleteExpenditure(exp._id || exp.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {exp.flagged && exp.flagReason && (
                      <p className="mt-2 text-xs text-status-critical bg-status-critical/10 p-2 rounded w-full">
                        <strong>Admin Flag:</strong> {exp.flagReason}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-center text-sm text-muted-foreground py-4">No expenditures recorded today</p>
            )}
          </div>
        </div>

        {/* Reconciliation Form */}
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-muted-foreground" />
              Final Summary & Count
            </h3>

            {todayReconciliation ? (
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-status-normal" />
                  <p className="font-medium">Reconciliation Already Submitted</p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Submitted on {format(new Date(todayReconciliation.submittedAt), 'MMM dd, yyyy HH:mm')}
                </p>
                <div className="flex justify-between items-center">
                  <Badge
                    variant="outline"
                    className={cn('capitalize', statusStyles[todayReconciliation.status as keyof typeof statusStyles])}
                  >
                    {todayReconciliation.status}
                  </Badge>
                  {todayReconciliation.reviewNotes && (
                    <span className="text-xs text-muted-foreground italic max-w-[200px] truncate text-right">
                      Notes: {todayReconciliation.reviewNotes}
                    </span>
                  )}
                </div>
              </div>
            ) : loadingExpected ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Actual Amounts */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-muted-foreground" />
                    Enter Final Drawer Count (Net)
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5" /> Cash (Le)
                      </Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-orange-500" /> Orange Money (Le)
                      </Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={actualOrangeMoney}
                        onChange={(e) => setActualOrangeMoney(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-red-500" /> Afrimoney (Le)
                      </Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={actualAfrimoney}
                        onChange={(e) => setActualAfrimoney(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                {/* Variance Display */}
                {(actualCash || actualOrangeMoney || actualAfrimoney) && (
                  <div
                    className={cn(
                      'rounded-lg p-4',
                      hasVariance
                        ? 'bg-status-warning/10 border border-status-warning/20'
                        : 'bg-status-normal/10 border border-status-normal/20'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {hasVariance ? (
                        <>
                          <AlertTriangle className="w-5 h-5 text-status-warning" />
                          <h4 className="font-medium">Variance Detected</h4>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-status-normal" />
                          <h4 className="font-medium">Balanced</h4>
                        </>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Banknote className="w-3 h-3" /> Net Cash Variance:
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            cashVariance > 0 ? 'text-status-critical' : cashVariance < 0 ? 'text-status-normal' : ''
                          )}
                        >
                          {cashVariance > 0 ? '+' : ''}Le {cashVariance.toLocaleString()}
                          {cashVariance > 0 ? ' (Shortage)' : cashVariance < 0 ? ' (Surplus)' : ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Smartphone className="w-3 h-3" /> Orange Money Variance:
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            orangeVariance > 0 ? 'text-status-critical' : orangeVariance < 0 ? 'text-status-normal' : ''
                          )}
                        >
                          {orangeVariance > 0 ? '+' : ''}Le {orangeVariance.toLocaleString()}
                          {orangeVariance > 0 ? ' (Shortage)' : orangeVariance < 0 ? ' (Surplus)' : ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Smartphone className="w-3 h-3" /> Afrimoney Variance:
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            afriVariance > 0 ? 'text-status-critical' : afriVariance < 0 ? 'text-status-normal' : ''
                          )}
                        >
                          {afriVariance > 0 ? '+' : ''}Le {afriVariance.toLocaleString()}
                          {afriVariance > 0 ? ' (Shortage)' : afriVariance < 0 ? ' (Surplus)' : ''}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-bold mt-2">
                        <span>Total Net Variance:</span>
                        <span
                          className={cn(
                            totalVariance > 0 ? 'text-status-critical' : totalVariance < 0 ? 'text-status-normal' : ''
                          )}
                        >
                          {totalVariance > 0 ? '+' : ''}Le {totalVariance.toLocaleString()}
                          {totalVariance > 0 ? ' — Shortage' : totalVariance < 0 ? ' — Surplus' : ' — Balanced'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {hasVariance && (
                  <div>
                    <Label>
                      Notes <span className="text-status-critical">*</span>
                    </Label>
                    <Textarea
                      placeholder="Explain the variance (required when there's a difference)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}

                <Button
                  onClick={handleSubmitReconciliation}
                  disabled={createReconciliation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {createReconciliation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  <Calculator className="w-4 h-4 mr-2" />
                  Submit Reconciliation
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Expenditure Dialog */}
      <Dialog open={showAddExpenditure} onOpenChange={setShowAddExpenditure}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Day's Expenditure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Description</Label>
              <Input placeholder="What was purchased/paid for?" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (Le)</Label>
                <Input type="number" min="0" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={cat} onValueChange={setCat}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Receipt / Invoice #</Label>
                <Input value={receiptNum} onChange={e => setReceiptNum(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={vend} onChange={e => setVend(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label>Additional Notes</Label>
              <Textarea value={expNotes} onChange={e => setExpNotes(e.target.value)} placeholder="Optional details..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenditure(false)}>Cancel</Button>
            <Button onClick={handleAddExpenditure} disabled={createExpenditure.isPending}>
              {createExpenditure.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Expenditure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
