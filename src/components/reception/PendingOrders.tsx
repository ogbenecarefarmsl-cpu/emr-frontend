import { useState } from 'react';
import { usePendingClinicalOrders, useMarkOrderPaid } from '@/hooks/useVisits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, CreditCard, FlaskConical, Pill, CheckCircle, Wallet } from 'lucide-react';

export function PendingOrders() {
  const [activeTab, setActiveTab] = useState('all');
  const { data: allOrders = [], isLoading, refetch } = usePendingClinicalOrders();
  const { data: labOrders = [] } = usePendingClinicalOrders('lab');
  const { data: pharmacyOrders = [] } = usePendingClinicalOrders('pharmacy');
  const markPaid = useMarkOrderPaid();

  const handleMarkPaid = async (orderId: string, paymentMethod: string = 'cash') => {
    try {
      await markPaid.mutateAsync({ orderId, paymentMethod });
      toast.success('Payment confirmed');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm payment');
    }
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
            Pharmacy
          </Badge>
        );
      default:
        return <Badge variant="outline">{orderType}</Badge>;
    }
  };

  const renderOrderList = (orders: any[]) => {
    if (orders.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No pending clinical payments</p>
          <p className="text-sm">Doctor-created lab and pharmacy orders will appear here</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {orders.map((order: any) => {
          const patient = order.patientId;
          const patientName = patient
            ? `${patient.firstName} ${patient.lastName}`
            : 'Unknown Patient';

          return (
            <div
              key={order._id || order.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  {getOrderTypeBadge(order.orderType)}
                </div>
                <div>
                  <div className="font-medium">{patientName}</div>
                  <div className="text-sm text-muted-foreground">
                    {patient?.patientId} • Order: {order.orderNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Ordered by: {order.orderedBy?.fullName || order.doctorId?.fullName || 'Unknown'}
                  </div>
                  {order.order_tests && order.order_tests.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Tests:{' '}
                      <span className="font-medium text-foreground">
                        {order.order_tests.map((t: any) => t.testCode).join(', ')}
                      </span>
                      <span className="ml-1 text-xs">
                        ({order.order_tests.map((t: any) => t.testName).join(', ')})
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-medium text-lg">
                    Le {order.total?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <Button
                  onClick={() => handleMarkPaid(order._id || order.id)}
                  disabled={markPaid.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {markPaid.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" />
                      Pay Cash
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleMarkPaid(order._id || order.id, 'wallet')}
                  disabled={markPaid.isPending}
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  Wallet
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
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
            {allOrders.length} orders
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All ({allOrders.length})
            </TabsTrigger>
            <TabsTrigger value="lab">
              Lab ({labOrders.length})
            </TabsTrigger>
            <TabsTrigger value="pharmacy">
              Pharmacy ({pharmacyOrders.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {renderOrderList(allOrders)}
          </TabsContent>
          <TabsContent value="lab" className="mt-4">
            {renderOrderList(labOrders)}
          </TabsContent>
          <TabsContent value="pharmacy" className="mt-4">
            {renderOrderList(pharmacyOrders)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
