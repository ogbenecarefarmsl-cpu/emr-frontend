import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePendingClinicalOrders, useMarkOrderPaid } from '@/hooks/useVisits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, CreditCard, FlaskConical, Pill, CheckCircle, ArrowRight, User, Shield, ShieldOff } from 'lucide-react';
import { prescriptionService } from '@/services/prescriptionService';
import { insuranceClaimsAPI, insuranceBlocksAPI } from '@/services/api';

type PatientGroup = {
  patientId: string;
  patient: any;
  prescriptions: any[];
  totalAmount: number;
  drugNames: string[];
};

export function PendingOrders() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedMethods, setSelectedMethods] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: allOrders = [], isLoading, refetch } = usePendingClinicalOrders();
  const { data: labOrders = [] } = usePendingClinicalOrders('lab');
  const { data: pharmacyOrders = [] } = usePendingClinicalOrders('pharmacy');
  const { data: pendingPrescriptions = [], isLoading: prescriptionsLoading } = useQuery({
    queryKey: ['prescriptions', 'pending-payment'],
    queryFn: () => prescriptionService.findPendingPayment(),
    staleTime: 15 * 1000,
  });
  const markPaid = useMarkOrderPaid();
  const markOrderInsuranceMutation = useMutation({
    mutationFn: (orderId: string) => insuranceClaimsAPI.markOrderInsurance(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingClinicalOrders'] });
    },
  });

  // Fetch active blocks to check if patients are blocked from insurance
  const { data: activeBlocks = [] } = useQuery({
    queryKey: ['insurance-blocks-active'],
    queryFn: () => insuranceBlocksAPI.list({ isActive: 'true' }),
    staleTime: 30000,
  });

  // Create a lookup set of blocked patient IDs
  const blockedPatientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of activeBlocks) {
      if (block.patientId?._id) ids.add(block.patientId._id);
    }
    return ids;
  }, [activeBlocks]);

  const blockedInsuranceKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const block of activeBlocks) {
      if (block.memberNumber && block.programCode) {
        keys.add(`${String(block.programCode).toUpperCase()}::${block.memberNumber}`);
      }
    }
    return keys;
  }, [activeBlocks]);

  const patientGroups = useMemo(() => {
    const groups: Record<string, PatientGroup> = {};
    for (const rx of pendingPrescriptions) {
      const patient = (rx as any).patientId;
      const pid = patient?._id || patient?.patientId || (rx as any).patientId?.toString() || 'unknown';
      if (!groups[pid]) {
        groups[pid] = {
          patientId: pid,
          patient,
          prescriptions: [],
          totalAmount: 0,
          drugNames: [],
        };
      }
      groups[pid].prescriptions.push(rx);
      groups[pid].totalAmount += Number((rx as any).totalAmount || 0);
      for (const item of ((rx as any).items || [])) {
        if (item.medicationName && !groups[pid].drugNames.includes(item.medicationName)) {
          groups[pid].drugNames.push(item.medicationName);
        }
      }
    }
    return Object.values(groups).sort((a, b) => b.prescriptions.length - a.prescriptions.length);
  }, [pendingPrescriptions]);

  const handleMarkPaid = async (orderId: string, paymentMethod: string = 'cash') => {
    try {
      await markPaid.mutateAsync({ orderId, paymentMethod });
      toast.success('Payment confirmed');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to confirm payment');
    }
  };

  const handleMarkInsurance = async (orderId: string) => {
    try {
      await markOrderInsuranceMutation.mutateAsync(orderId);
      toast.success('Insurance coverage recorded for this order');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record insurance coverage');
    }
  };

  const navigateToDispense = (group: PatientGroup) => {
    const primaryRx = group.prescriptions[0];
    const rxIds = group.prescriptions.map((rx: any) => rx._id).join(',');
    navigate(`/reception/dispense/${primaryRx._id}?rxIds=${encodeURIComponent(rxIds)}`);
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
      default:
        return <Badge variant="outline">{orderType}</Badge>;
    }
  };

  const renderPatientGroups = (groups: PatientGroup[]) => {
    if (groups.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No pending prescriptions</p>
          <p className="text-sm">Doctor-prescribed medications will appear here</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.patientId}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => navigateToDispense(group)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {group.patient?.firstName} {group.patient?.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {group.patient?.patientId || group.patientId}
                    {group.patient?.phone && <span className="ml-2">{group.patient.phone}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                      <Pill className="h-3 w-3 mr-1" />
                      {group.prescriptions.length} Rx
                    </Badge>
                    {group.prescriptions.map((rx: any) => (
                      <Badge key={rx._id} variant="secondary" className="text-[10px]">
                        {rx.prescriptionNumber}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    <span className="font-medium text-foreground">Drugs:</span>{' '}
                    {group.drugNames.slice(0, 4).join(', ')}
                    {group.drugNames.length > 4 && <span className="text-muted-foreground"> +{group.drugNames.length - 4} more</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Ordered by: {[...new Set(group.prescriptions.map((rx: any) => rx.prescribedBy?.fullName || rx.doctorId?.fullName || 'Unknown'))].join(', ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="font-semibold text-lg text-primary">
                    {group.totalAmount > 0 ? `Le ${group.totalAmount.toLocaleString()}` : 'Price at dispense'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">grouped bill</div>
                </div>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToDispense(group);
                  }}
                >
                  View & Dispense
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOrderList = (items: any[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No pending clinical payments</p>
          <p className="text-sm">Lab and pharmacy orders will appear here</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item: any) => {
          const patient = item.patientId;
          const patientName = patient
            ? `${patient.firstName} ${patient.lastName}`
            : 'Unknown Patient';
          const total = Number(item.total || 0);
          const isInsurancePatient = !!item.visitId?.insurance?.programCode;
          const insuranceKey = item.visitId?.insurance?.memberNumber && item.visitId?.insurance?.programCode
            ? `${String(item.visitId.insurance.programCode).toUpperCase()}::${item.visitId.insurance.memberNumber}`
            : '';
          const isBlocked = blockedPatientIds.has(item.patientId?._id) || (insuranceKey ? blockedInsuranceKeys.has(insuranceKey) : false);

          return (
            <div
              key={item._id || item.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex flex-col items-center">
                  {getOrderTypeBadge(item.orderType)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {patientName}
                    {isInsurancePatient && !isBlocked && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                        <Shield className="h-3 w-3 mr-0.5" />
                        {item.visitId.insurance.programCode}
                      </Badge>
                    )}
                    {isBlocked && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                        <ShieldOff className="h-3 w-3 mr-0.5" />
                        Blocked
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {patient?.patientId} - Order: {item.orderNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Ordered by: {item.orderedBy?.fullName || 'Unknown'}
                  </div>
                  {item.order_tests && item.order_tests.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Tests:{' '}
                      <span className="font-medium text-foreground">
                        {item.order_tests.map((test: any) => test.testName).join(', ')}
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
                  {isInsurancePatient && !isBlocked ? (
                    <>
                      <Button
                        onClick={() => handleMarkInsurance(item._id || item.id)}
                        disabled={markOrderInsuranceMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {markOrderInsuranceMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Shield className="h-4 w-4 mr-1" />
                            Insurance
                          </>
                        )}
                      </Button>
                      <select
                        value={selectedMethods[item._id || item.id] || 'cash'}
                        onChange={(e) => setSelectedMethods((prev) => ({ ...prev, [item._id || item.id]: e.target.value }))}
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="cash">Cash</option>
                        <option value="orange_money">Orange Money</option>
                        <option value="afrimoney">Afrimoney</option>
                        <option value="wallet">Wallet</option>
                      </select>
                      <Button
                        onClick={() => handleMarkPaid(item._id || item.id, selectedMethods[item._id || item.id] || 'cash')}
                        disabled={markPaid.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {markPaid.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <select
                        value={selectedMethods[item._id || item.id] || 'cash'}
                        onChange={(e) => setSelectedMethods((prev) => ({ ...prev, [item._id || item.id]: e.target.value }))}
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="cash">Cash</option>
                        <option value="orange_money">Orange Money</option>
                        <option value="afrimoney">Afrimoney</option>
                        <option value="wallet">Wallet</option>
                      </select>
                      <Button
                        onClick={() => handleMarkPaid(item._id || item.id, selectedMethods[item._id || item.id] || 'cash')}
                        disabled={markPaid.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {markPaid.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay
                          </>
                        )}
                      </Button>
                    </>
                  )}
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
            {patientGroups.length} patient{patientGroups.length !== 1 ? 's' : ''}, {pendingPrescriptions.length + allOrders.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              All ({pendingPrescriptions.length + allOrders.length})
            </TabsTrigger>
            <TabsTrigger value="lab">
              Lab ({labOrders.length})
            </TabsTrigger>
            <TabsTrigger value="prescription">
              Prescriptions ({pendingPrescriptions.length})
            </TabsTrigger>
            <TabsTrigger value="pharmacy">
              Pharmacy Orders ({pharmacyOrders.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {patientGroups.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Prescriptions (grouped by patient)</p>
                {renderPatientGroups(patientGroups)}
              </div>
            )}
            {allOrders.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Clinical Orders</p>
                {renderOrderList(allOrders)}
              </div>
            )}
            {patientGroups.length === 0 && allOrders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending clinical payments</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="lab" className="mt-4">
            {renderOrderList(labOrders)}
          </TabsContent>
          <TabsContent value="prescription" className="mt-4">
            {renderPatientGroups(patientGroups)}
          </TabsContent>
          <TabsContent value="pharmacy" className="mt-4">
            {renderOrderList(pharmacyOrders)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
