import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useProcessingOrders, useUpdateOrder } from '@/hooks/useOrders';
import { useCreateResult } from '@/hooks/useResults';
import { useActiveTests } from '@/hooks/useTestCatalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatientName, getOrderNumber } from '@/utils/orderHelpers';
import type { OrderWithDetails } from '@/hooks/useOrders';

export default function EnterManualResults() {
  const { profile, user } = useAuth();
  const { data: processingOrders, isLoading } = useProcessingOrders();
  const createResult = useCreateResult();
  const updateOrder = useUpdateOrder();
  const { data: testCatalog } = useActiveTests();

  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [results, setResults] = useState<Record<string, {
    value: string;
    unit: string;
    flag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
    comments: string;
  }>>({});

  const handleResultChange = (testId: string, field: string, value: string) => {
    setResults(prev => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        [field]: value
      }
    }));
  };

  const calculateFlag = (value: number, refRange: string): 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' => {
    if (!refRange) return 'normal';
    
    const match = refRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    if (!match) return 'normal';
    
    const [, min, max] = match;
    const minVal = parseFloat(min);
    const maxVal = parseFloat(max);
    
    if (value < minVal * 0.5) return 'critical_low';
    if (value < minVal) return 'low';
    if (value > maxVal * 1.5) return 'critical_high';
    if (value > maxVal) return 'high';
    return 'normal';
  };

  const handleSaveResults = async () => {
    if (!selectedOrder) return;

    const resultsToSave = selectedOrder.order_tests
      .filter(test => {
        const uniqueTestId = test.id || test._id;
        return results[uniqueTestId]?.value;
      })
      .map(test => {
        const uniqueTestId = test.id || test._id;
        const testCode = test.testCode || test.test_code;
        const testInfo = testCatalog?.find(t => t.code === testCode);
        const value = parseFloat(results[uniqueTestId].value);
        const refRange = testInfo?.referenceRange;
        const flag = !isNaN(value) && refRange
          ? calculateFlag(value, refRange)
          : results[uniqueTestId].flag || 'normal';

        return {
          orderId: selectedOrder.id,
          orderTestId: uniqueTestId,
          testCode: test.test_code || test.testCode,
          testName: test.test_name || test.testName,
          value: results[uniqueTestId].value,
          unit: results[uniqueTestId].unit || testInfo?.unit || '',
          referenceRange: refRange || '',
          flag,
          comments: results[uniqueTestId].comments || undefined,
        };
      });

    if (resultsToSave.length === 0) {
      toast.error('Please enter at least one result');
      return;
    }

    try {
      // Save all results
      for (const result of resultsToSave) {
        await createResult.mutateAsync(result);
      }
      
      // Update order status based on completion
      const allTestsCompleted = resultsToSave.length >= selectedOrder.order_tests.length;
      await updateOrder.mutateAsync({
        id: selectedOrder.id,
        updates: { 
          status: allTestsCompleted ? 'completed' : 'processing' 
        },
      });
      
      toast.success(
        `${resultsToSave.length} result(s) saved successfully${allTestsCompleted ? ' - Order completed!' : ''}`
      );
      setResults({});
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Failed to save results');
    }
  };

  const hasCriticalResults = selectedOrder?.order_tests.some(test => {
    const uniqueTestId = test.id || test._id;
    const flag = results[uniqueTestId]?.flag;
    return flag === 'critical_low' || flag === 'critical_high';
  });

  return (
    <RoleLayout 
      title="Enter Manual Results" 
      subtitle="Manual result entry for tests"
      role="lab_tech"
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Processing Orders</h3>
              <p className="text-sm text-muted-foreground">{processingOrders?.length || 0} orders</p>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {processingOrders?.map(order => (
                  <button
                    key={order.id}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors',
                      selectedOrder?.id === order.id && 'bg-primary/5 border-l-4 border-primary'
                    )}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold">
                        {getPatientName(order)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {order.priority?.toUpperCase() || 'ROUTINE'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{order.orderNumber || order.order_number || 'Unknown Order'}</p>
                    <p className="text-xs text-muted-foreground">
                      {(order.tests || order.order_tests || []).length} test(s)
                    </p>
                  </button>
                ))}
                {(!processingOrders || processingOrders.length === 0) && (
                  <div className="px-4 py-12 text-center text-muted-foreground">
                    <p>No orders in processing</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Result Entry Form */}
        <div className="lg:col-span-2">
          {selectedOrder ? (
            <div className="bg-card border rounded-lg p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {getPatientName(selectedOrder)}
                    </h3>
                    <p className="text-sm text-muted-foreground">{getOrderNumber(selectedOrder)}</p>
                  </div>
                  {hasCriticalResults && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Critical Results
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {selectedOrder.order_tests.map(test => {
                  const uniqueTestId = test.id || test._id || `${test.testId || test.test_id}-${Math.random()}`;
                  const testCode = test.testCode || test.test_code;
                  
                  // Find test info by CODE, not by ID
                  const testInfo = testCatalog?.find(t => t.code === testCode);
                  
                  const resultData = results[uniqueTestId] || { value: '', unit: testInfo?.unit || '', flag: 'normal', comments: '' };
                  const isCritical = resultData.flag === 'critical_low' || resultData.flag === 'critical_high';

                  return (
                    <div 
                      key={uniqueTestId} 
                      className={cn(
                        'p-4 border rounded-lg',
                        isCritical && 'border-status-critical bg-status-critical/5'
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{test.testCode || test.test_code || 'Unknown Test'}</h4>
                          <p className="text-sm text-muted-foreground">{test.testName || test.test_name || 'No description'}</p>
                        </div>
                        {testInfo?.referenceRange && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Reference Range</p>
                            <p className="text-sm font-medium">
                              {testInfo.referenceRange} {testInfo.unit}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`value-${uniqueTestId}`}>Value *</Label>
                          <Input
                            id={`value-${uniqueTestId}`}
                            type="text"
                            placeholder="Enter value"
                            value={resultData.value}
                            onChange={(e) => {
                              handleResultChange(uniqueTestId, 'value', e.target.value);
                              // Auto-calculate flag if numeric
                              const numValue = parseFloat(e.target.value);
                              const refRange = testInfo?.referenceRange;
                              if (!isNaN(numValue) && refRange) {
                                const flag = calculateFlag(numValue, refRange);
                                handleResultChange(uniqueTestId, 'flag', flag);
                              }
                            }}
                            className={cn(isCritical && 'border-status-critical')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`unit-${uniqueTestId}`}>Unit</Label>
                          <Input
                            id={`unit-${uniqueTestId}`}
                            placeholder="Unit"
                            value={resultData.unit}
                            onChange={(e) => handleResultChange(uniqueTestId, 'unit', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`flag-${uniqueTestId}`}>Flag</Label>
                          <Select 
                            value={resultData.flag}
                            onValueChange={(value) => handleResultChange(uniqueTestId, 'flag', value)}
                          >
                            <SelectTrigger id={`flag-${uniqueTestId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical_low">Critical Low</SelectItem>
                              <SelectItem value="critical_high">Critical High</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`comments-${uniqueTestId}`}>Comments</Label>
                        <Textarea
                          id={`comments-${uniqueTestId}`}
                          placeholder="Add any comments or notes..."
                          value={resultData.comments}
                          onChange={(e) => handleResultChange(uniqueTestId, 'comments', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedOrder(null);
                    setResults({});
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveResults}
                  disabled={createResult.isPending}
                >
                  {createResult.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Results
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
              <p>Select an order to enter results</p>
            </div>
          )}
        </div>
      </div>
    </RoleLayout>
  );
}
