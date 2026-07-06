import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePendingClinicalOrders, useMarkOrderPaid } from '@/hooks/useVisits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, CreditCard, FlaskConical, Pill, CheckCircle, HeartPulse } from 'lucide-react';
import { prescriptionService } from '@/services/prescriptionService';

export function PendingOrders() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedMethods, setSelectedMethods] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { data: allOrders = [], isLoading, refetch } = usePendingClinicalOrders();
  const { data: labOrders = [] } = usePendingClinicalOrders('lab');
  const { data: pharmacyOrders = [] } = usePendingClinicalOrders('pharmacy');
  const { data: serviceOrders = [] } = usePendingClinicalOrders('procedure');
  const { data: pendingPrescriptions = [], isLoading: prescriptionsLoading } = useQuery({
    queryKey: ['prescriptions', 'pending-payment'],
    queryFn: () => prescriptionService.findPendingPayment(),
    staleTime: 15 * 1000,
  });
  const markPaid = useMarkOrderPaid();
  const markPrescriptionPaid = useMutation({
    mutationFn: ({ prescriptionId, paymentMethod }: { prescriptionId: string; paymentMethod: string }) =>
      prescriptionService.markAsPaid(prescriptionId, paymentMethod),
    onSuccess: () => {
      toast.success('Prescription payment confirmed');
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to confirm prescription payment');
    },
  });

  const allPaymentItems = [
    ...allOrders.map((order: any) => ({ ...order, _paymentKind: 'order' })),
    ...pendingPrescriptions.map((rx: any) => ({ ...rx, _paymentKind: 'prescription' })),
  ];

  const handleMarkPaid = async (orderId: string, paymentMethod: string = 'cash') => {
    try {
      await markPaid.mutateAsync({ orderId, paymentMethod });
      toast.success('Payment confirmed');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm payment');
    }
  };

  const handleMarkPrescriptionPaid = async (prescriptionId: string, paymentMethod: string = 'cash') => {
    await markPrescriptionPaid.mutateAsync({ prescriptionId, paymentMethod });
  };

  const getOrderTypeBadge = (orderType: string) => {
    switch (orderType) {
      case 'lab':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <FlaskConical className="h-3 w-3 mr-1" />
            Lab
          </Badge>
        );
      case 'pharmacy':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Pill className="h-3 w-3 mr-1" />
            Pharmacy Order
          </Badge>
        );
      case 'procedure':
      case 'admission':
      case 'other':
        return (
          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
            <HeartPulse className="h-3 w-3 mr-1" />
            Service
          </Badge>
        );
      default:
        return <Badge variant="outline">{orderType}</Badge>;
    }
  };

  const renderPrescriptionBadge = () => (
    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
      <Pill className="h-3 w-3 mr-1" />
      Prescription
    </Badge>
  );

  const renderOrderList = (items: any[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No pending clinical payments</p>
          <p className="text-sm">Doctor-created lab orders and prescriptions will appear here</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((item: any) => {
          const isPrescription = item._paymentKind === 'prescription';
          const patient = item.patientId;
          const patientName = patient
            ? `${patient.firstName} ${patient.lastName}`
            : 'Unknown Patient';
          const total = Number(isPrescription ? item.totalAmount : item.total || 0);

          return (
            <div
              key={item._id || item.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex flex-col items-center">
                  {isPrescription ? renderPrescriptionBadge() : getOrderTypeBadge(item.orderType)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{patientName}</div>
                  <div className="text-sm text-muted-foreground">
                    {patient?.patientId} - {isPrescription ? 'Prescription' : 'Order'}: {isPrescription ? item.prescriptionNumber : item.orderNumber}
                    {!item.visitId && (
                      <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200">No visit</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Ordered by: {item.orderedBy?.fullName || item.prescribedBy?.fullName || item.doctorId?.fullName || 'Unknown'}
                  </div>
                  {isPrescription && item.items?.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Drugs:{' '}
                      <span className="font-medium text-foreground">
                        {item.items.map((rxItem: any) => rxItem.medicationName).join(', ')}
                      </span>
                    </div>
                  )}
                  {!isPrescription && item.order_tests && item.order_tests.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {item.orderType === 'lab' ? 'Tests' : 'Items'}:{' '}
                      <span className="font-medium text-foreground">
                        {item.order_tests.map((test: any) => test.testCode).join(', ')}
                      </span>
                      <span className="ml-1 text-xs">
                        ({item.order_tests.map((test: any) => test.testName).join(', ')})
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-medium text-lg">
                    Le {total.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMethods[`${isPrescription ? 'rx' : 'order'}-${item._id || item.id}`] || 'cash'}
                    onChange={(e) => setSelectedMethods(prev => ({ ...prev, [`${isPrescription ? 'rx' : 'order'}-${item._id || item.id}`]: e.target.value }))}
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="cash">Cash</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="afrimoney">Afrimoney</option>
                    {!isPrescription && <option value="wallet">Wallet</option>}
                  </select>
                  <Button
                    onClick={() => {
                      const method = selectedMethods[`${isPrescription ? 'rx' : 'order'}-${item._id || item.id}`] || 'cash';
                      isPrescription ? handleMarkPrescriptionPaid(item._id || item.id, method) : handleMarkPaid(item._id || item.id, method);
                    }}
                    disabled={markPaid.isPending || markPrescriptionPaid.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {(markPaid.isPending || markPrescriptionPaid.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-1" />
                        Pay
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading || prescriptionsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pending Clinical Payments
          <Badge variant="secondary" className="ml-auto">
            {allPaymentItems.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">
              All ({allPaymentItems.length})
            </TabsTrigger>
            <TabsTrigger value="lab">
              Lab ({labOrders.length})
            </TabsTrigger>
            <TabsTrigger value="prescription">
              Prescriptions ({pendingPrescriptions.length})
            </TabsTrigger>
            <TabsTrigger value="services">
              Services ({serviceOrders.length})
            </TabsTrigger>
            <TabsTrigger value="pharmacy">
              Pharmacy Orders ({pharmacyOrders.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {renderOrderList(allPaymentItems)}
          </TabsContent>
          <TabsContent value="lab" className="mt-4">
            {renderOrderList(labOrders.map((order: any) => ({ ...order, _paymentKind: 'order' })))}
          </TabsContent>
          <TabsContent value="prescription" className="mt-4">
            {renderOrderList(pendingPrescriptions.map((rx: any) => ({ ...rx, _paymentKind: 'prescription' })))}
          </TabsContent>
          <TabsContent value="services" className="mt-4">
            {renderOrderList(serviceOrders.map((order: any) => ({ ...order, _paymentKind: 'order' })))}
          </TabsContent>
          <TabsContent value="pharmacy" className="mt-4">
            {renderOrderList(pharmacyOrders.map((order: any) => ({ ...order, _paymentKind: 'order' })))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
