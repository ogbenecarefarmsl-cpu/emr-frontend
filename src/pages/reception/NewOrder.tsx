import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useSearchPatients } from '@/hooks/usePatients';
import { useCreateOrder } from '@/hooks/useOrders';
import { useCreateDoctor, useDoctors } from '@/hooks/useDoctors';
import { useActiveTests } from '@/hooks/useTestCatalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, X, CreditCard, Banknote, Smartphone, Check, Printer, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TestCatalogItem } from '@/types/lis';
import { getPatientAgeDisplay, getPatientFullName } from '@/utils/orderHelpers';

export default function NewOrder() {
  const { profile } = useAuth();
  const { data: patients } = useSearchPatients('');
  const { data: testsFromDB, isLoading: testsLoading } = useActiveTests();
  const { data: doctors = [] } = useDoctors();
  const createDoctor = useCreateDoctor();
  const createOrder = useCreateOrder();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const preselectedPatientId = searchParams.get('patient') || '';

  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedTests, setSelectedTests] = useState<TestCatalogItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [testSearch, setTestSearch] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [referredByDoctor, setReferredByDoctor] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('none');
  const [showDoctorDialog, setShowDoctorDialog] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorPhone, setNewDoctorPhone] = useState('');
  const [newDoctorFacility, setNewDoctorFacility] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [splitRows, setSplitRows] = useState<Array<{ method: string; amount: string }>>([{ method: 'cash', amount: '' }]);
  const [paymentSummary, setPaymentSummary] = useState<Array<{ method: string; amount: number }>>([]);
  const [orderComplete, setOrderComplete] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  const normalizeId = (value: unknown): string => {
    if (!value) return '';
    return String(value);
  };

  const normalizeCode = (value: unknown): string => {
    if (!value) return '';
    return String(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  };

  const getTestId = (test: any): string => normalizeId(test?._id || test?.id);

  const getPanelComponentTestIds = (panel: any): Set<string> => {
    if (!panel?.tests || !Array.isArray(panel.tests)) return new Set<string>();

    return new Set(
      panel.tests
        .map((componentTest: any) =>
          normalizeId(componentTest?.testId || componentTest?._id || componentTest?.id)
        )
        .filter(Boolean)
    );
  };

  const getSelectedPanelComponentIds = (tests: TestCatalogItem[]): Set<string> => {
    const ids = new Set<string>();

    tests
      .filter((test: any) => test?.isPanel)
      .forEach((panel: any) => {
        getPanelComponentTestIds(panel).forEach((id) => ids.add(id));
      });

    return ids;
  };

  // Use database tests or empty array while loading
  const testCatalog = testsFromDB || [];

  const autoIncludedLinkedCodes = useMemo(() => {
    const linkedCodes = new Set<string>();
    const availableCodes = new Set<string>();

    for (const test of testCatalog as any[]) {
      const code = normalizeCode(test?.code);
      if (code) {
        availableCodes.add(code);
      }

      const linkedTests = Array.isArray((test as any)?.linkedTests)
        ? (test as any).linkedTests
        : [];

      for (const linkedCode of linkedTests) {
        const normalizedLinkedCode = normalizeCode(linkedCode);
        if (normalizedLinkedCode) {
          linkedCodes.add(normalizedLinkedCode);
        }
      }
    }

    // Backward-compatible fallback for setups where linkedTests is not configured yet.
    if (
      availableCodes.has('CRP') &&
      !linkedCodes.has('HSCRP') &&
      !linkedCodes.has('HSCR')
    ) {
      linkedCodes.add('HSCRP');
      linkedCodes.add('HSCR');
    }

    return linkedCodes;
  }, [testCatalog]);
  
  // Extract unique categories from database tests
  const testCategories = useMemo(() => {
    if (!testsFromDB) return [];
    const categories = new Set(testsFromDB.map((t: any) => t.category));
    return Array.from(categories).map(cat => ({
      id: String(cat),
      name: String(cat).charAt(0).toUpperCase() + String(cat).slice(1),
    }));
  }, [testsFromDB]);

  // Use the preselected patient ID if available and patient data is loaded
  const effectivePatientId = normalizeId(selectedPatientId || preselectedPatientId);
  const selectedPatient = patients && Array.isArray(patients) ? 
    patients.find(p => normalizeId(p._id || p.id) === effectivePatientId) : null;

  const filteredPatients = patients && Array.isArray(patients) ? 
    patients.filter(p => {
      const search = patientSearch.toLowerCase();
      return (
        p.firstName.toLowerCase().includes(search) ||
        p.lastName.toLowerCase().includes(search) ||
        p.patientId.toLowerCase().includes(search) ||
        p.phone?.includes(search)
      );
    }) : [];

  const recentPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];

    const getPatientTimestamp = (patient: any) => {
      const timestampValue = patient?.createdAt || patient?.registeredAt || patient?.updatedAt;
      if (!timestampValue) return 0;
      const parsed = new Date(timestampValue).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return [...patients]
      .sort((a: any, b: any) => getPatientTimestamp(b) - getPatientTimestamp(a))
      .slice(0, 6);
  }, [patients]);

  const formatPatientTimestamp = (patient: any) => {
    const timestampValue = patient?.createdAt || patient?.registeredAt || patient?.updatedAt;
    if (!timestampValue) return 'Time unavailable';

    const date = new Date(timestampValue);
    if (Number.isNaN(date.getTime())) return 'Time unavailable';

    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredTests = useMemo(() => {
    // Filter out tests with price = 0 (panel components that shouldn't be ordered individually)
    // Also filter out U-PROTEIN and tests that are auto-included via linked tests.
    let visibleTests = testCatalog.filter(t => 
      t.price > 0 && 
      t.code !== 'U-PROTEIN' && 
      t.code !== 'URINE-PROTEIN' &&
      !autoIncludedLinkedCodes.has(normalizeCode(t.code))
    );

    // Apply category filter
    if (categoryFilter !== 'all') {
      visibleTests = visibleTests.filter(t => t.category === categoryFilter);
    }

    // Apply search filter
    if (testSearch.trim()) {
      const search = testSearch.toLowerCase();
      visibleTests = visibleTests.filter(t => 
        t.code.toLowerCase().includes(search) ||
        t.name.toLowerCase().includes(search)
      );
    }

    // Sort: Panels first, then Serology, then the rest
    return visibleTests.sort((a, b) => {
      const aIsPanel = (a as any).isPanel === true;
      const bIsPanel = (b as any).isPanel === true;
      
      // Panels come first
      if (aIsPanel && !bIsPanel) return -1;
      if (!aIsPanel && bIsPanel) return 1;
      
      // Within same type (both panels or both tests), sort by category
      const aIsSerology = a.category === 'serology' || a.category === 'immunoassay';
      const bIsSerology = b.category === 'serology' || b.category === 'immunoassay';
      
      // Serology comes after panels but before other tests
      if (!aIsPanel && !bIsPanel) {
        if (aIsSerology && !bIsSerology) return -1;
        if (!aIsSerology && bIsSerology) return 1;
      }
      
      // Within same category, sort by name
      return String(a.name).localeCompare(String(b.name));
    });
  }, [autoIncludedLinkedCodes, categoryFilter, testCatalog, testSearch]);

  const subtotal = selectedTests.reduce((sum, t) => sum + t.price, 0);
  const discount = discountType === 'percentage' 
    ? (subtotal * (parseFloat(discountValue) || 0) / 100)
    : (parseFloat(discountValue) || 0);
  const total = Math.max(0, subtotal - discount);

  const handleTestToggle = (test: any) => {
    const testId = test._id || test.id;
    setSelectedTests(prev => {
      const exists = prev.find(t => {
        const existingId = t._id || t.id;
        return existingId === testId;
      });

      if (exists) {
        return prev.filter(t => {
          const existingId = t._id || t.id;
          return existingId !== testId;
        });
      }

      if (test.isPanel) {
        const panelComponentIds = getPanelComponentTestIds(test);
        const withoutConflictingIndividualTests = prev.filter((selected) => {
          if ((selected as any).isPanel) return true;
          const selectedId = getTestId(selected);
          return !panelComponentIds.has(selectedId);
        });

        return [...withoutConflictingIndividualTests, test];
      }

      const selectedPanelComponentIds = getSelectedPanelComponentIds(prev);
      const normalizedTestId = normalizeId(testId);
      if (selectedPanelComponentIds.has(normalizedTestId)) {
        toast.error('This test is already included in a selected panel');
        return prev;
      }

      return [...prev, test];
    });
  };

  const handleProceedToPayment = () => {
    if (!effectivePatientId || !selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }
    
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    const validRows = splitRows.filter(r => r.method && parseFloat(r.amount) > 0);
    if (validRows.length === 0) {
      toast.error('Please enter at least one payment amount');
      return;
    }
    const splitTotal = validRows.reduce((s, r) => s + parseFloat(r.amount), 0);
    if (splitTotal > total + 0.001) {
      toast.error(`Total Le ${splitTotal.toLocaleString()} exceeds order total Le ${total.toLocaleString()}`);
      return;
    }

    const patient = patients && Array.isArray(patients) ? 
      patients.find(p => (p._id || p.id) === effectivePatientId) : null;
    if (!patient) {
      toast.error('Patient not found');
      return;
    }
    
    // Expand panels into their component tests
    const orderTests: any[] = [];
    for (const test of selectedTests) {
      if (test.isPanel && test.tests && Array.isArray(test.tests)) {
        // This is a panel - add all component tests
        for (let index = 0; index < test.tests.length; index++) {
          const componentTest = test.tests[index];
          orderTests.push({
            testId: componentTest.testId || componentTest._id,
            testCode: componentTest.testCode,
            testName: componentTest.testName,
            panelCode: test.code,
            panelName: test.name,
            price: index === 0 ? test.price : 0,
          });
        }
      } else {
        // Regular test
        orderTests.push({
          testId: test._id || test.id,
          testCode: test.code,
          testName: test.name,
          price: test.price,
        });
      }
    }

    const deduplicatedOrderTests = new Map<string, any>();
    for (const orderTest of orderTests) {
      const key = normalizeId(orderTest.testCode || orderTest.testId);
      const existing = deduplicatedOrderTests.get(key);

      if (!existing || Number(orderTest.price || 0) > Number(existing.price || 0)) {
        deduplicatedOrderTests.set(key, orderTest);
      }
    }

    const normalizedOrderTests = Array.from(deduplicatedOrderTests.values());

    try {
      const validRows = splitRows.filter(r => r.method && parseFloat(r.amount) > 0);
      const newOrder = await createOrder.mutateAsync({
        patientId: patient._id || patient.id,
        priority,
        referredByDoctor: referredByDoctor.trim() || undefined,
        doctorId: selectedDoctorId !== 'none' ? selectedDoctorId : undefined,
        tests: normalizedOrderTests,
        discount: discount > 0 ? discount : undefined,
        discountType: discount > 0 ? discountType : undefined,
        initialPayments: validRows.map(r => ({ amount: parseFloat(r.amount), paymentMethod: r.method })),
        notes: undefined,
      });

      setPaymentSummary(validRows.map(r => ({ method: r.method, amount: parseFloat(r.amount) })));
      setCreatedOrder(newOrder);
      setShowPaymentModal(false);
      setOrderComplete(true);
      toast.success(`Order created successfully`);
      
      // Navigate to receipt page for automatic printing
      setTimeout(() => {
        navigate(`/reception/receipt/${newOrder.id || newOrder._id}`);
      }, 500);
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error('Failed to create order. Please try again.');
    }
  };

  if (orderComplete && createdOrder) {
    const handlePrint = async () => {
      if (window.electronAPI?.printSilent) {
        await window.electronAPI.printSilent({ silent: true });
      } else {
        window.print();
      }
    };

    return (
      <RoleLayout 
        title="Order Created" 
        subtitle="Order has been submitted"
        role="receptionist"
        userName={profile?.full_name}
      >
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border rounded-xl p-8" id="receipt-content">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-status-normal/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-status-normal" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Order Complete!</h2>
              <p className="text-muted-foreground">
                Payment received. Sample collection can proceed.
              </p>
            </div>
            
            {/* Receipt Details */}
            <div className="bg-muted rounded-lg p-6 mb-6">
              <div className="text-center mb-4 pb-4 border-b">
                <h3 className="font-bold text-lg">HARBOUR</h3>
                <p className="text-sm text-muted-foreground">Laboratory Information System</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date().toLocaleString()}
                </p>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Number:</span>
                  <span className="font-mono font-bold">{createdOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sample ID:</span>
                  <span className="font-mono font-bold">{createdOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-medium">{getPatientFullName(selectedPatient)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient ID:</span>
                  <span className="font-mono">{selectedPatient?.patientId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Age/Gender:</span>
                  <span>{getPatientAgeDisplay(selectedPatient)} / {selectedPatient?.gender === 'M' ? 'Male' : 'Female'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority:</span>
                  <span className="capitalize">{priority}</span>
                </div>
              </div>

              {/* Tests List */}
              <div className="border-t pt-4 mb-4">
                <h4 className="font-semibold mb-3">Tests Ordered:</h4>
                <div className="space-y-2">
                  {selectedTests.map((test, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <div className="flex-1">
                        <span className="font-medium">{test.code}</span>
                        <span className="text-muted-foreground ml-2">- {test.name}</span>
                      </div>
                      <span className="font-medium">Le {test.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>Le {subtotal.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-status-normal">
                    <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'}):</span>
                    <span>-Le {discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span>Le {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Amount Paid:</span>
                  <span>Le {Number(createdOrder.amountPaid ?? total).toLocaleString()}</span>
                </div>
                {Number(createdOrder.balance ?? 0) > 0 && (
                  <div className="flex justify-between text-sm font-medium text-amber-600">
                    <span>Balance (Credit):</span>
                    <span>Le {Number(createdOrder.balance).toLocaleString()}</span>
                  </div>
                )}
                {paymentSummary.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="capitalize">{p.method.replace(/_/g, ' ')}:</span>
                    <span>Le {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground">
                <p>Please bring this receipt when collecting your results.</p>
                <p className="mt-1">Write Sample ID on sample tube: <span className="font-mono font-bold">{createdOrder.orderNumber}</span></p>
              </div>
            </div>

            <div className="print:hidden">
              <Button onClick={handlePrint} variant="outline" className="w-full mb-3">
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setOrderComplete(false);
                    setCreatedOrder(null);
                    setSelectedTests([]);
                    setSelectedPatientId('');
                    setDiscountValue('');
                    setSplitRows([{ method: 'cash', amount: '' }]);
                    setPaymentSummary([]);
                  }} 
                  className="flex-1"
                >
                  New Order
                </Button>
                <Button onClick={() => navigate('/reception')} className="flex-1">
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout 
      title="New Test Order" 
      subtitle="Create a new laboratory test order"
      role="receptionist"
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Selection */}
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Patient Information</h3>
            
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold text-lg">{getPatientFullName(selectedPatient)}</p>
                  <p className="text-sm text-muted-foreground">{selectedPatient.patientId}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPatient.gender === 'M' ? 'Male' : selectedPatient.gender === 'F' ? 'Female' : 'Other'} • 
                    Age: {getPatientAgeDisplay(selectedPatient)}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSelectedPatientId('');
                    if (preselectedPatientId) {
                      navigate('/reception/new-order');
                    }
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recent Patients */}
                {!patientSearch && patients && patients.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Recent Patients</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                      {recentPatients.map((patient: any) => (
                        <button
                          key={patient._id || patient.id}
                          className="p-3 text-left border rounded-lg hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            const patientId = patient._id || patient.id;
                            setSelectedPatientId(patientId);
                            setPatientSearch('');
                          }}
                        >
                          <p className="font-medium text-sm">{getPatientFullName(patient)}</p>
                          <p className="text-xs text-muted-foreground">{patient.patientId}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatPatientTimestamp(patient)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, ID, or phone..."
                    className="pl-10"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                  />
                </div>
                
                {/* Search Results */}
                {patientSearch && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {filteredPatients.slice(0, 10).map(patient => (
                      <button
                        key={patient._id || patient.id}
                        className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          const patientId = patient._id || patient.id;
                          setSelectedPatientId(patientId);
                          setPatientSearch('');
                        }}
                      >
                        <p className="font-medium">{getPatientFullName(patient)}</p>
                        <p className="text-sm text-muted-foreground">{patient.patientId} • {patient.phone || 'No phone'}</p>
                      </button>
                    ))}
                    {filteredPatients.length === 0 && (
                      <div className="px-4 py-6 text-center text-muted-foreground">
                        <p>No patients found</p>
                        <Button variant="link" onClick={() => navigate('/reception/register')}>
                          Register New Patient
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Selection */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Select Tests</h3>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {testCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tests by code or name..."
                className="pl-10"
                value={testSearch}
                onChange={e => setTestSearch(e.target.value)}
              />
            </div>

            {testsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading tests...</p>
              </div>
            ) : filteredTests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No tests available</p>
                <p className="text-sm">Please contact administrator to add tests</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                {filteredTests.map(test => {
                  const testId = test._id || test.id;
                  const isSelected = selectedTests.some(t => (t._id || t.id) === testId);
                  return (
                    <div
                      key={testId}
                      onClick={() => handleTestToggle(test)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer',
                        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                        <div>
                          <p className="font-medium text-sm">{test.code}</p>
                          <p className="text-xs text-muted-foreground">{test.name}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-sm">Le {test.price.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Priority</h3>
            <div className="flex gap-3">
              {(['routine', 'urgent', 'stat'] as const).map(p => (
                <Button
                  key={p}
                  variant={priority === p ? 'default' : 'outline'}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'capitalize',
                    priority === p && p === 'urgent' && 'bg-status-warning hover:bg-status-warning/90',
                    priority === p && p === 'stat' && 'bg-status-critical hover:bg-status-critical/90'
                  )}
                >
                  {p}
                </Button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="referredByDoctor" className="text-sm">Referred by Doctor (Optional)</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedDoctorId}
                  onValueChange={(value) => {
                    setSelectedDoctorId(value);
                    const selected = doctors.find((d: any) => d._id === value);
                    if (selected) setReferredByDoctor(selected.fullName);
                    if (value === 'none') setReferredByDoctor('');
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No doctor</SelectItem>
                    {doctors.map((doctor: any) => (
                      <SelectItem key={doctor._id} value={doctor._id}>
                        {doctor.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setShowDoctorDialog(true)}>
                  Add
                </Button>
              </div>
              {selectedDoctorId === 'none' && (
                <Input
                  id="referredByDoctor"
                  value={referredByDoctor}
                  onChange={e => setReferredByDoctor(e.target.value)}
                  placeholder="Or type doctor name"
                />
              )}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-card border rounded-lg p-4 sticky top-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            
            {selectedTests.length > 0 ? (
              <>
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {selectedTests.map(test => {
                    const testId = test._id || test.id;
                    const isPanel = test.isPanel && test.tests && Array.isArray(test.tests);
                    
                    return (
                      <div key={testId} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{test.code}</span>
                          <div className="flex items-center gap-2">
                            <span>Le {test.price.toLocaleString()}</span>
                            <button 
                              onClick={() => handleTestToggle(test)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {isPanel && (
                          <div className="ml-3 mt-1 text-xs text-muted-foreground">
                            {test.tests.length} tests: {test.tests.slice(0, 3).map((t: any) => t.testCode).join(', ')}
                            {test.tests.length > 3 && '...'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>Le {subtotal.toLocaleString()}</span>
                  </div>

                  {/* Discount */}
                  <div className="space-y-2">
                    <Label className="text-sm">Discount</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        value={discountValue}
                        onChange={e => setDiscountValue(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={discountType} onValueChange={(v: 'fixed' | 'percentage') => setDiscountType(v)}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Le</SelectItem>
                          <SelectItem value="percentage">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-status-normal">
                      <span>Discount</span>
                      <span>-Le {discount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>Le {total.toLocaleString()}</span>
                  </div>
                </div>

                <Button 
                  className="w-full mt-4" 
                  size="lg"
                  onClick={handleProceedToPayment}
                  disabled={!effectivePatientId || !selectedPatient || selectedTests.length === 0}
                >
                  Proceed to Payment
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No tests selected</p>
                <p className="text-sm">Select tests from the list</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-muted rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium">{getPatientFullName(selectedPatient)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Tests</span>
                <span>{selectedTests.length} test(s)</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                <span>Amount Due</span>
                <span>Le {total.toLocaleString()}</span>
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
                const diff = total - splitTotal;
                if (splitTotal <= 0) return null;
                return (
                  <div className={cn('flex justify-between pt-2 border-t text-sm font-semibold', diff < -0.001 ? 'text-destructive' : diff > 0.001 ? 'text-amber-600' : 'text-status-normal')}>
                    <span>Total paying</span>
                    <span>Le {splitTotal.toLocaleString()} / Le {total.toLocaleString()}{diff < -0.001 ? ' ✗ exceeds' : diff > 0.001 ? ` (Le ${diff.toLocaleString()} balance)` : ' ✓ Fully paid'}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={createOrder.isPending || splitRows.every(r => !(parseFloat(r.amount) > 0))}
            >
              {createOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Check className="w-4 h-4 mr-2" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDoctorDialog} onOpenChange={setShowDoctorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Doctor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={newDoctorName} onChange={(e) => setNewDoctorName(e.target.value)} placeholder="Doctor full name" />
            </div>
            <div className="space-y-1">
              <Label>Phone (optional)</Label>
              <Input value={newDoctorPhone} onChange={(e) => setNewDoctorPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Facility (optional)</Label>
              <Input value={newDoctorFacility} onChange={(e) => setNewDoctorFacility(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDoctorDialog(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!newDoctorName.trim()) {
                  toast.error('Doctor name is required');
                  return;
                }
                try {
                  const doctor = await createDoctor.mutateAsync({
                    fullName: newDoctorName.trim(),
                    phone: newDoctorPhone.trim() || undefined,
                    facility: newDoctorFacility.trim() || undefined,
                  });
                  setSelectedDoctorId(doctor._id);
                  setReferredByDoctor(doctor.fullName);
                  setShowDoctorDialog(false);
                  setNewDoctorName('');
                  setNewDoctorPhone('');
                  setNewDoctorFacility('');
                  toast.success('Doctor added');
                } catch {
                  toast.error('Failed to add doctor');
                }
              }}
              disabled={createDoctor.isPending}
            >
              {createDoctor.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
