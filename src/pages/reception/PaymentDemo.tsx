import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { CreditCard } from 'lucide-react';

export default function PaymentDemo() {
  const { profile } = useAuth();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // DEMO/SAMPLE DATA - This page is for testing the receipt printing functionality
  // In production, this data would come from a real order via API
  const mockOrder = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    orderNumber: 'ORD-20260209-001',
    patientName: 'Zainab Kargbo',
    patientId: 'LAB-20250131-001',
    patientPhone: '+232 75 766461',
    tests: [
      { code: 'CBC', name: 'Complete Blood Count', price: 50000 },
      { code: 'LFT', name: 'Liver Function Test', price: 75000 },
      { code: 'RFT', name: 'Renal Function Test', price: 65000 },
      { code: 'HBsAg', name: 'Hepatitis B Surface Antigen', price: 40000 },
    ],
    subtotal: 230000,
    discount: 10,
    discountType: 'percentage' as const,
    total: 207000,
  };

  return (
    <RoleLayout
      title="Payment & Receipt Demo"
      subtitle="Test the thermal receipt printing functionality"
      role="receptionist"
      userName={profile?.full_name}
    >
      <div className="max-w-2xl mx-auto">
        <Card className="p-8">
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Thermal Receipt Printing</h2>
              <p className="text-muted-foreground">
                Click the button below to process a payment and print thermal receipts
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 space-y-3">
              <h3 className="font-semibold text-lg">Sample Order Details</h3>
              <div className="text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Order Number:</span>
                  <span className="font-medium">{mockOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Patient:</span>
                  <span className="font-medium">{mockOrder.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tests:</span>
                  <span className="font-medium">{mockOrder.tests.length} tests</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-gray-600">Total Amount:</span>
                  <span className="font-bold text-lg">Le {mockOrder.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => setShowPaymentDialog(true)}
              className="w-full"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Process Payment & Print Receipts
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Click the button to open the payment dialog</li>
                <li>Select payment method (Cash, Card, or Mobile Money)</li>
                <li>Enter the amount paid</li>
                <li>Process the payment</li>
                <li>Print both receipts (Patient copy & Lab copy)</li>
                <li>Receipts are optimized for 80mm thermal printers</li>
              </ol>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-amber-900 mb-2">Thermal Printer Setup:</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Ensure your thermal printer is connected</li>
                <li>• Set paper width to 80mm in printer settings</li>
                <li>• Patient copy prints first, then lab copy</li>
                <li>• Each receipt includes barcode and instructions</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        order={mockOrder}
        cashierName={profile?.full_name || 'Cashier'}
      />
    </RoleLayout>
  );
}
