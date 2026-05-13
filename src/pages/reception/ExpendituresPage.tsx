import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useExpenditures,
  useCreateExpenditure,
  useDeleteExpenditure,
} from '@/hooks/useExpenditures';
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
  Plus,
  Loader2,
  Receipt,
  Banknote,
  Trash2,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Wrench,
  Zap,
  Truck,
  Users,
  Sparkles,
  FlaskConical,
  HelpCircle,
  Calendar,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'supplies', label: 'Supplies', icon: ShoppingCart },
  { value: 'reagents', label: 'Reagents', icon: FlaskConical },
  { value: 'equipment', label: 'Equipment', icon: Wrench },
  { value: 'utilities', label: 'Utilities', icon: Zap },
  { value: 'transport', label: 'Transport', icon: Truck },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'staff', label: 'Staff', icon: Users },
  { value: 'cleaning', label: 'Cleaning', icon: Sparkles },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export default function ExpendituresPage() {
  const { profile, primaryRole } = useAuth();
  const currentRole = primaryRole === 'admin' ? 'admin' : 'receptionist';

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('supplies');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [expenditureDate, setExpenditureDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Get date range
  const getDateRange = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = new Date();

    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = subDays(start, 7);
        break;
      case 'month':
        start = subDays(start, 30);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  };

  const { startDate, endDate } = getDateRange();
  const { data: expenditures, isLoading } = useExpenditures({
    startDate,
    endDate,
    category: categoryFilter,
  });
  const createExpenditure = useCreateExpenditure();
  const deleteExpenditure = useDeleteExpenditure();

  const totalSpent = Array.isArray(expenditures)
    ? expenditures.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    : 0;

  const approvedTotal = Array.isArray(expenditures)
    ? expenditures
        .filter((e: any) => e.approved)
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    : 0;

  const pendingTotal = totalSpent - approvedTotal;

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('supplies');
    setPaymentMethod('cash');
    setReceiptNumber('');
    setVendor('');
    setNotes('');
    setExpenditureDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await createExpenditure.mutateAsync({
        description: description.trim(),
        amount: parseFloat(amount),
        category,
        expenditureDate: new Date(expenditureDate),
        paymentMethod,
        receiptNumber: receiptNumber || undefined,
        vendor: vendor || undefined,
        notes: notes || undefined,
      });

      toast.success('Expenditure recorded successfully');
      setShowAddDialog(false);
      resetForm();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError?.response?.data?.message || 'Failed to record expenditure'
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expenditure?')) return;
    try {
      await deleteExpenditure.mutateAsync(id);
      toast.success('Expenditure deleted');
    } catch {
      toast.error('Failed to delete expenditure');
    }
  };

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find((c) => c.value === cat);
    return found ? found.icon : HelpCircle;
  };

  const getCategoryLabel = (cat: string) => {
    const found = CATEGORIES.find((c) => c.value === cat);
    return found ? found.label : cat;
  };

  return (
    <RoleLayout
      title="Expenditures"
      subtitle="Record and track daily expenses"
      role={currentRole as any}
      userName={profile?.full_name}
    >
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border-l-4 border-l-status-critical border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-status-critical/10">
            <Receipt className="w-6 h-6 text-status-critical" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              Total Expenditure ({dateRange === 'today' ? 'Today' : dateRange === 'week' ? '7 Days' : '30 Days'})
            </p>
            <p className="text-3xl font-bold text-status-critical mt-1">
              Le {totalSpent.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {Array.isArray(expenditures) ? expenditures.length : 0} expense(s) recorded
            </p>
          </div>
        </div>

        <div className="bg-card border-l-4 border-l-status-normal border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-status-normal/10">
            <CheckCircle2 className="w-6 h-6 text-status-normal" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Approved</p>
            <p className="text-3xl font-bold text-status-normal mt-1">
              Le {approvedTotal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Le {pendingTotal.toLocaleString()} pending approval
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Add Button */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Expenditure
        </Button>
      </div>

      {/* Expenditures List */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(expenditures) &&
                expenditures.map((exp: any) => {
                  const CatIcon = getCategoryIcon(exp.category);
                  return (
                    <tr key={exp._id || exp.id}>
                      <td className="text-sm">
                        {format(new Date(exp.expenditureDate), 'MMM dd, yyyy')}
                      </td>
                      <td>
                        <div>
                          <p className="font-medium">{exp.description}</p>
                          {exp.receiptNumber && (
                            <p className="text-xs text-muted-foreground">
                              Rcpt: {exp.receiptNumber}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 text-sm capitalize">
                          <CatIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          {getCategoryLabel(exp.category)}
                        </span>
                      </td>
                      <td className="font-bold text-status-critical">
                        Le {Number(exp.amount).toLocaleString()}
                      </td>
                      <td className="capitalize text-sm text-muted-foreground">
                        {exp.paymentMethod?.replace(/_/g, ' ')}
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {exp.vendor || '-'}
                      </td>
                      <td>
                        <Badge
                          variant="outline"
                          className={cn(
                            exp.approved
                              ? 'bg-status-normal/10 text-status-normal'
                              : 'bg-status-warning/10 text-status-warning'
                          )}
                        >
                          {exp.approved ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Approved
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </>
                          )}
                        </Badge>
                      </td>
                      <td>
                        {!exp.approved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(exp._id || exp.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {(!expenditures || expenditures.length === 0) && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No expenditures found for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Expenditure Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Expenditure</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Blood collection tubes, Printer paper..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (Le) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={expenditureDate}
                  onChange={(e) => setExpenditureDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor / Supplier</Label>
                <Input
                  placeholder="Optional"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              </div>
              <div>
                <Label>Receipt Number</Label>
                <Input
                  placeholder="Optional"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createExpenditure.isPending}
            >
              {createExpenditure.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              <Banknote className="w-4 h-4 mr-2" />
              Record Expenditure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
