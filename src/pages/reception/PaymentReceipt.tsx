import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Printer, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, isValid } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useOrder } from '@/hooks/useOrders';
import { getPatientAgeDisplay, getPatientName } from '@/utils/orderHelpers';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { usePrinterContext } from '@/context/PrinterContext';
import type { ReceiptData } from '@/utils/escpos';

export default function PaymentReceipt() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: order, isLoading } = useOrder(orderId!);
  const { printBothCopies } = useThermalPrint();
  const { settings } = usePrinterContext();
  const patientReceiptRef = useRef<HTMLDivElement>(null);
  const labReceiptRef = useRef<HTMLDivElement>(null);
  const autoPrintTriggeredRef = useRef(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printCount, setPrintCount] = useState(0);

  // Transform order data to receipt format
  const receiptData: ReceiptData | null = order ? {
    receiptNumber: `RCP-${format(new Date(), 'yyyyMMdd')}-${(order.order_number || order.orderNumber || 'XXX').toString().split('-').pop()}`,
    orderNumber: order.order_number || order.orderNumber || 'N/A',
    patientName: getPatientName(order),
    patientId: (order.patient || order.patients)?.patientId || 'Unknown',
    patientPhone: (order.patient || order.patients)?.phone || undefined,
    patientAge: (() => {
      const p = order.patient || order.patients;
      if (!p) return undefined;
      const ageDisplay = getPatientAgeDisplay(p);
      return ageDisplay !== '-' ? ageDisplay : undefined;
    })(),
    patientGender: (order.patient || order.patients)?.gender || undefined,
    tests: (() => {
      const rawTests = (order.order_tests || order.tests || []) as any[];
      // Group panel tests back into a single line per panel
      const grouped: Array<{ code: string; name: string; price: number }> = [];
      const seenPanels = new Set<string>();
      for (const ot of rawTests) {
        const panelCode = ot.panelCode || ot.panel_code;
        const panelName = ot.panelName || ot.panel_name;
        if (panelCode && panelName) {
          if (!seenPanels.has(panelCode)) {
            seenPanels.add(panelCode);
            // Sum all prices for this panel
            const panelPrice = rawTests
              .filter((t: any) => (t.panelCode || t.panel_code) === panelCode)
              .reduce((sum: number, t: any) => sum + (t.price || 0), 0);
            grouped.push({ code: panelCode, name: panelName, price: panelPrice });
          }
        } else {
          grouped.push({
            code: ot.testCode || ot.test_code || ot.test_catalog?.code || 'N/A',
            name: ot.testName || ot.test_name || ot.test_catalog?.name || 'Unknown Test',
            price: ot.price || 0,
          });
        }
      }
      return grouped;
    })(),
    subtotal: order.subtotal || 0,
    discount: order.discount || 0,
    discountType: order.discountType || 'fixed',
    total: order.total || 0,
    amountPaid: order.total || 0,
    paymentMethod: (order.payment_method === 'orange_money' || order.payment_method === 'afrimoney') ? 'mobile-money' : (order.payment_method || 'cash') as 'cash' | 'card' | 'mobile-money',
    paymentDate: (() => { const d = new Date(order.created_at || order.createdAt || ''); return isValid(d) ? d.toISOString() : new Date().toISOString(); })(),
    cashier: profile?.full_name || 'Cashier',
    collectionDate: (() => { const raw = order.collection_date || order.collectionDate; if (!raw) return undefined; const d = new Date(raw); return isValid(d) ? format(d, 'yyyy-MM-dd HH:mm') : undefined; })(),
  } : null;

  const formatCurrency = (amount: number) => {
    return `Le ${amount.toLocaleString()}`;
  };

  const handlePrintBoth = async () => {
    setIsPrinting(true);
    try {
      const result = await printBothCopies(
        patientReceiptRef.current,
        labReceiptRef.current,
        receiptData?.receiptNumber ?? '',
        receiptData ?? undefined
      );
      setPrintCount(result.printedCount);
      if (result.success) {
        toast.success('Both receipts printed successfully');
        setTimeout(() => navigate('/reception/orders'), 2000);
      } else {
        toast.error(`Only ${result.printedCount} of 2 receipts printed`);
      }
    } catch (error) {
      toast.error('Failed to print receipts');
      console.error('Print error:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  useEffect(() => {
    if (!receiptData) return;
    if (!settings.thermal.autoPrintOnPayment) return;
    if (autoPrintTriggeredRef.current) return;

    // Wait for receipt preview refs to be mounted before printing.
    const timer = setTimeout(() => {
      if (!patientReceiptRef.current || !labReceiptRef.current) return;
      autoPrintTriggeredRef.current = true;
      void handlePrintBoth();
    }, 500);

    return () => clearTimeout(timer);
  }, [receiptData, settings.thermal.autoPrintOnPayment]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle error state
  if (!order || !receiptData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-4">The order you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/reception/orders')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </Card>
      </div>
    );
  }

  const ReceiptContent = ({ copyType }: { copyType: 'patient' | 'lab' }) => (
    <div className="receipt">
      {/* Header */}
      <div className="header">
        <div className="logo">🏥</div>
        <div className="company-name">HARBOUR Medical Diagnostic</div>
        <div className="company-info">114, Fourah Bay Road, Freetown, Sierra Leone</div>
        <div className="company-info">Tel: +23274414434</div>
        <div className="company-info">habourlab@gmail.com</div>
      </div>

      {/* Copy Type Badge */}
      <div className="copy-type">
        {copyType === 'patient' ? '📋 PATIENT COPY' : '🔬 LAB COPY'}
      </div>

      {/* Receipt Info */}
      <div className="section">
        <div className="info-row">
          <span className="info-label">Receipt No:</span>
          <span className="info-value">{receiptData.receiptNumber}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Order No:</span>
          <span className="info-value">{receiptData.orderNumber}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Date:</span>
          <span className="info-value">{isValid(new Date(receiptData.paymentDate)) ? format(new Date(receiptData.paymentDate), 'dd/MM/yyyy HH:mm') : 'N/A'}</span>
        </div>
      </div>

      {/* Patient Info */}
      <div className="section">
        <div className="section-title">Patient Information</div>
        <div className="info-row">
          <span className="info-label">Name:</span>
          <span className="info-value">{receiptData.patientName}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Patient ID:</span>
          <span className="info-value">{receiptData.patientId}</span>
        </div>
        {receiptData.patientAge && (
          <div className="info-row">
            <span className="info-label">Age:</span>
            <span className="info-value">{receiptData.patientAge}</span>
          </div>
        )}
        {receiptData.patientGender && (
          <div className="info-row">
            <span className="info-label">Sex:</span>
            <span className="info-value">{receiptData.patientGender}</span>
          </div>
        )}
        {receiptData.patientPhone && (
          <div className="info-row">
            <span className="info-label">Phone:</span>
            <span className="info-value">{receiptData.patientPhone}</span>
          </div>
        )}
      </div>

      {/* Tests/Items */}
      <div className="items-table">
        <div className="section-title">Tests Ordered</div>
        {receiptData.tests.map((test, index) => (
          <div key={index} className="item-row">
            <div className="item-name">
              <div style={{ fontWeight: 'bold' }}>{test.code}</div>
              <div style={{ fontSize: '10px' }}>{test.name}</div>
            </div>
            <div className="item-price">{formatCurrency(test.price)}</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="totals">
        <div className="total-row">
          <span>Subtotal:</span>
          <span>{formatCurrency(receiptData.subtotal)}</span>
        </div>
        {receiptData.discount > 0 && (
          <div className="total-row">
            <span>
              Discount ({receiptData.discountType === 'percentage' ? `${receiptData.discount}%` : formatCurrency(receiptData.discount)}):
            </span>
            <span>
              -{formatCurrency(
                receiptData.discountType === 'percentage'
                  ? (receiptData.subtotal * receiptData.discount) / 100
                  : receiptData.discount
              )}
            </span>
          </div>
        )}
        <div className="total-row grand-total">
          <span>TOTAL:</span>
          <span>{formatCurrency(receiptData.total)}</span>
        </div>
      </div>

      {/* Payment Info */}
      <div className="payment-info">
        <div className="info-row">
          <span className="info-label">Payment Method:</span>
          <span className="info-value" style={{ textTransform: 'uppercase' }}>
            {receiptData.paymentMethod.replace('-', ' ')}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Amount Paid:</span>
          <span className="info-value">{formatCurrency(receiptData.amountPaid)}</span>
        </div>
        {receiptData.amountPaid > receiptData.total && (
          <div className="info-row">
            <span className="info-label">Change:</span>
            <span className="info-value">{formatCurrency(receiptData.amountPaid - receiptData.total)}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Cashier:</span>
          <span className="info-value">{receiptData.cashier}</span>
        </div>
      </div>

      {/* Collection Info */}
      {receiptData.collectionDate && (
        <div className="section">
          <div className="section-title">Sample Collection</div>
          <div className="info-row">
            <span className="info-label">Scheduled:</span>
            <span className="info-value">{receiptData.collectionDate}</span>
          </div>
        </div>
      )}

      {/* Instructions — patient copy only */}
      {copyType === 'patient' && (
        <div className="instructions">
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>IMPORTANT INSTRUCTIONS:</div>
          <div>• Please arrive 15 minutes before your scheduled time</div>
          <div>• Bring this receipt for sample collection</div>
          <div>• Fasting may be required for some tests</div>
          <div>• Results will be ready within 24-48 hours</div>
          <div>• Contact us for any queries</div>
        </div>
      )}

      {/* Barcode */}
      <div className="barcode">{receiptData.orderNumber}</div>

      {/* Footer — patient copy only */}
      {copyType === 'patient' && (
        <>
          <div className="thank-you">THANK YOU FOR CHOOSING US!</div>
          <div className="footer">
            <div>Open 24/7 | Onsite & Online Access</div>
            <div>Trusted by Clinics & Hospitals</div>
            <div style={{ marginTop: '10px', fontSize: '9px' }}>
              This is a computer-generated receipt
            </div>
            <div style={{ fontSize: '9px' }}>
              Printed: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Action Bar */}
      <div className="max-w-4xl mx-auto mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/reception/orders')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
              <div>
                <h2 className="text-lg font-semibold">Payment Receipt</h2>
                <p className="text-sm text-muted-foreground">
                  Order: {receiptData.orderNumber}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {printCount > 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Check className="w-3 h-3 mr-1" />
                  {printCount} of 2 printed
                </Badge>
              )}
              <Button 
                onClick={handlePrintBoth}
                disabled={isPrinting}
                size="lg"
              >
                <Printer className="w-4 h-4 mr-2" />
                {isPrinting ? 'Printing...' : 'Print Both Receipts'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Receipt Previews */}
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Patient Copy Preview */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Patient Copy Preview</h3>
            <Badge>Copy 1</Badge>
          </div>
          <div 
            ref={patientReceiptRef}
            className="bg-white border-2 border-dashed border-gray-300 p-4 font-mono text-xs"
            style={{ width: '302px', margin: '0 auto' }}
          >
            <ReceiptContent copyType="patient" />
          </div>
        </Card>

        {/* Lab Copy Preview */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-lg">Lab Copy Preview</h3>
            <Badge variant="secondary">Copy 2</Badge>
          </div>
          <div 
            ref={labReceiptRef}
            className="bg-white border-2 border-dashed border-gray-300 p-4 font-mono text-xs"
            style={{ width: '302px', margin: '0 auto' }}
          >
            <ReceiptContent copyType="lab" />
          </div>
        </Card>
      </div>

      {/* Print Instructions */}
      <div className="max-w-4xl mx-auto mt-6">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Printer className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-2">Thermal Printer Setup</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Ensure thermal printer is connected and powered on</li>
                <li>• Paper width should be set to 80mm</li>
                <li>• Both receipts will print automatically in sequence</li>
                <li>• Patient copy prints first, followed by lab copy</li>
                <li>• Give patient copy to the patient, keep lab copy for records</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
