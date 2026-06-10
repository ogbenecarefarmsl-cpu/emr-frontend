import { useState, useRef } from 'react';
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
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { useMyBranch } from '@/hooks/useBranch';
import { BranchLetterhead, BranchFooterText } from '@/components/receipts/BranchLetterhead';
import { thermalPrintStyles } from '@/components/receipts/ThermalReceipt';

interface WalkInItem {
  description: string;
  amount: number;
}

export default function WalkInReceipt() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: branch } = useMyBranch();
  const { printReceipt } = useThermalPrint();
  const receiptRef = useRef<HTMLDivElement>(null);
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
    if (!receiptRef.current || !canPrint) return;
    setIsPrinting(true);
    try {
      await printReceipt(receiptRef.current, {
        title: `Walk-in ${patientName}`,
        onSuccess: () => {
          setPrinted(true);
          toast.success('Walk-in receipt printed');
        },
        onError: (err) => {
          toast.error(`Print failed: ${err.message}`);
        },
      });
    } catch {
      // already toasted
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

        {/* Preview */}
        <style>{thermalPrintStyles}</style>
        <div ref={receiptRef} className="receipt bg-white p-4 rounded shadow mx-auto" style={{ maxWidth: '80mm' }}>
          <div className="header">
            <BranchLetterhead compact />
          </div>

          <div className="copy-type">🧾 WALK-IN SALE</div>

          <div className="section">
            <div className="info-row">
              <span className="info-label">Customer:</span>
              <span className="info-value">{patientName || 'Walk-in'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Date:</span>
              <span className="info-value">{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
            </div>
          </div>

          <div className="separator" />

          <div className="section">
            <div className="section-title">ITEMS</div>
            {items
              .filter((it) => it.description.trim() && Number(it.amount) > 0)
              .map((item, i) => (
                <div key={i} className="mb-1">
                  <div className="text-sm">{i + 1}. {item.description}</div>
                  <div className="text-xs text-right">{formatCurrency(Number(item.amount))}</div>
                </div>
              ))}
          </div>

          <div className="separator" />

          <div className="section">
            <div className="info-row" style={{ fontWeight: 'bold' }}>
              <span className="info-label">TOTAL:</span>
              <span className="info-value">{formatCurrency(total)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Method:</span>
              <span className="info-value">{paymentMethod.toUpperCase()}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Cashier:</span>
              <span className="info-value">{profile?.fullName || 'Cashier'}</span>
            </div>
          </div>

          <div className="separator" />

          <div className="footer">
            <BranchFooterText />
            <div style={{ marginTop: '10px', fontSize: '9px' }}>
              Computer-generated receipt
            </div>
            <div style={{ fontSize: '9px' }}>
              Printed: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
            </div>
            {branch?._id && (
              <div style={{ fontSize: '9px', marginTop: '4px' }}>
                Outlet: {branch.code}
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}
