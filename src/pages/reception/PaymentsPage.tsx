import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useOrders, useAddPayment, usePaymentHistory, usePaymentStats, useDailyIncome } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, CreditCard, Banknote, Smartphone, Check, Loader2, Receipt, TrendingUp, Calendar, History, Plus } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { OrderWithDetails } from '@/hooks/useOrders';

export default function PaymentsPage() {
  const navigate = useNavigate();
  const { profile, primaryRole } = useAuth();
  const currentRole = primaryRole === 'admin' ? 'admin' : 'receptionist';
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [splitRows, setSplitRows] = useState<Array<{ method: string; amount: string }>>([
    { method: 'cash', amount: '' },
  ]);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyOrderId, setHistoryOrderId] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('today');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const { data: orders, isLoading } = useOrders('all');
  const addPayment = useAddPayment();
  const { data: paymentHistory, isLoading: historyLoading } = usePaymentHistory(historyOrderId);
  
  // Get date range for stats
  const getDateRange = () => {
    const end = new Date().toISOString();
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
    
    return { start: start.toISOString(), end };
  };
  
  const { start, end } = getDateRange();
  const { data: paymentStats } = usePaymentStats(start, end);
  const { data: dailyIncome } = useDailyIncome(start, end);

  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
    // Filter by payment status
    const paymentStatus = order.paymentStatus || order.payment_status;
    if (paymentFilter !== 'all' && paymentStatus !== paymentFilter) return false;
    
    // Filter by search
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const orderNum = (order.orderNumber || order.order_number || '').toLowerCase();
    const firstName = (order.patientId?.firstName || order.patients?.first_name || '').toLowerCase();
    const lastName = (order.patientId?.lastName || order.patients?.last_name || '').toLowerCase();
    
    return (
      orderNum.includes(search) ||
      firstName.includes(search) ||
      lastName.includes(search)
    );
  }) : [];

  const pendingTotal = Array.isArray(orders) ? orders
    .filter(o => ['pending', 'partial'].includes(o.paymentStatus || o.payment_status || ''))
    .reduce((sum, o) => sum + Number(o.balance ?? (Number(o.total || o.totalAmount || 0) - Number(o.amountPaid || 0))), 0) : 0;

  const paidTodayTotal = Array.isArray(orders) ? orders
    .filter(o => {
      const paymentStatus = o.paymentStatus || o.payment_status;
      if (paymentStatus !== 'paid') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(o.createdAt || o.created_at) >= today;
    })
    .reduce((sum, o) => sum + Number(o.amountPaid || o.total || o.totalAmount || 0), 0) : 0;

  const handleProcessPayment = async () => {
    if (!selectedOrder || isProcessingPayment || addPayment.isPending) return;
    setIsProcessingPayment(true);

    const orderId = selectedOrder.id || selectedOrder._id;
    const orderTotal = Number(selectedOrder.total || selectedOrder.totalAmount || 0);
    const alreadyPaid = Number(selectedOrder.amountPaid ?? selectedOrder.paidAmount ?? 0);
    const remaining = orderTotal - alreadyPaid;

    const validRows = splitRows.filter(r => r.method && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      toast.error('Enter at least one payment amount');
      setIsProcessingPayment(false);
      return;
    }
    const splitTotal = validRows.reduce((s, r) => s + parseFloat(r.amount), 0);
    if (splitTotal > remaining + 0.001) {
      toast.error(`Total Le ${splitTotal.toLocaleString()} exceeds remaining balance Le ${remaining.toLocaleString()}`);
      setIsProcessingPayment(false);
      return;
    }

    try {
      for (const row of validRows) {
        await addPayment.mutateAsync({
          orderId,
          data: { amount: parseFloat(row.amount), paymentMethod: row.method },
        });
      }
      
      const newTotalPaid = alreadyPaid + splitTotal;
      const isFullyPaid = newTotalPaid >= orderTotal - 0.001;
      
      toast.success(`Payment of Le ${splitTotal.toLocaleString()} recorded`);
      setShowPaymentDialog(false);
      setSelectedOrder(null);
      setSplitRows([{ method: 'cash', amount: '' }]);
      
      // Navigate to receipt page if fully paid
      if (isFullyPaid) {
        setTimeout(() => {
          navigate(`/reception/receipt/${orderId}`);
        }, 500);
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || 'Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <RoleLayout 
      title="Payments" 
      subtitle="Process and track order payments"
      role={currentRole as any}
      userName={profile?.full_name}
    >
      {/* Date Range Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Outstanding Balance — Primary */}
        <div className="bg-card border-l-4 border-l-amber-500 border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10">
            <CreditCard className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">
              Le {pendingTotal.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From pending & partially paid orders
            </p>
          </div>
        </div>

        {/* Collected Revenue — Primary */}
        <div className="bg-card border-l-4 border-l-status-normal border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-status-normal/10">
            <Banknote className="w-6 h-6 text-status-normal" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Collected ({dateRange === 'today' ? 'Today' : dateRange === 'week' ? '7 Days' : '30 Days'})</p>
            <p className="text-3xl font-bold text-status-normal mt-1">
              Le {(paymentStats?.paidRevenue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentStats?.paidOrders || 0} fully paid orders
            </p>
          </div>
        </div>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-bold mt-1">
            Le {(paymentStats?.totalRevenue || 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {paymentStats?.totalOrders || 0} orders
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Avg Daily Income
          </p>
          <p className="text-xl font-bold mt-1">
            Le {dailyIncome && dailyIncome.length > 0 
              ? Math.round(dailyIncome.reduce((sum: number, day: any) => sum + day.totalIncome, 0) / dailyIncome.length).toLocaleString()
              : '0'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {dailyIncome?.length || 0} day(s) sampled
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Paid Today</p>
          <p className="text-xl font-bold text-status-normal mt-1">
            Le {paidTodayTotal.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Today's collections only
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending Orders</p>
          <p className="text-xl font-bold text-amber-600 mt-1">
            {Array.isArray(orders) ? orders.filter(o => ['pending', 'partial'].includes(o.paymentStatus || o.payment_status || '')).length : 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Awaiting full payment
          </p>
        </div>
      </div>

      {/* Daily Income Breakdown */}
      {dailyIncome && dailyIncome.length > 0 && (
        <div className="bg-card border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Daily Income Breakdown</h3>
            <span className="text-xs text-muted-foreground">
              Last {dailyIncome.length} day(s)
            </span>
          </div>
          <div className="divide-y">
            {dailyIncome.slice(0, 7).map((day: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-sm">{format(new Date(day.date), 'EEE, MMM dd')}</p>
                  <p className="text-xs text-muted-foreground">{day.orderCount} order{day.orderCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {day.cashPayments > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-normal/10 text-status-normal text-xs">
                        <Banknote className="w-3 h-3" />
                        Le {day.cashPayments.toLocaleString()}
                      </span>
                    )}
                    {day.orangeMoneyPayments > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs">
                        <Smartphone className="w-3 h-3" />
                        Le {day.orangeMoneyPayments.toLocaleString()}
                      </span>
                    )}
                    {day.afrimoneyPayments > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                        <Smartphone className="w-3 h-3" />
                        Le {day.afrimoneyPayments.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm min-w-[100px] text-right">
                    Le {day.totalIncome.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search orders..." 
            className="pl-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Patient</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Last Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders?.map(order => {
                const orderNum = order.orderNumber || order.order_number;
                const firstName = order.patientId?.firstName || order.patients?.first_name;
                const lastName = order.patientId?.lastName || order.patients?.last_name;
                const createdAt = order.createdAt || order.created_at;
                const total = order.total || order.totalAmount || 0;
                const paymentMethod = order.paymentMethod || order.payment_method;
                const paymentStatus = order.paymentStatus || order.payment_status;
                const amountPaid = Number(order.amountPaid || 0);
                const balance = Number(order.balance ?? (Number(total) - amountPaid));
                
                return (
                  <tr key={order.id || order._id}>
                    <td className="font-mono text-sm">{orderNum}</td>
                    <td>
                      <div>
                        <p className="font-medium">{firstName} {lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(createdAt), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </td>
                    <td className="font-bold">Le {Number(total).toLocaleString()}</td>
                    <td className="text-status-normal font-medium">Le {amountPaid.toLocaleString()}</td>
                    <td className={cn(balance > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                      {balance > 0 ? `Le ${balance.toLocaleString()}` : '-'}
                    </td>
                    <td className="capitalize text-muted-foreground">
                      {paymentMethod?.replace(/_/g, ' ') || '-'}
                    </td>
                    <td>
                      <Badge variant="outline" className={cn(
                        paymentStatus === 'paid' ? 'bg-status-normal/10 text-status-normal' :
                        paymentStatus === 'partial' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-status-warning/10 text-status-warning'
                      )}>
                        {paymentStatus}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {paymentStatus !== 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setSplitRows([{ method: 'cash', amount: '' }]);
                              setShowPaymentDialog(true);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Pay
                          </Button>
                        )}
                        {paymentStatus === 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Reprint receipt"
                            onClick={() => navigate(`/reception/receipt/${order.id || order._id}`)}
                          >
                            <Receipt className="w-3 h-3 mr-1" />
                            Reprint
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Payment history"
                          onClick={() => {
                            setHistoryOrderId(order.id || order._id || '');
                            setShowHistoryDialog(true);
                          }}
                        >
                          <History className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!filteredOrders || filteredOrders.length === 0) && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    No payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={open => { setShowPaymentDialog(open); if (!open) { setSplitRows([{ method: 'cash', amount: '' }]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="py-4">
              <div className="bg-muted rounded-lg p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-mono">{selectedOrder.orderNumber || selectedOrder.order_number}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Patient</span>
                  <span>
                    {selectedOrder.patientId?.firstName || selectedOrder.patients?.first_name}{' '}
                    {selectedOrder.patientId?.lastName || selectedOrder.patients?.last_name}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Order Total</span>
                  <span className="font-bold">Le {Number(selectedOrder.total || selectedOrder.totalAmount || 0).toLocaleString()}</span>
                </div>
                {Number(selectedOrder.amountPaid || 0) > 0 && (
                  <div className="flex justify-between mb-2 text-status-normal">
                    <span>Already Paid</span>
                    <span>Le {Number(selectedOrder.amountPaid ?? selectedOrder.paidAmount ?? 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2 text-amber-600">
                  <span>Remaining Balance</span>
                  <span>Le {(Number(selectedOrder.total || selectedOrder.totalAmount || 0) - Number(selectedOrder.amountPaid ?? selectedOrder.paidAmount ?? 0)).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                {splitRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.method}
                      onChange={e => setSplitRows(rows => rows.map((r, i) => i === idx ? { ...r, method: e.target.value } : r))}
                      className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="cash">Cash</option>
                      <option value="orange_money">Orange Money</option>
                      <option value="afrimoney">Afrimoney</option>
                    </select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Amount"
                      value={row.amount}
                      onChange={e => setSplitRows(rows => rows.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                      className="flex-1"
                    />
                    {splitRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSplitRows(rows => rows.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove row"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                {splitRows.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setSplitRows(rows => [...rows, { method: 'cash', amount: '' }])}
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add method
                  </button>
                )}

                {(() => {
                  const splitTotal = splitRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                  const remaining = Number(selectedOrder?.total || selectedOrder?.totalAmount || 0) - Number(selectedOrder?.amountPaid ?? selectedOrder?.paidAmount ?? 0);
                  const diff = remaining - splitTotal;
                  if (splitTotal <= 0) return null;
                  return (
                    <div className={cn('flex justify-between pt-2 border-t text-sm font-semibold', diff < -0.001 ? 'text-destructive' : diff > 0.001 ? 'text-amber-600' : 'text-status-normal')}>
                      <span>Total paying</span>
                      <span>Le {splitTotal.toLocaleString()} / Le {remaining.toLocaleString()}{diff < -0.001 ? ' ✗ exceeds' : diff > 0.001 ? ` (Le ${diff.toLocaleString()} remaining)` : ' ✓'}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button
              onClick={handleProcessPayment}
              disabled={isProcessingPayment || addPayment.isPending || splitRows.every(r => !(parseFloat(r.amount) > 0))}
            >
              {(isProcessingPayment || addPayment.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Check className="w-4 h-4 mr-2" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !paymentHistory || paymentHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payments recorded yet</p>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((p: any, i: number) => (
                  <div key={p._id || i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{p.paymentMethod?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.createdAt), 'MMM dd, yyyy HH:mm')}
                        {p.receivedBy?.fullName && ` · ${p.receivedBy.fullName}`}
                      </p>
                      {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
                    </div>
                    <span className="font-bold text-status-normal">Le {Number(p.amount).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t font-bold">
                  <span>Total Paid</span>
                  <span>Le {paymentHistory.reduce((s: number, p: any) => s + Number(p.amount), 0).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
