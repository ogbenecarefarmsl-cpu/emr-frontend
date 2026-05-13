import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useOrders, useDeleteOrder, useAssignDoctor } from '@/hooks/useOrders';
import { useDoctors } from '@/hooks/useDoctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, CreditCard, Loader2, Eye, Trash2, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { OrderWithDetails } from '@/hooks/useOrders';
import { getPatientName, getGroupedTestsByPanel, getPanelTestCount } from '@/utils/orderHelpers';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { toast } from 'sonner';

export default function OrdersPage() {
  const { profile, primaryRole } = useAuth();
  const currentRole = primaryRole === 'admin' ? 'admin' : 'receptionist';
  const isAdmin = primaryRole === 'admin';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmNum, setDeleteConfirmNum] = useState('');
  const [assignOrder, setAssignOrder] = useState<OrderWithDetails | null>(null);
  const [assignDoctorId, setAssignDoctorId] = useState<string>('none');
  const [assignDoctorText, setAssignDoctorText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  
  const { data: orders, isLoading } = useOrders(statusFilter as any);
  const { data: doctors = [] } = useDoctors();
  const deleteOrder = useDeleteOrder();
  const assignDoctor = useAssignDoctor();

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

  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const orderNum = (order.orderNumber || order.order_number || '').toLowerCase();
    const firstName = (order.patientId?.firstName || order.patients?.first_name || '').toLowerCase();
    const lastName = (order.patientId?.lastName || order.patients?.last_name || '').toLowerCase();
    const patientId = (order.patientId?.patientId || order.patients?.patient_id || '').toLowerCase();
    
    return (
      orderNum.includes(search) ||
      firstName.includes(search) ||
      lastName.includes(search) ||
      patientId.includes(search)
    );
  }) : [];

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const statusStyles: Record<string, string> = {
    pending_payment: 'bg-status-warning/10 text-status-warning border-status-warning/20',
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

  return (
    <RoleLayout 
      title="Orders" 
      subtitle="View and manage test orders"
      role={currentRole}
      userName={profile?.full_name}
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
              <SelectItem value="pending_payment">Pending Payment</SelectItem>
              <SelectItem value="pending_collection">Pending Collection</SelectItem>
              <SelectItem value="collected">Collected</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
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
                <th>Patient</th>
                <th>Tests</th>
                <th>Total</th>
                <th>Priority</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders?.map(order => (
                <tr key={order.id || order._id}>
                  <td className="font-mono text-sm">{order.orderNumber || order.order_number}</td>
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
                    {(() => {
                      const testCount = getPanelTestCount(order);
                      const groupedTests = getGroupedTestsByPanel(order, true); // hide component counts
                      const displayItems = groupedTests.split(', ').slice(0, 2);
                      const totalItems = groupedTests.split(', ').length;
                      
                      return (
                        <div>
                          <p className="font-medium">{testCount} test{testCount !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted-foreground">
                            {displayItems.join(', ')}
                            {totalItems > 2 && ` +${totalItems - 2} more`}
                          </p>
                        </div>
                      );
                    })()}
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
                      {order.status.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground text-sm">
                    {format(new Date(order.createdAt || order.created_at), 'MMM dd, HH:mm')}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAssignOrder(order);
                          const currentDoctorId = typeof order.doctorId === 'string' ? order.doctorId : order.doctorId?._id;
                          setAssignDoctorId(currentDoctorId || 'none');
                          setAssignDoctorText(order.referredByDoctor || '');
                        }}
                      >
                        <Stethoscope className="w-4 h-4" />
                      </Button>
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
                    </div>
                  </td>
                </tr>
              ))}
              {(!paginatedOrders || paginatedOrders.length === 0) && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    No orders found
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
            patientPhone: selectedOrder.patient?.phone || selectedOrder.patients?.phone,
            tests: (() => {
              // Group by panel for display
              const allTests = selectedOrder.order_tests || selectedOrder.tests || [];
              const panelGroups = new Map<string, { code: string; name: string; price: number }>();
              const individualTests: typeof allTests = [];
              
              for (const t of allTests) {
                const panelCode = t.panelCode || t.panel_code;
                const panelName = t.panelName || t.panel_name;
                if (panelCode || panelName) {
                  const key = panelCode || panelName;
                  if (!panelGroups.has(key)) {
                    panelGroups.set(key, {
                      code: panelCode || '',
                      name: panelName || panelCode || '',
                      price: t.price || 0,
                    });
                  }
                } else {
                  individualTests.push(t);
                }
              }
              
              return [
                ...Array.from(panelGroups.values()).map(p => ({ code: p.code, name: p.name, price: p.price })),
                ...individualTests.map(t => ({
                  code: t.testCode || t.test_code || '',
                  name: t.testName || t.test_name || '',
                  price: t.price || 0,
                }))
              ];
            })(),
            subtotal: selectedOrder.subtotal || selectedOrder.total || selectedOrder.totalAmount || 0,
            discount: selectedOrder.discount || 0,
            discountType: (selectedOrder.discountType || 'fixed') as 'percentage' | 'fixed',
            total: selectedOrder.total || selectedOrder.totalAmount || 0,
          }}
          cashierName={profile?.full_name || 'Receptionist'}
        />
      )}
      {/* Delete Order Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Order</DialogTitle>
            <DialogDescription>
              Permanently delete order <strong>{deleteConfirmNum}</strong>? This will also remove all associated tests and payments.
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

      <Dialog open={!!assignOrder} onOpenChange={(open) => !open && setAssignOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Doctor</DialogTitle>
            <DialogDescription>
              Attach a referring doctor to order <strong>{assignOrder?.orderNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={assignDoctorId}
              onValueChange={(value) => {
                setAssignDoctorId(value);
                if (value === 'none') return;
                const selected = doctors.find((d: any) => d._id === value);
                if (selected) setAssignDoctorText(selected.fullName);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No doctor</SelectItem>
                {doctors.map((doctor: any) => (
                  <SelectItem key={doctor._id} value={doctor._id}>{doctor.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignDoctorId === 'none' && (
              <Input
                placeholder="Or type doctor name"
                value={assignDoctorText}
                onChange={(e) => setAssignDoctorText(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOrder(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!assignOrder) return;
                try {
                  await assignDoctor.mutateAsync({
                    orderId: assignOrder.id || (assignOrder as any)._id || '',
                    data: {
                      doctorId: assignDoctorId !== 'none' ? assignDoctorId : undefined,
                      referredByDoctor: assignDoctorId === 'none' ? (assignDoctorText.trim() || undefined) : undefined,
                    },
                  });
                  toast.success('Doctor assigned');
                  setAssignOrder(null);
                } catch {
                  toast.error('Failed to assign doctor');
                }
              }}
              disabled={assignDoctor.isPending}
            >
              {assignDoctor.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
