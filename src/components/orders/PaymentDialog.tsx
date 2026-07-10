import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThermalReceipt } from '@/components/receipts/ThermalReceipt';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { usePrinterContext } from '@/context/PrinterContext';
import { usbPrinterService } from '@/services/usbPrinterService';
import { toast } from 'sonner';
import { CreditCard, Banknote, Smartphone, Printer, Check, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useAddPayment } from '@/hooks/useOrders';
import { usePatientWallet } from '@/hooks/usePatients';
import { useMyBranch } from '@/hooks/useBranch';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    orderNumber: string;
    patientName: string;
    patientId: string;
    patientObjectId?: string;
    patientPhone?: string;
    tests: Array<{
      code: string;
      name: string;
      price: number;
    }>;
    subtotal: number;
    discount: number;
    discountType: 'percentage' | 'fixed';
    total: number;
  };
  cashierName: string;
}

export function PaymentDialog({
  open,
  onOpenChange,
  order,
  cashierName,
}: PaymentDialogProps) {
  const navigate = useNavigate();
  const { printBothCopies } = useThermalPrint();
  const { settings, thermalConnected } = usePrinterContext();
  const addPayment = useAddPayment();
  const { data: wallet } = usePatientWallet(order.patientObjectId || '');
  const { data: branch } = useMyBranch();
  const patientReceiptRef = useRef<HTMLDivElement>(null);
  const labReceiptRef = useRef<HTMLDivElement>(null);

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'orange_money' | 'afrimoney' | 'wallet'>('cash');
  const [amountPaid, setAmountPaid] = useState<string>(order.total.toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const receiptNumber = `RCP-${format(new Date(), 'yyyyMMdd')}-${order.id.slice(0, 3).toUpperCase()}`;
  const walletBalance = Number(wallet?.balance || 0);
  const canUseWallet = !!order.patientObjectId && walletBalance >= order.total;

  useEffect(() => {
    if (open && canUseWallet && !paymentComplete) {
      setPaymentMethod('wallet');
      setAmountPaid(order.total.toString());
    }
  }, [open, canUseWallet, order.total, paymentComplete]);
  
  const receiptData = {
    receiptNumber,
    orderNumber: order.orderNumber,
    patientName: order.patientName,
    patientId: order.patientId,
    patientPhone: order.patientPhone,
    tests: order.tests,
    subtotal: order.subtotal,
    discount: order.discount,
    discountType: order.discountType,
    total: order.total,
    amountPaid: parseFloat(amountPaid) || 0,
    paymentMethod,
    paymentDate: new Date().toISOString(),
    cashier: cashierName,
    collectionDate: format(new Date(), 'yyyy-MM-dd HH:mm'),
    branch: branch
      ? {
          name: branch.name,
          address: branch.address,
          phone: branch.phone,
          email: branch.email,
          tagline: branch.tagline,
          website: branch.website,
          operatingHours: branch.operatingHours,
          footerText: branch.footerText,
        }
      : undefined,
  };

  const change = receiptData.amountPaid - order.total;

  const handlePrintReceipts = async () => {
    if (import.meta.env.DEV) {
      console.log('=== PRINT RECEIPTS DEBUG START ===');
      console.log('Settings:', settings);
      console.log('Thermal Connected (state):', thermalConnected);
      console.log('USB Service Connected (singleton):', usbPrinterService.isConnected);
      console.log('Receipt Data:', receiptData);
      console.log('Patient Ref:', patientReceiptRef.current);
      console.log('Lab Ref:', labReceiptRef.current);
    }
    
    setIsPrinting(true);

    try {
      const result = await printBothCopies(
        patientReceiptRef.current,
        labReceiptRef.current,
        receiptNumber,
        receiptData
      );

      if (import.meta.env.DEV) {
        console.log('Print Result:', result);
        console.log('=== PRINT RECEIPTS DEBUG END ===');
      }

      if (result.success) {
        toast.success('Both receipts printed successfully');
        setTimeout(() => {
          onOpenChange(false);
        }, 1000);
      } else {
        toast.error(`Only ${result.printedCount} of 2 receipts printed`);
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print receipts');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleProcessPayment = async () => {
    if (paymentMethod === 'wallet' && !canUseWallet) {
      toast.error(`Wallet balance is insufficient. Available: Le ${walletBalance.toLocaleString()}`);
      return;
    }

    if (receiptData.amountPaid < order.total) {
      toast.error('Amount paid is less than total');
      return;
    }

    setIsProcessing(true);

    try {
      await addPayment.mutateAsync({
        orderId: order.id,
        data: {
          amount: receiptData.amountPaid,
          paymentMethod: paymentMethod,
        },
      });

      setPaymentComplete(true);
      toast.success('Payment processed successfully');

      // Auto-print receipts if setting is enabled
      if (settings.thermal.autoPrintOnPayment) {
        // Short delay so the receipt refs render in the DOM
        setTimeout(() => {
          void handlePrintReceipts();
        }, 300);
      }
    } catch (error) {
      toast.error('Failed to process payment');
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewReceipt = () => {
    navigate(`/reception/receipt/${order.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>
            Order: {order.orderNumber} - {order.patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Order Summary</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {order.tests.map((test, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {test.code} - {test.name}
                  </span>
                  <span className="font-medium">Le {test.price.toLocaleString()}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>Le {order.subtotal.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>
                    Discount (
                    {order.discountType === 'percentage'
                      ? `${order.discount}%`
                      : `Le ${order.discount.toLocaleString()}`}
                    ):
                  </span>
                  <span>
                    -Le{' '}
                    {(order.discountType === 'percentage'
                      ? (order.subtotal * order.discount) / 100
                      : order.discount
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total:</span>
                <span>Le {order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {!paymentComplete ? (
            <>
              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Patient wallet</span>
                    <span className="font-semibold">Le {walletBalance.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {canUseWallet ? 'Enough balance available. Wallet payment is selected automatically.' : 'Use cash or mobile money if the wallet cannot cover this bill.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Banknote className="w-6 h-6" />
                    <span>Cash</span>
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'orange_money' ? 'default' : 'outline'}
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setPaymentMethod('orange_money')}
                  >
                    <Smartphone className="w-6 h-6" />
                    <span>Orange Money</span>
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'afrimoney' ? 'default' : 'outline'}
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setPaymentMethod('afrimoney')}
                  >
                    <Smartphone className="w-6 h-6" />
                    <span>Afrimoney</span>
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'wallet' ? 'default' : 'outline'}
                    className="h-20 flex flex-col gap-2"
                    disabled={!canUseWallet}
                    onClick={() => setPaymentMethod('wallet')}
                  >
                    <Wallet className="w-6 h-6" />
                    <span>Wallet</span>
                  </Button>
                </div>
              </div>

              {/* Amount Paid */}
              <div className="space-y-2">
                <Label htmlFor="amountPaid">Amount Paid</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Enter amount"
                  className="text-lg font-semibold"
                />
                {change > 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    Change: Le {change.toLocaleString()}
                  </p>
                )}
                {change < 0 && (
                  <p className="text-sm text-red-600 font-medium">
                    Insufficient amount: Le {Math.abs(change).toLocaleString()} short
                  </p>
                )}
              </div>

              {/* Process Payment Button */}
              <Button
                onClick={handleProcessPayment}
                disabled={isProcessing || receiptData.amountPaid < order.total}
                className="w-full"
                size="lg"
              >
                {isProcessing ? 'Processing...' : 'Process Payment'}
              </Button>
            </>
          ) : (
            <>
              {/* Payment Success */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-3">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-green-900">Payment Successful!</h3>
                  <p className="text-sm text-green-700">Receipt Number: {receiptNumber}</p>
                </div>
                {change > 0 && (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-sm text-gray-600">Change to return:</p>
                    <p className="text-2xl font-bold text-green-600">
                      Le {change.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Print Receipts Button */}
              <div className="space-y-3">
                {/* Printer Status Indicator */}
                {settings.thermal.enabled && thermalConnected ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>USB Thermal Printer Connected</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                      <span>Using Browser Print Dialog</span>
                    </div>
                    <div className="text-xs text-muted-foreground px-3">
                      {!settings.thermal.enabled && '• Thermal printing is disabled'}
                      {settings.thermal.enabled && !thermalConnected && '• USB printer not connected'}
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handlePrintReceipts}
                  disabled={isPrinting}
                  className="w-full"
                  size="lg"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {isPrinting ? 'Printing...' : 'Print Both Receipts'}
                </Button>
                <Button
                  onClick={handleViewReceipt}
                  variant="outline"
                  className="w-full"
                >
                  View Receipt Page
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Hidden Receipt Elements for Printing — always rendered so refs are available */}
        <div className="hidden">
          <div ref={patientReceiptRef}>
            <ThermalReceipt data={receiptData} copyType="patient" />
          </div>
          <div ref={labReceiptRef}>
            <ThermalReceipt data={receiptData} copyType="lab" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
