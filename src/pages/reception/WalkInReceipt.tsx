import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, Check, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useMyBranch } from '@/hooks/useBranch';
import { usbPrinterService } from '@/services/usbPrinterService';
import { btPrinterService } from '@/services/bluetoothPrinterService';
import { buildWalkInReceiptESCPOS } from '@/utils/escpos';

interface WalkInItem {
  description: string;
  amount: number;
}

export default function WalkInReceipt() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: branch } = useMyBranch();
  const [isPrinting, setIsPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);

  const [patientName, setPatientName] = useState('Walk-in Customer');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [items, setItems] = useState<WalkInItem[]>([
    { description: '', amount: 0 },
  ]);

  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const canPrint = items.some((it) => it.description.trim() && Number(it.amount) > 0);

  const addItem = () => setItems([...items, { description: '', amount: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: 'description' | 'amount', value: any) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handlePrint = async () => {
    if (!canPrint) return;
    setIsPrinting(true);
    try {
      const validItems = items.filter(it => it.description.trim() && Number(it.amount) > 0);
      const bytes = buildWalkInReceiptESCPOS(
        {
          patientName: patientName || 'Walk-in',
          paymentMethod,
          cashier: profile?.fullName || 'Cashier',
          items: validItems.map(it => ({ description: it.description, amount: Number(it.amount) })),
          total,
        },
        branch
      );

      let printed = false;
      if (usbPrinterService.isConnected) {
        try { await usbPrinterService.print(bytes); printed = true; } catch {}
      }
      if (!printed && btPrinterService.isConnected) {
        try { await btPrinterService.print(bytes); printed = true; } catch {}
      }
      if (!printed && !usbPrinterService.isConnected) {
        try { if (await usbPrinterService.autoConnect()) { await usbPrinterService.print(bytes); printed = true; } } catch {}
      }
      if (!printed && !btPrinterService.isConnected) {
        try { if (await btPrinterService.autoConnect()) { await btPrinterService.print(bytes); printed = true; } } catch {}
      }

      if (printed) {
        setPrinted(true);
        toast.success('Walk-in receipt printed');
      } else {
        toast.error('No printer connected. Connect a USB or Bluetooth thermal printer.');
      }
    } catch (err: any) {
      toast.error(`Print failed: ${err.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const formatCurrency = (n: number) => `Le ${n.toLocaleString()}`;

  return (
    <RoleLayout
      title="Walk-in Receipt"
      subtitle="Print a receipt for ad-hoc sales (no patient file)"
      role="receptionist"
      userName={profile?.fullName}
    >
      <div className="max-w-3xl space-y-4">
        {/* Action bar */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handlePrint} disabled={isPrinting || !canPrint}>
              {isPrinting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : printed ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Printer className="w-4 h-4 mr-2" />
              )}
              {printed ? 'Printed' : 'Print Receipt'}
            </Button>
          </div>
        </Card>

        {/* Input form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Walk-in details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Customer name</Label>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Walk-in Customer"
                />
              </div>
              <div className="space-y-1">
                <Label>Payment method</Label>
                <select
                  className="h-9 w-full rounded border border-input bg-background px-3 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="afrimoney">Afrimoney</option>
                  <option value="qmoney">QMoney</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-3 h-3 mr-1" /> Add row
                </Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder="Description (e.g. Wound dressing, paracetamol 500mg)"
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={item.amount || ''}
                    onChange={(e) => updateItem(idx, 'amount', Number(e.target.value) || 0)}
                    className="w-32"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleLayout>
  );
}
