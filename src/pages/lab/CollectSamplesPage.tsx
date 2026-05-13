import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePendingCollectionOrders, useCollectOrder } from '@/hooks/useOrders';
import { useCreateSample } from '@/hooks/useSamples';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { TestTube, Check, Printer, QrCode, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatient, getOrderId, getPatientName, getPatientId, getOrderNumber, getOrderTests, getCreatedAt } from '@/utils/orderHelpers';
import type { OrderWithDetails } from '@/hooks/useOrders';

export default function CollectSamplesPage() {
  const { profile, user } = useAuth();
  const { data: pendingOrders, isLoading } = usePendingCollectionOrders();
  const collectOrder = useCollectOrder();
  const createSample = useCreateSample();

  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [collectedSampleId, setCollectedSampleId] = useState<string | null>(null);

  const handleCollectSample = async () => {
    if (!selectedOrder) return;

    try {
      // Get the correct IDs
      const orderId = getOrderId(selectedOrder);
      const patient = getPatient(selectedOrder);
      const patientId = patient?._id || patient?.id;

      if (!orderId || !patientId) {
        toast.error('Missing order or patient information');
        return;
      }

      // Create sample record with correct field names
      const sample = await createSample.mutateAsync({
        orderId: orderId,
        patientId: patientId,
        sampleType: 'blood', // Could be derived from tests
      });

      // Collect order using the correct endpoint
      await collectOrder.mutateAsync(orderId);

      setCollectedSampleId(sample.sampleId || sample.sample_id);
      setShowConfirmModal(true);
      toast.success(`Sample ${sample.sampleId || sample.sample_id} collected`);
    } catch (error) {
      toast.error('Failed to collect sample');
    }
  };

  const handleDone = () => {
    setShowConfirmModal(false);
    setCollectedSampleId(null);
    setSelectedOrder(null);
  };

  const priorityOrder = { stat: 0, urgent: 1, routine: 2 };
  const sortedOrders = pendingOrders?.sort((a, b) => 
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return (
    <RoleLayout 
      title="Collect Samples" 
      subtitle="Sample collection and labeling"
      role="lab_tech"
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Orders List */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Pending Sample Collection</h3>
              <p className="text-sm text-muted-foreground">{pendingOrders?.length || 0} orders waiting</p>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {sortedOrders?.map(order => (
                  <button
                    key={order.id}
                    className={cn(
                      'w-full px-4 py-4 text-left hover:bg-muted/50 transition-colors',
                      selectedOrder?.id === order.id && 'bg-primary/5 border-l-4 border-primary'
                    )}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">
                            {getPatientName(order)}
                          </p>
                          <Badge variant="outline" className={cn(
                            'text-xs',
                            order.priority === 'stat' ? 'bg-status-critical/10 text-status-critical border-status-critical/20' :
                            order.priority === 'urgent' ? 'bg-status-warning/10 text-status-warning border-status-warning/20' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {order.priority?.toUpperCase() || 'ROUTINE'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {getPatientId(order)}
                        </p>
                        {(() => {
                          const tests = getOrderTests(order);
                          const panelMap = new Map<string, { name: string; count: number }>();
                          const standalone: string[] = [];
                          for (const t of tests) {
                            const pc = t.panelCode || (t as any).panel_code;
                            const pn = t.panelName || (t as any).panel_name;
                            if (pc) {
                              if (!panelMap.has(pc)) panelMap.set(pc, { name: pn || pc, count: 0 });
                              panelMap.get(pc)!.count++;
                            } else {
                              standalone.push(t.testCode || (t as any).test_code || '');
                            }
                          }
                          return (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Array.from(panelMap.entries()).map(([pc, g]) => (
                                <span key={pc} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">
                                  {g.name} <span className="opacity-60">×{g.count}</span>
                                </span>
                              ))}
                              {standalone.length > 0 && (
                                <span className="text-xs text-muted-foreground">{standalone.join(', ')}</span>
                              )}
                            </div>
                          );
                        })()}
                        <p className="text-xs text-muted-foreground mt-1">
                          Ordered: {new Date(getCreatedAt(order)).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">{getOrderNumber(order)}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {(!sortedOrders || sortedOrders.length === 0) && (
                  <div className="px-4 py-12 text-center text-muted-foreground">
                    <TestTube className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No pending samples</p>
                    <p className="text-sm">All samples have been collected</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Collection Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg p-4 sticky top-6">
            <h3 className="font-semibold mb-4">Collection Details</h3>
            
            {selectedOrder ? (
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-semibold text-lg">
                    {getPatientName(selectedOrder)}
                  </p>
                  <p className="text-sm">
                    {getPatientId(selectedOrder)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tests to Collect</p>
                  {(() => {
                    const tests = selectedOrder.tests || selectedOrder.order_tests || [];
                    const panelMap = new Map<string, { name: string; tests: any[] }>();
                    const standalone: any[] = [];
                    for (const t of tests as any[]) {
                      const pc = t.panelCode || t.panel_code;
                      const pn = t.panelName || t.panel_name;
                      if (pc) {
                        if (!panelMap.has(pc)) panelMap.set(pc, { name: pn || pc, tests: [] });
                        panelMap.get(pc)!.tests.push(t);
                      } else {
                        standalone.push(t);
                      }
                    }
                    return (
                      <div className="space-y-2">
                        {Array.from(panelMap.entries()).map(([pc, g]) => (
                          <div key={pc} className="border rounded-md overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b">
                              <TestTube className="w-3.5 h-3.5 text-primary" />
                              <p className="text-sm font-semibold text-primary">{g.name}</p>
                              <span className="ml-auto text-xs text-muted-foreground">{g.tests.length} tests</span>
                            </div>
                            <div className="px-3 py-2 flex flex-wrap gap-x-3 gap-y-0.5">
                              {g.tests.map(t => (
                                <span key={t.id || t._id} className="text-xs text-muted-foreground">{t.testCode || (t as any).test_code}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {standalone.map(t => (
                          <div key={t.id || t._id} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                            <TestTube className="w-4 h-4 text-primary" />
                            <div>
                              <p className="font-medium text-sm">{t.testCode || (t as any).test_code || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{t.testName || (t as any).test_name || 'Unknown Test'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-4 border-t space-y-3">
                  <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={handleCollectSample}
                    disabled={createSample.isPending || collectOrder.isPending}
                  >
                    {(createSample.isPending || collectOrder.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    <Check className="w-4 h-4 mr-2" />
                    Mark as Collected
                  </Button>
                  <Button variant="outline" className="w-full">
                    <QrCode className="w-4 h-4 mr-2" />
                    Print Label
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Select an order to collect</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sample Collected</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-status-normal/10 rounded-lg p-4 text-center mb-4">
              <Check className="w-12 h-12 text-status-normal mx-auto mb-2" />
              <p className="font-bold text-lg">{collectedSampleId}</p>
              <p className="text-sm text-muted-foreground">Sample ID</p>
            </div>

            {selectedOrder && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Patient</span>
                  <span className="font-medium">
                    {getPatientName(selectedOrder)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-mono">{getOrderNumber(selectedOrder)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Collected By</span>
                  <span>{profile?.full_name}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Print Label
            </Button>
            <Button onClick={handleDone} className="flex-1">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
