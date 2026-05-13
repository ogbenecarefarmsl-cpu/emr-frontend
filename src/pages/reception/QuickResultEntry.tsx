import { useState, useRef, useEffect, useCallback } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useOrders, useUpdateOrder } from '@/hooks/useOrders';
import { useCreateResult } from '@/hooks/useResults';
import { useAllTests } from '@/hooks/useTestCatalog';
import { ordersAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  Check,
  AlertTriangle,
  Loader2,
  ScanBarcode,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderWithDetails } from '@/hooks/useOrders';
import { getPatientName, getOrderNumber } from '@/utils/orderHelpers';

type ResultFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';

const MONGO_OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

interface QuickEntry {
  testCode: string;
  testName: string;
  orderTestId: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: ResultFlag;
}

export default function QuickResultEntry() {
  const { profile, primaryRole } = useAuth();
  const { data: allOrders, isLoading: ordersLoading } = useOrders('all');
  const { data: testCatalog } = useAllTests(); // Use ALL tests, not just active ones
  const createResult = useCreateResult();
  const updateOrder = useUpdateOrder();

  const searchRef = useRef<HTMLInputElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [matchedOrder, setMatchedOrder] = useState<OrderWithDetails | null>(null);
  const [entries, setEntries] = useState<Record<string, QuickEntry>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCriticalWarning, setShowCriticalWarning] = useState(false);
  const [skippedNonNumericCount, setSkippedNonNumericCount] = useState(0);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Array<{ orderNumber: string; patientName: string; testCount: number; time: string }>>([]);

  const isReceptionistEntry = primaryRole === 'receptionist';

  // Auto-focus the search bar on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Find reference info from catalog
  const getTestInfo = useCallback((testCode: string, patientAge?: number, patientGender?: string) => {
    const test = testCatalog?.find((t: any) => t.code === testCode);
    if (!test) return { unit: '', referenceRange: '', refLow: NaN, refHigh: NaN };

    let referenceRange = test.referenceRange || '';

    if (test.referenceRanges?.length > 0 && patientAge !== undefined) {
      const matchedRange = test.referenceRanges.find((r: any) => {
        let ageMatch = true;
        // Handle age ranges like "18-25 years"
        if (r.ageGroup && r.ageGroup.includes('years')) {
          const ageRangeMatch = r.ageGroup.match(/(\d+)-(\d+)\s*years/);
          if (ageRangeMatch) {
            const minAge = parseInt(ageRangeMatch[1]);
            const maxAge = parseInt(ageRangeMatch[2]);
            ageMatch = patientAge >= minAge && patientAge <= maxAge;
          }
        } else {
          // Handle numeric ageMin/ageMax
          ageMatch = (r.ageMin === undefined || patientAge >= r.ageMin) && (r.ageMax === undefined || patientAge <= r.ageMax);
        }
        
        const genderMatch = !r.gender || r.gender === 'all' || r.gender === patientGender;
        return ageMatch && genderMatch;
      });
      if (matchedRange) {
        referenceRange = `${matchedRange.range} ${matchedRange.unit || test.unit || ''}`.trim();
      }
    }

    const rangeMatch = referenceRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    return {
      unit: test.unit || '',
      referenceRange,
      refLow: rangeMatch ? parseFloat(rangeMatch[1]) : NaN,
      refHigh: rangeMatch ? parseFloat(rangeMatch[2]) : NaN,
    };
  }, [testCatalog]);

  const calculateFlag = useCallback((value: string, refLow: number, refHigh: number, referenceRange?: string): ResultFlag => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'normal';
    
    // Handle threshold values like "<0.5" or ">3.0"
    if (referenceRange) {
      const thresholdMatch = referenceRange.match(/^(<|>|<=|>=|≤|≥)\s*(\d+\.?\d*)/);
      if (thresholdMatch) {
        const operator = thresholdMatch[1];
        const threshold = parseFloat(thresholdMatch[2]);
        if (operator === '<' || operator === '<=') {
          if (num > threshold) return 'high';
          if (num > threshold * 2) return 'critical_high';
        } else if (operator === '>' || operator === '>=') {
          if (num < threshold) return 'low';
          if (num < threshold * 0.5) return 'critical_low';
        }
        return 'normal';
      }
    }
    
    // Handle normal ranges
    if (isNaN(refLow) || isNaN(refHigh)) return 'normal';
    if (num < refLow * 0.5) return 'critical_low';
    if (num > refHigh * 1.5) return 'critical_high';
    if (num < refLow) return 'low';
    if (num > refHigh) return 'high';
    return 'normal';
  }, []);

  const isNumericReferenceRange = useCallback((referenceRange?: string) => {
    if (!referenceRange) return false;
    const trimmed = referenceRange.trim();
    if (!trimmed) return false;

    const rangeMatch = trimmed.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    const thresholdMatch = trimmed.match(/^(<|>|<=|>=|≤|≥)\s*(\d+\.?\d*)/);

    return Boolean(rangeMatch || thresholdMatch);
  }, []);

  const loadOrder = useCallback((order: OrderWithDetails) => {
    setMatchedOrder(order);
    setEntries({});
    setSearchTerm('');

    // Pre-populate entries with empty values
    const allTests: any[] = order.tests || order.order_tests || [];
    const patientAge = (order.patient || (typeof order.patientId === 'object' ? order.patientId : null) as any)?.age;
    const patientGender = (order.patient || (typeof order.patientId === 'object' ? order.patientId : null) as any)?.gender;

    const initialEntries: Record<string, QuickEntry> = {};
    let skippedCount = 0;
    for (const test of allTests) {
      const testCode = test.testCode || test.test_code || '';
      const testKey = test.id || test._id || testCode;
      const info = getTestInfo(testCode, patientAge, patientGender);

      if (isReceptionistEntry && !isNumericReferenceRange(info.referenceRange)) {
        skippedCount += 1;
        continue;
      }

      initialEntries[testKey] = {
        testCode,
        testName: test.testName || test.test_name || testCode,
        orderTestId: testKey,
        value: '',
        unit: info.unit,
        referenceRange: info.referenceRange,
        flag: 'normal',
      };
    }
    setEntries(initialEntries);
    setSkippedNonNumericCount(skippedCount);

    if (isReceptionistEntry && Object.keys(initialEntries).length === 0) {
      toast.error('This order has no predefined numeric tests for receptionist quick entry');
    }

    // Focus the first input after a tick
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [getTestInfo, isNumericReferenceRange, isReceptionistEntry]);

  // Fetch fresh order by ID and load it (ensures newly added tests are visible)
  const loadOrderById = useCallback(async (orderId: string) => {
    try {
      const fresh = await ordersAPI.getById(orderId);
      const normalized = {
        ...fresh,
        id: fresh.id || fresh._id,
        orderNumber: fresh.orderNumber || fresh.order_number,
        tests: (fresh.order_tests || fresh.tests || []),
        order_tests: (fresh.order_tests || fresh.tests || []),
        patient: fresh.patient || (typeof fresh.patientId === 'object' ? fresh.patientId : null),
      };
      loadOrder(normalized);
    } catch {
      toast.error('Failed to load order details');
    }
  }, [loadOrder]);

  // Search / barcode scan handler
  const handleSearch = useCallback(() => {
    if (!searchTerm.trim() || !allOrders) return;

    const term = searchTerm.trim().toUpperCase();

    // Try exact order number match first
    const exact = allOrders.find(o => {
      const num = (o.orderNumber || o.order_number || '').toUpperCase();
      return num === term;
    });

    if (exact) {
      loadOrderById(exact.id || exact._id || '');
      return;
    }

    // Try partial match on order number or patient ID
    const partial = allOrders.find(o => {
      const num = (o.orderNumber || o.order_number || '').toUpperCase();
      const pid = (o.patientId && typeof o.patientId === 'object'
        ? (o.patientId as any).patientId
        : '').toUpperCase();
      return num.includes(term) || pid.includes(term);
    });

    if (partial) {
      loadOrderById(partial.id || partial._id || '');
      return;
    }

    // Try patient name
    const byName = allOrders.find(o => {
      const name = getPatientName(o).toUpperCase();
      return name.includes(term);
    });

    if (byName) {
      loadOrderById(byName.id || byName._id || '');
      return;
    }

    toast.error('No order found for that search');
  }, [searchTerm, allOrders, loadOrderById]);

  const handleValueChange = (testKey: string, value: string) => {
    const entry = entries[testKey];
    if (!entry) return;

    if (isReceptionistEntry && !/^\d*\.?\d*$/.test(value)) {
      return;
    }

    const patientAge = (matchedOrder?.patient || (typeof matchedOrder?.patientId === 'object' ? matchedOrder?.patientId : null) as any)?.age;
    const patientGender = (matchedOrder?.patient || (typeof matchedOrder?.patientId === 'object' ? matchedOrder?.patientId : null) as any)?.gender;

    const info = getTestInfo(entry.testCode, patientAge, patientGender);
    const flag = calculateFlag(value, info.refLow, info.refHigh, info.referenceRange);

    setEntries(prev => ({
      ...prev,
      [testKey]: { ...prev[testKey], value, flag },
    }));
  };

  // Tab / Enter key navigation between inputs
  const handleKeyDown = (e: React.KeyboardEvent, testKey: string, testKeys: string[]) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const idx = testKeys.indexOf(testKey);
      if (idx < testKeys.length - 1) {
        // Move to next input
        const nextId = `quick-val-${testKeys[idx + 1]}`;
        (document.getElementById(nextId) as HTMLInputElement)?.focus();
      } else {
        // Last test — trigger submit
        handleSubmitResults();
      }
    }
  };

  const handleSubmitResults = () => {
    const filled = Object.values(entries).filter(e => e.value.trim());
    if (filled.length === 0) {
      toast.error('Enter at least one result value');
      return;
    }

    const hasCritical = filled.some(e => e.flag === 'critical_low' || e.flag === 'critical_high');
    if (hasCritical) {
      setShowCriticalWarning(true);
      return;
    }

    doSubmit();
  };

  const handleCompleteOrder = async () => {
    if (!matchedOrder) return;
    try {
      const orderId = (matchedOrder as any)._id || matchedOrder.id;
      await updateOrder.mutateAsync({
        id: orderId,
        updates: { status: 'completed' },
      });
      toast.success('Order marked as completed');
      
      // Track for recent list
      setRecentlyCompleted(prev => [
        {
          orderNumber: getOrderNumber(matchedOrder),
          patientName: getPatientName(matchedOrder),
          testCount: 0,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
      
      setMatchedOrder(null);
      setEntries({});
      setSkippedNonNumericCount(0);
      searchRef.current?.focus();
    } catch (error) {
      toast.error('Failed to complete order');
    }
  };

  const doSubmit = async () => {
    if (!matchedOrder) return;
    setIsSubmitting(true);
    setShowCriticalWarning(false);

    try {
      const filled = Object.values(entries).filter(e => e.value.trim());
      const orderId = (matchedOrder as any)._id || matchedOrder.id;

      // Validate orderId is a valid MongoDB ObjectId
      if (!orderId || !MONGO_OBJECT_ID_REGEX.test(orderId)) {
        toast.error('Invalid order ID format');
        setIsSubmitting(false);
        return;
      }

      for (const entry of filled) {
        const payload: any = {
          orderId,
          testCode: entry.testCode,
          testName: entry.testName,
          value: entry.value,
          unit: entry.unit || undefined,
          referenceRange: entry.referenceRange || undefined,
          flag: entry.flag,
        };

        if (entry.orderTestId && MONGO_OBJECT_ID_REGEX.test(entry.orderTestId)) {
          payload.orderTestId = entry.orderTestId;
        }

        await createResult.mutateAsync({
          ...payload,
        });
      }

      // Receptionist quick entry always requires second review by lab
      if (isReceptionistEntry) {
        await updateOrder.mutateAsync({
          id: orderId,
          updates: { status: 'processing' },
        });
      } else {
        // Auto-complete order if all tests filled
        const allTests: any[] = matchedOrder.tests || matchedOrder.order_tests || [];
        if (filled.length >= allTests.length) {
          await updateOrder.mutateAsync({
            id: orderId,
            updates: { status: 'completed' },
          });
        } else {
          await updateOrder.mutateAsync({
            id: orderId,
            updates: { status: 'processing' },
          });
        }
      }

      // Track for recent list
      setRecentlyCompleted(prev => [
        {
          orderNumber: getOrderNumber(matchedOrder),
          patientName: getPatientName(matchedOrder),
          testCount: filled.length,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);

      toast.success(
        isReceptionistEntry
          ? `${filled.length} result(s) saved and ready to print!`
          : `${filled.length} result(s) saved for ${getPatientName(matchedOrder)}`,
      );

      // Reset and focus search bar for next order
      setMatchedOrder(null);
      setEntries({});
      searchRef.current?.focus();
    } catch (error) {
      toast.error('Failed to save results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setMatchedOrder(null);
    setEntries({});
    setSkippedNonNumericCount(0);
    setSearchTerm('');
    searchRef.current?.focus();
  };

  const flagStyles: Record<ResultFlag, string> = {
    normal: 'text-status-normal',
    low: 'text-status-warning',
    high: 'text-status-warning',
    critical_low: 'text-status-critical font-bold',
    critical_high: 'text-status-critical font-bold',
  };

  const flagBg: Record<ResultFlag, string> = {
    normal: '',
    low: 'bg-status-warning/5',
    high: 'bg-status-warning/5',
    critical_low: 'bg-status-critical/10',
    critical_high: 'bg-status-critical/10',
  };

  const flagLabel: Record<ResultFlag, string> = {
    normal: '',
    low: 'L',
    high: 'H',
    critical_low: 'LL',
    critical_high: 'HH',
  };

  const testKeys = Object.keys(entries);
  const filledCount = Object.values(entries).filter(e => e.value.trim()).length;
  const totalTests = testKeys.length;

  return (
    <RoleLayout
      title="Quick Result Entry"
      subtitle={isReceptionistEntry ? 'Fast numeric entry — save and print immediately' : 'Scan or type an order number to enter results fast'}
      role="receptionist"
      userName={profile?.full_name}
    >
      {isReceptionistEntry && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Quick entry mode: numeric tests only. Save and print results immediately for fast patient service.
        </div>
      )}

      {/* Search / Barcode Bar */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <ScanBarcode className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <form
            className="flex-1 flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              handleSearch();
            }}
          >
            <Input
              ref={searchRef}
              placeholder="Scan barcode or type order number / patient ID / name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="text-lg h-12 font-mono"
              autoFocus
            />
            <Button type="submit" size="lg" disabled={ordersLoading || !searchTerm.trim()}>
              {ordersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">Find</span>
            </Button>
          </form>
          {matchedOrder && (
            <Button variant="ghost" size="icon" onClick={handleReset} title="Clear & start over">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main entry panel */}
        <div className="xl:col-span-3">
          {matchedOrder ? (
            <div className="bg-card border rounded-lg">
              {/* Order header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{getPatientName(matchedOrder)}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{getOrderNumber(matchedOrder)}</p>
                  </div>
                  <Badge variant="outline" className={cn(
                    matchedOrder.priority === 'stat' ? 'bg-status-critical/10 text-status-critical' :
                      matchedOrder.priority === 'urgent' ? 'bg-status-warning/10 text-status-warning' :
                        'bg-muted'
                  )}>
                    {matchedOrder.priority?.toUpperCase() || 'ROUTINE'}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {matchedOrder.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filledCount}/{totalTests} entered
                </div>
              </div>

              {isReceptionistEntry && skippedNonNumericCount > 0 && (
                <div className="px-4 py-2 border-b text-xs text-muted-foreground bg-muted/20">
                  {skippedNonNumericCount} non-numeric test(s) hidden in receptionist mode and must be entered by lab staff.
                </div>
              )}

              {/* Compact result table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase w-32">Code</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Test</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase w-48">Result</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase w-20">Unit</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase w-32">Reference</th>
                      <th className="text-center px-4 py-2 text-xs font-semibold text-muted-foreground uppercase w-16">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testKeys.map((key, idx) => {
                      const entry = entries[key];
                      return (
                        <tr key={key} className={cn('border-b last:border-b-0 transition-colors', flagBg[entry.flag])}>
                          <td className="px-4 py-2 font-mono text-sm font-medium">{entry.testCode}</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{entry.testName}</td>
                          <td className="px-4 py-1">
                            <Input
                              id={`quick-val-${key}`}
                              ref={idx === 0 ? firstInputRef : undefined}
                              placeholder={isReceptionistEntry ? 'Numeric value' : 'Enter value'}
                              value={entry.value}
                              onChange={e => handleValueChange(key, e.target.value)}
                              onKeyDown={e => handleKeyDown(e, key, testKeys)}
                              inputMode={isReceptionistEntry ? 'decimal' : undefined}
                              className={cn(
                                'h-9 text-sm font-mono',
                                (entry.flag === 'critical_high' || entry.flag === 'critical_low') && 'border-status-critical ring-status-critical/30'
                              )}
                              autoComplete="off"
                            />
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{entry.unit}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{entry.referenceRange}</td>
                          <td className="px-4 py-2 text-center">
                            {entry.value && entry.flag !== 'normal' && (
                              <span className={cn('text-xs font-bold', flagStyles[entry.flag])}>
                                {flagLabel[entry.flag]}
                              </span>
                            )}
                            {entry.value && entry.flag === 'normal' && (
                              <Check className="w-4 h-4 text-status-normal mx-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Submit bar */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs font-mono">Enter</kbd> to move between fields, or <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs font-mono">Enter</kbd> on the last field to submit
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReset}>Clear</Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCompleteOrder} 
                    disabled={updateOrder.isPending}
                    className="text-status-normal hover:text-status-normal hover:bg-status-normal/10"
                    title="Mark order as completed without saving more results"
                  >
                    {updateOrder.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Complete Order
                  </Button>
                  <Button onClick={handleSubmitResults} disabled={isSubmitting || filledCount === 0}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Save {filledCount} Result{filledCount !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-lg flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ScanBarcode className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">Scan or search for an order</p>
              <p className="text-sm">Type an order number, patient ID, or patient name above</p>
            </div>
          )}
        </div>

        {/* Recent activity sidebar */}
        <div className="xl:col-span-1">
          <div className="bg-card border rounded-lg">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">Recent Entries</h3>
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {recentlyCompleted.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No entries yet this session
                </div>
              ) : (
                recentlyCompleted.map((item, idx) => (
                  <div key={idx} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{item.patientName}</p>
                      <Badge variant="secondary" className="text-xs">{item.testCount} tests</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-mono">{item.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Critical Value Warning */}
      <Dialog open={showCriticalWarning} onOpenChange={setShowCriticalWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-critical">
              <AlertTriangle className="w-5 h-5" />
              Critical Values Detected
            </DialogTitle>
            <DialogDescription>
              Review critical values before confirming save.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="mb-3">The following results are outside critical limits:</p>
            <div className="space-y-2">
              {Object.values(entries)
                .filter(e => e.flag === 'critical_high' || e.flag === 'critical_low')
                .map(entry => (
                  <div key={entry.orderTestId} className="flex items-center justify-between p-3 bg-status-critical/10 rounded-lg">
                    <span className="font-medium text-sm">{entry.testCode} — {entry.testName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono">{entry.value} {entry.unit}</span>
                      <Badge variant="outline" className="bg-status-critical/10 text-status-critical text-xs">
                        {entry.flag === 'critical_high' ? 'HH' : 'LL'}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Please ensure the physician is notified immediately.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCriticalWarning(false)}>Go Back</Button>
            <Button variant="destructive" onClick={doSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
