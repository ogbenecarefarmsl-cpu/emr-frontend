import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrders, useDeleteOrder } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, CreditCard, Loader2, Eye, Trash2, FlaskConical, Pill, Stethoscope, ClipboardList, BedDouble, ReceiptText, RefreshCw, Cloud } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { OrderWithDetails } from '@/hooks/useOrders';
import { getPatientName, getGroupedTestsByPanel, getPanelTestCount } from '@/utils/orderHelpers';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { toast } from 'sonner';
import { ordersAPI } from '@/services/api';

export default function OrdersPage() {
  const { profile, primaryRole } = useAuth();
  const currentRole = primaryRole === 'admin' ? 'admin' : 'receptionist';
  const isAdmin = primaryRole === 'admin';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [viewOrder, setViewOrder] = useState<OrderWithDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmNum, setDeleteConfirmNum] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  
  const { data: orders, isLoading } = useOrders(statusFilter as any);
  const deleteOrder = useDeleteOrder();
  const queryClient = useQueryClient();
  const syncToLis = useMutation({
    mutationFn: (orderId: string) => ordersAPI.syncToLis(orderId),
    onSuccess: () => {
      toast.success('Order synced to LIS');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => toast.error('Failed to sync order to LIS'),
  });

  const handleDeleteOrder = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteOrder.mutateAsync(deleteConfirmId);
      toast.success('Order deleted');
      setDeleteConfirmId(null);
    } catch {
      toast.error('Failed to delete order');
    }
  };

  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
    if (typeFilter !== 'all' && (order.orderType || 'lab') !== typeFilter) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const orderNum = (order.orderNumber || order.order_number || '').toLowerCase();
    const firstName = (order.patientId?.firstName || order.patients?.first_name || '').toLowerCase();
    const lastName = (order.patientId?.lastName || order.patients?.last_name || '').toLowerCase();
    const patientId = (order.patientId?.patientId || order.patients?.patient_id || '').toLowerCase();
    const orderType = (order.orderType || '').toLowerCase();
    const lisOrderNumber = (order.lisOrderNumber || '').toLowerCase();
    
    return (
      orderNum.includes(search) ||
      firstName.includes(search) ||
      lastName.includes(search) ||
      patientId.includes(search) ||
      orderType.includes(search) ||
      lisOrderNumber.includes(search)
    );
  }) : [];

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const statusStyles: Record<string, string> = {
    awaiting_payment: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    paid: 'bg-status-normal/10 text-status-normal border-status-normal/20',
    pending_collection: 'bg-primary/10 text-primary border-primary/20',
    collected: 'bg-primary/10 text-primary border-primary/20',
    processing: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    completed: 'bg-status-normal/10 text-status-normal border-status-normal/20',
    cancelled: 'bg-muted text-muted-foreground border-muted',
  };

  const priorityStyles: Record<string, string> = {
    routine: 'bg-muted text-muted-foreground',
    urgent: 'bg-status-warning/10 text-status-warning',
    stat: 'bg-status-critical/10 text-status-critical',
  };

  const getOrderTypeBadge = (order: any) => {
    const type = order.orderType || 'lab';
    const config: Record<string, { label: string; className: string; icon: any }> = {
      consultation: { label: 'Consultation', className: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: Stethoscope },
      lab: { label: 'Lab', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: FlaskConical },
      pharmacy: { label: 'Pharmacy', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Pill },
      procedure: { label: 'Procedure', className: 'bg-purple-50 text-purple-700 border-purple-200', icon: ClipboardList },
      admission: { label: 'Admission', className: 'bg-rose-50 text-rose-700 border-rose-200', icon: BedDouble },
      other: { label: 'Other', className: 'bg-muted text-muted-foreground border-border', icon: ReceiptText },
    };
    const item = config[type] || config.other;
    const Icon = item.icon;
    return (
      <Badge variant="outline" className={cn('capitalize gap-1', item.className)}>
        <Icon className="w-3 h-3" />
        {item.label}
      </Badge>
    );
  };

  const getClinicalItems = (order: any) => {
    const type = order.orderType || 'lab';
    const tests = order.order_tests || order.tests || [];

    if (type === 'lab' && tests.length > 0) {
      const testCount = getPanelTestCount(order);
      const groupedTests = getGroupedTestsByPanel(order, true);
      const displayItems = groupedTests.split(', ').filter(Boolean).slice(0, 2);
      const totalItems = groupedTests.split(', ').filter(Boolean).length;
      return {
        title: `${testCount} test${testCount !== 1 ? 's' : ''}`,
        detail: `${displayItems.join(', ')}${totalItems > 2 ? ` +${totalItems - 2} more` : ''}`,
        receiptItems: tests.map((test: any) => ({
          code: test.testCode || test.test_code || '',
          name: test.testName || test.test_name || '',
          price: test.price || 0,
        })),
      };
    }

    const fallbackLabel = {
      consultation: 'Consultation fee',
      pharmacy: 'Medication order',
      procedure: 'Procedure charge',
      admission: 'Admission charge',
      other: 'Clinical service',
    }[type] || 'Clinical service';

    return {
      title: fallbackLabel,
      detail: order.notes || order.referredByDoctor || 'Created from clinical workflow',
      receiptItems: [{
        code: String(type).toUpperCase(),
        name: fallbackLabel,
        price: order.total || order.totalAmount || 0,
      }],
    };
  };

  const getDestinationLabel = (order: any) => {
    const type = order.orderType || 'lab';
    if (order.status === 'awaiting_payment') return 'Awaiting reception payment';
    if (type === 'lab' && order.status === 'pending_collection') return 'Lab queue';
    if (type === 'pharmacy' && order.status === 'paid') return 'Pharmacy queue';
    if (type === 'consultation' && order.status === 'paid') return 'Nurse vitals / doctor flow';
    if (order.status === 'completed') return 'Completed';
    return order.status?.replace(/_/g, ' ') || 'Pending';
  };

  const getLisBadge = (order: any) => {
    if ((order.orderType || 'lab') !== 'lab') return null;
    const status = order.lisSyncStatus || 'not_synced';
    const className =
      status === 'synced'
        ? 'bg-status-normal/10 text-status-normal border-status-normal/20'
        : status === 'failed'
          ? 'bg-status-critical/10 text-status-critical border-status-critical/20'
          : 'bg-muted text-muted-foreground border-muted';

    return (
      <Badge variant="outline" className={cn('gap-1', className)} title={order.lisSyncError || undefined}>
        <Cloud className="w-3 h-3" />
        LIS {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <RoleLayout 
      title="Clinical Orders" 
      subtitle="Confirm payments for doctor-created services and route patients to the right department"
      role={currentRole}
      userName={profile?.fullName}
    >
      {/* Filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search orders..." 
              className="pl-10 w-80"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending_collection">Lab Queue</SelectItem>
              <SelectItem value="collected">Collected</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="consultation">Consultation</SelectItem>
              <SelectItem value="lab">Lab</SelectItem>
              <SelectItem value="pharmacy">Pharmacy</SelectItem>
              <SelectItem value="procedure">Procedure</SelectItem>
              <SelectItem value="admission">Admission</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Rows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="15">15 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders Table */}
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
                <th>Type</th>
                <th>Patient</th>
                <th>Service / Items</th>
                <th>Amount</th>
                <th>Priority</th>
                <th>Payment</th>
                <th>Department Status</th>
                <th>LIS</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders?.map(order => {
                const clinicalItems = getClinicalItems(order);
                return (
                <tr key={order.id || order._id}>
                  <td>
                    <div>
                      <p className="font-mono text-sm">{order.orderNumber || order.order_number}</p>
                      {order.visitId && <p className="text-xs text-muted-foreground">Visit attached</p>}
                    </div>
                  </td>
                  <td>{getOrderTypeBadge(order)}</td>
                  <td>
                    <div>
                      <p className="font-medium">
                        {getPatientName(order)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.patientId?.patientId || order.patients?.patient_id}
                      </p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium">{clinicalItems.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{clinicalItems.detail}</p>
                    </div>
                  </td>
                  <td className="font-medium">Le {Number(order.total || order.totalAmount).toLocaleString()}</td>
                  <td>
                    <Badge variant="outline" className={cn('capitalize', priorityStyles[order.priority])}>
                      {order.priority}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant="outline" className={cn(
                      (order.paymentStatus || order.payment_status) === 'paid' ? 'bg-status-normal/10 text-status-normal' :
                      (order.paymentStatus || order.payment_status) === 'pending' ? 'bg-status-warning/10 text-status-warning' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {order.paymentStatus || order.payment_status}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant="outline" className={cn('capitalize', statusStyles[order.status])}>
                      {getDestinationLabel(order)}
                    </Badge>
                  </td>
                  <td>
                    <div className="space-y-1">
                      {getLisBadge(order)}
                      {order.lisOrderNumber && (
                        <p className="text-xs text-muted-foreground font-mono">{order.lisOrderNumber}</p>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground text-sm">
                    {format(new Date(order.createdAt || order.created_at), 'MMM dd, HH:mm')}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewOrder(order)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {(order.paymentStatus || order.payment_status) !== 'paid' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowPaymentDialog(true);
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-1" />
                          Pay
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-status-critical hover:text-status-critical hover:bg-status-critical/10"
                          onClick={() => {
                            setDeleteConfirmId(order.id || (order as any)._id);
                            setDeleteConfirmNum(order.orderNumber || '');
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      {(order.orderType || 'lab') === 'lab' && order.lisSyncStatus !== 'synced' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => syncToLis.mutate(order.id || (order as any)._id)}
                          disabled={syncToLis.isPending}
                          title={order.lisSyncError || 'Sync to LIS'}
                        >
                          <RefreshCw className={cn('w-4 h-4', syncToLis.isPending && 'animate-spin')} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              {(!paginatedOrders || paginatedOrders.length === 0) && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-muted-foreground">
                    No clinical orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {filteredOrders.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      {selectedOrder && (
        <PaymentDialog
          open={showPaymentDialog}
          onOpenChange={(open) => {
            setShowPaymentDialog(open);
            if (!open) setSelectedOrder(null);
          }}
          order={{
            id: selectedOrder.id || (selectedOrder as any)._id || '',
            orderNumber: selectedOrder.orderNumber || selectedOrder.order_number || '',
            patientName: getPatientName(selectedOrder),
            patientId: selectedOrder.patient?.patientId || selectedOrder.patients?.patient_id || '',
            patientObjectId:
              typeof selectedOrder.patientId === 'object'
                ? selectedOrder.patientId?._id || selectedOrder.patientId?.id
                : selectedOrder.patientId || selectedOrder.patient?.id || selectedOrder.patient?._id || selectedOrder.patients?.id || selectedOrder.patients?._id,
            patientPhone: selectedOrder.patient?.phone || selectedOrder.patients?.phone,
            tests: (() => {
              return getClinicalItems(selectedOrder).receiptItems;
            })(),
            subtotal: selectedOrder.subtotal || selectedOrder.total || selectedOrder.totalAmount || 0,
            discount: selectedOrder.discount || 0,
            discountType: (selectedOrder.discountType || 'fixed') as 'percentage' | 'fixed',
            total: selectedOrder.total || selectedOrder.totalAmount || 0,
          }}
          cashierName={profile?.fullName || 'Receptionist'}
        />
      )}
      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Clinical Order Details</DialogTitle>
            <DialogDescription>
              {viewOrder?.orderNumber || viewOrder?.order_number} - {viewOrder ? getPatientName(viewOrder) : ''}
            </DialogDescription>
          </DialogHeader>
          {viewOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <div className="mt-1">{getOrderTypeBadge(viewOrder)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment</p>
                  <p className="font-medium capitalize">{viewOrder.paymentStatus || viewOrder.payment_status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Destination</p>
                  <p className="font-medium capitalize">{getDestinationLabel(viewOrder)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">Le {Number(viewOrder.total || viewOrder.totalAmount || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Items</p>
                <div className="space-y-2">
                  {getClinicalItems(viewOrder).receiptItems.map((item, index) => (
                    <div key={`${item.code}-${index}`} className="flex items-center justify-between text-sm">
                      <span>{item.code ? `${item.code} - ` : ''}{item.name}</span>
                      <span className="font-medium">Le {Number(item.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              {viewOrder.orderedBy?.fullName && (
                <p className="text-sm text-muted-foreground">Ordered by {viewOrder.orderedBy.fullName}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Order Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Order</DialogTitle>
            <DialogDescription>
              Permanently delete clinical order <strong>{deleteConfirmNum}</strong>? This will also remove associated items and payments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrder}
              disabled={deleteOrder.isPending}
            >
              {deleteOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </RoleLayout>
  );
}

