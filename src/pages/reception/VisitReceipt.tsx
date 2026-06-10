import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { visitsAPI, paymentsAPI } from '@/services/api';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { useMyBranch } from '@/hooks/useBranch';
import { BranchLetterhead, BranchFooterText } from '@/components/receipts/BranchLetterhead';
import { thermalPrintStyles } from '@/components/receipts/ThermalReceipt';

interface VisitReceiptData {
  visitId: string;
  visitNumber: string;
  patientName: string;
  patientId: string;
  serviceLabel: string;
  procedureType?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  cashier: string;
  branch: any;
}

export default function VisitReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const visitId = searchParams.get('visitId');
  const { profile } = useAuth();
  const { data: branch } = useMyBranch();
  const { printReceipt } = useThermalPrint();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [receiptData, setReceiptData] = useState<VisitReceiptData | null>(null);

  // Fetch the visit
  const { data: visit, isLoading } = useQuery<any>({
    queryKey: ['visit', visitId],
    queryFn: async () => {
      if (!visitId) return null;
      return visitsAPI.getById(visitId);
    },
    enabled: !!visitId,
  });

  // Hydrate receipt data when visit loads
  useState(() => {
    if (visit && branch) {
      setReceiptData({
        visitId: visit._id || visit.id,
        visitNumber: visit.visitNumber,
        patientName: `${visit.patientId?.firstName || ''} ${visit.patientId?.lastName || ''}`.trim(),
        patientId: visit.patientId?.patientId || '',
        serviceLabel: visit.serviceType || 'consultation',
        procedureType: visit.procedureType,
        amount: visit.consultationFee || 0,
        paymentMethod: visit.consultationPaymentMethod || 'cash',
        paymentDate: visit.consultationPaidAt || new Date().toISOString(),
        cashier: profile?.fullName || 'Cashier',
        branch,
      });
    }
  });

  // Re-hydrate when visit/branch arrive
  if (visit && branch && (!receiptData || receiptData.visitId !== (visit._id || visit.id))) {
    setReceiptData({
      visitId: visit._id || visit.id,
      visitNumber: visit.visitNumber,
      patientName: `${visit.patientId?.firstName || ''} ${visit.patientId?.lastName || ''}`.trim(),
      patientId: visit.patientId?.patientId || '',
      serviceLabel: visit.serviceType || 'consultation',
      procedureType: visit.procedureType,
      amount: visit.consultationFee || 0,
      paymentMethod: visit.consultationPaymentMethod || 'cash',
      paymentDate: visit.consultationPaidAt || new Date().toISOString(),
      cashier: profile?.fullName || 'Cashier',
      branch,
    });
  }

  const handlePrint = async () => {
    if (!receiptRef.current || !receiptData) return;
    setIsPrinting(true);
    try {
      await printReceipt(receiptRef.current, {
        title: `Visit ${receiptData.visitNumber}`,
        onSuccess: () => {
          setPrinted(true);
          toast.success('Visit receipt printed');
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

  const serviceLabelDisplay = (label: string) => {
    const map: Record<string, string> = {
      normal_consultation: 'Normal Consultation',
      specialist_consultation: 'Specialist Consultation',
      observation_4h: 'Observation (4 hours)',
      procedure: 'Procedure',
    };
    return map[label] || label;
  };

  return (
    <RoleLayout
      title="Visit Receipt"
      subtitle={receiptData ? `${receiptData.visitNumber} — paid` : 'Loading'}
      role="receptionist"
      userName={profile?.fullName}
    >
      <div className="max-w-2xl space-y-4">
        {/* Action bar */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handlePrint} disabled={isPrinting || !receiptData}>
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

        {/* Printable receipt */}
        {receiptData && <style>{thermalPrintStyles}</style>}
        <div ref={receiptRef} className="receipt bg-white p-4 rounded shadow mx-auto" style={{ maxWidth: '80mm' }}>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
            </div>
          ) : !visitId ? (
            <div className="text-center p-8 text-muted-foreground">No visitId query parameter.</div>
          ) : !visit ? (
            <div className="text-center p-8 text-muted-foreground">Visit not found.</div>
          ) : receiptData ? (
            <>
              {/* Header (branch letterhead) */}
              <div className="header">
                <BranchLetterhead compact />
              </div>

              {/* Title */}
              <div className="copy-type">🩺 VISIT FEE</div>

              {/* Visit info */}
              <div className="section">
                <div className="info-row">
                  <span className="info-label">Visit No:</span>
                  <span className="info-value">{receiptData.visitNumber}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Date:</span>
                  <span className="info-value">{format(new Date(receiptData.paymentDate), 'dd/MM/yyyy HH:mm')}</span>
                </div>
              </div>

              {/* Patient */}
              <div className="section">
                <div className="section-title">PATIENT</div>
                <div className="info-row">
                  <span className="info-label">Name:</span>
                  <span className="info-value">{receiptData.patientName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">ID:</span>
                  <span className="info-value">{receiptData.patientId}</span>
                </div>
              </div>

              <div className="separator" />

              {/* Service */}
              <div className="section">
                <div className="section-title">SERVICE</div>
                <div className="info-row">
                  <span className="info-label">Type:</span>
                  <span className="info-value">{serviceLabelDisplay(receiptData.serviceLabel)}</span>
                </div>
                {receiptData.procedureType && (
                  <div className="info-row">
                    <span className="info-label">Procedure:</span>
                    <span className="info-value">{receiptData.procedureType}</span>
                  </div>
                )}
              </div>

              <div className="separator" />

              {/* Totals */}
              <div className="section">
                <div className="info-row" style={{ fontWeight: 'bold' }}>
                  <span className="info-label">TOTAL PAID:</span>
                  <span className="info-value">{formatCurrency(receiptData.amount)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Method:</span>
                  <span className="info-value">{receiptData.paymentMethod.toUpperCase()}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Cashier:</span>
                  <span className="info-value">{receiptData.cashier}</span>
                </div>
              </div>

              <div className="separator" />

              {/* Footer */}
              <div className="footer">
                <BranchFooterText />
                <div style={{ marginTop: '10px', fontSize: '9px' }}>
                  Computer-generated receipt
                </div>
                <div style={{ fontSize: '9px' }}>
                  Printed: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
                </div>
                {receiptData.branch?._id && (
                  <div style={{ fontSize: '9px', marginTop: '4px' }}>
                    Outlet: {receiptData.branch.code}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </RoleLayout>
  );
}
