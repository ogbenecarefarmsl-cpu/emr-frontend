import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { prescriptionService } from '@/services/prescriptionService';
import { useMyBranch } from '@/hooks/useBranch';
import { BranchLetterhead, BranchFooterText } from '@/components/receipts/BranchLetterhead';
import { thermalPrintStyles } from '@/components/receipts/ThermalReceipt';
import type { Prescription } from '@/types/prescription';
import { usbPrinterService } from '@/services/usbPrinterService';
import { btPrinterService } from '@/services/bluetoothPrinterService';
import { buildPrescriptionReceiptESCPOS } from '@/utils/escpos';
import type { BranchHeaderData } from '@/utils/escpos';

export default function PrescriptionReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: branch } = useMyBranch();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const autoPrintTriggeredRef = useRef(false);

  // Fetch the prescription
  const { data: rx, isLoading } = useQuery<Prescription>({
    queryKey: ['prescription', id],
    queryFn: async () => {
      const list = await prescriptionService.findAll();
      const found = list.find((p: any) => p._id === id);
      if (!found) throw new Error('Prescription not found');
      return found;
    },
    enabled: !!id,
  });

  // Auto-print 2 copies on mount after dispense
  useEffect(() => {
    if (!rx || !receiptRef.current || autoPrintTriggeredRef.current) return;
    autoPrintTriggeredRef.current = true;
    const timer = setTimeout(async () => {
      await handlePrint();
      // Print second copy after delay
      setTimeout(() => handlePrint(), 1000);
    }, 500);
    return () => clearTimeout(timer);
  }, [rx]);

  const handlePrint = async () => {
    if (!rx) return;
    setIsPrinting(true);
    try {
      const branchHeader: BranchHeaderData | null = branch ? {
        name: branch.name || '',
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        tagline: branch.tagline,
        website: branch.website,
        operatingHours: branch.operatingHours,
        footerText: branch.footerText,
      } : null;

      const pName = `${rx.patientId?.firstName || ''} ${rx.patientId?.lastName || ''}`.trim();
      const dDate = rx.dispensedAt
        ? format(new Date(rx.dispensedAt), 'dd/MM/yyyy HH:mm')
        : format(new Date(), 'dd/MM/yyyy HH:mm');

      const bytes = buildPrescriptionReceiptESCPOS({
        prescriptionNumber: rx.prescriptionNumber,
        patientName: pName,
        patientId: rx.patientId?.patientId || '',
        dispenseDate: dDate,
        status: rx.status,
        items: (rx.items || []).map((item: any) => ({
          medicationName: item.medicationName,
          strengthPerDose: item.strengthPerDose,
          dosesPerDay: item.dosesPerDay,
          durationDays: item.durationDays,
          instructions: item.instructions,
          dispensedSellUnits: item.dispensedSellUnits,
          priceAtDispense: item.priceAtDispense,
          lineTotalAtDispense: item.lineTotalAtDispense,
          dispenseMode: item.dispenseMode,
          dispensedPackName: item.dispensedPackName,
        })),
        totalAmount: rx.totalAmount || 0,
        actualTotalAmount: rx.actualTotalAmount,
        isPaid: rx.isPaid,
      }, branchHeader);

      let printed = false;

      if (usbPrinterService.isConnected) {
        try {
          await usbPrinterService.print(bytes);
          printed = true;
        } catch { /* fall through */ }
      }

      if (!printed && btPrinterService.isConnected) {
        try {
          await btPrinterService.print(bytes);
          printed = true;
        } catch { /* fall through */ }
      }

      if (!printed && !usbPrinterService.isConnected) {
        try {
          const ok = await usbPrinterService.autoConnect();
          if (ok) {
            await usbPrinterService.print(bytes);
            printed = true;
          }
        } catch { /* fall through */ }
      }

      if (!printed && !btPrinterService.isConnected) {
        try {
          const ok = await btPrinterService.autoConnect();
          if (ok) {
            await btPrinterService.print(bytes);
            printed = true;
          }
        } catch { /* fall through */ }
      }

      if (printed) {
        setPrinted(true);
        toast.success('Prescription receipt printed');
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

  const patientName = `${rx?.patientId?.firstName || ''} ${rx?.patientId?.lastName || ''}`.trim();
  const dispenseDate = rx?.dispensedAt
    ? format(new Date(rx.dispensedAt), 'dd/MM/yyyy HH:mm')
    : format(new Date(), 'dd/MM/yyyy HH:mm');

  return (
    <RoleLayout
      title="Prescription Receipt"
      subtitle={rx ? `${rx.prescriptionNumber} — dispensed` : 'Loading'}
      role="receptionist"
      userName={profile?.fullName}
    >
      <div className="max-w-2xl space-y-4">
        {/* Print action bar */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handlePrint} disabled={isPrinting || !rx}>
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

        {/* The printable receipt — thermal styling */}
        {rx && (
          <style>{thermalPrintStyles}</style>
        )}
        <div ref={receiptRef} className="receipt bg-white p-4 rounded shadow mx-auto" style={{ maxWidth: '80mm' }}>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
            </div>
          ) : rx ? (
            <>
              {/* Header (branch letterhead) */}
              <div className="header">
                <BranchLetterhead compact branch={branch} />
              </div>

              {/* Doc title */}
              <div className="copy-type">💊 PRESCRIPTION</div>

              {/* Receipt info */}
              <div className="section">
                <div className="info-row">
                  <span className="info-label">Rx No:</span>
                  <span className="info-value">{rx.prescriptionNumber}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Date:</span>
                  <span className="info-value">{dispenseDate}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Status:</span>
                  <span className="info-value">{rx.status.toUpperCase()}</span>
                </div>
              </div>

              {/* Patient */}
              <div className="section">
                <div className="section-title">PATIENT</div>
                <div className="info-row">
                  <span className="info-label">Name:</span>
                  <span className="info-value">{patientName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">ID:</span>
                  <span className="info-value">{rx.patientId?.patientId}</span>
                </div>
              </div>

              <div className="separator" />

              {/* Items */}
              <div className="section">
                <div className="section-title">MEDICATIONS DISPENSED</div>
                {(rx.items || []).map((item: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="text-sm font-semibold">
                      {i + 1}. {item.medicationName}
                    </div>
                    {item.dispenseMode === 'pack' && item.dispensedPackName && (
                      <div className="text-xs text-muted-foreground ml-4">
                        Pack: {item.dispensedPackName}
                      </div>
                    )}
                    {item.strengthPerDose && (
                      <div className="text-xs ml-4">
                        Dose: {item.strengthPerDose}, {item.dosesPerDay}×/day, {item.durationDays} day{item.durationDays !== 1 ? 's' : ''}
                      </div>
                    )}
                    {item.instructions && (
                      <div className="text-xs italic ml-4">{item.instructions}</div>
                    )}
                    {item.lineTotalAtDispense != null && (
                      <div className="text-xs ml-4 text-right">
                        {item.dispensedSellUnits} × {formatCurrency(item.priceAtDispense || 0)} = {formatCurrency(item.lineTotalAtDispense)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="separator" />

              {/* Totals */}
              <div className="section">
                {rx.totalAmount != null && rx.actualTotalAmount != null && rx.actualTotalAmount !== rx.totalAmount && (
                  <>
                    <div className="info-row">
                      <span className="info-label">Prescribed total:</span>
                      <span className="info-value">{formatCurrency(rx.totalAmount)}</span>
                    </div>
                    <div className="info-row" style={{ fontWeight: 'bold' }}>
                      <span className="info-label">Dispensed total:</span>
                      <span className="info-value">{formatCurrency(rx.actualTotalAmount)}</span>
                    </div>
                  </>
                )}
                {(!rx.actualTotalAmount || rx.actualTotalAmount === rx.totalAmount) && (
                  <div className="info-row" style={{ fontWeight: 'bold' }}>
                    <span className="info-label">TOTAL:</span>
                    <span className="info-value">{formatCurrency(rx.totalAmount || 0)}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">Status:</span>
                  <span className="info-value">{rx.isPaid ? 'PAID' : 'UNPAID'}</span>
                </div>
              </div>

              <div className="separator" />

              {/* Footer */}
              <div className="footer">
                <BranchFooterText branch={branch} />
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
            </>
          ) : (
            <div className="text-center p-8 text-muted-foreground">Prescription not found.</div>
          )}
        </div>
      </div>
    </RoleLayout>
  );
}
