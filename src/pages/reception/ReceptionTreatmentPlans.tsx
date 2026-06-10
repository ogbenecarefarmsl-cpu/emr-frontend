import { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { useMyBranch } from '@/hooks/useBranch';
import { buildTreatmentPlanESCPOS } from '@/utils/escpos';
import { usbPrinterService } from '@/services/usbPrinterService';
import type { TreatmentPlan } from '@/types/treatment-plan';
import { Printer, Check, Eye, Loader2, Send, Clock } from 'lucide-react';
import { TreatmentPlanReceipt, treatmentPlanPrintStyles } from '@/components/receipts/TreatmentPlanReceipt';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent_to_reception: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export default function ReceptionTreatmentPlans() {
  const queryClient = useQueryClient();
  const { data: branch } = useMyBranch();
  const { printReceipt } = useThermalPrint();
  const [viewPlan, setViewPlan] = useState<TreatmentPlan | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans', 'reception'],
    queryFn: () => treatmentPlanService.findAll(),
    staleTime: 10_000,
  });

  const markPrintedMutation = useMutation({
    mutationFn: (id: string) => treatmentPlanService.markPrinted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
    },
  });

  const handlePrint = async (plan: TreatmentPlan) => {
    setIsPrinting(true);
    try {
      // Try ESC/POS first
      if (usbPrinterService.isConnected) {
        const patient = typeof plan.patientId === 'object' ? plan.patientId : null;
        const visit = typeof plan.visitId === 'object' ? plan.visitId : null;
        const bytes = buildTreatmentPlanESCPOS(
          {
            planNumber: plan.planNumber,
            patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
            patientId: patient?.patientId || '',
            patientAge: patient?.age?.toString(),
            patientGender: patient?.gender,
            patientPhone: patient?.phone,
            visitNumber: visit?.visitNumber,
            items: plan.items.map((i) => ({ type: i.type, description: i.description, amount: i.amount })),
            totalAmount: plan.totalAmount,
            notes: plan.notes,
          },
          branch
        );
        await usbPrinterService.print(bytes);
        markPrintedMutation.mutate(plan._id);
        toast.success('Treatment plan printed');
        setViewPlan(null);
        return;
      }

      // Browser fallback
      await printReceipt(receiptRef.current, {
        title: `Treatment Plan ${plan.planNumber}`,
        onSuccess: () => {
          markPrintedMutation.mutate(plan._id);
          setViewPlan(null);
        },
      });
    } catch (err: any) {
      toast.error(`Print failed: ${err.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  // Sent plans (waiting for reception)
  const sentPlans = useMemo(
    () => plans.filter((p: TreatmentPlan) => p.status === 'sent_to_reception'),
    [plans]
  );
  const otherPlans = useMemo(
    () => plans.filter((p: TreatmentPlan) => p.status !== 'sent_to_reception'),
    [plans]
  );

  return (
    <RoleLayout title="Treatment Plans" subtitle="View and print treatment plans" role="receptionist">
      <div className="space-y-6">
        {/* Sent plans queue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Pending Treatment Plans
              {sentPlans.length > 0 && (
                <Badge className="bg-blue-100 text-blue-700">{sentPlans.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentPlans.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No pending treatment plans
              </div>
            ) : (
              <div className="space-y-2">
                {sentPlans.map((plan: TreatmentPlan) => {
                  const patient = typeof plan.patientId === 'object' ? plan.patientId : null;
                  const creator = typeof plan.createdBy === 'object' ? plan.createdBy : null;
                  return (
                    <div
                      key={plan._id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{plan.planNumber}</span>
                          <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700">
                            PENDING
                          </Badge>
                        </div>
                        <div className="text-sm mt-1">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {plan.items.length} items — Le {plan.totalAmount.toLocaleString()}
                          {creator && ` — by ${creator.fullName}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewPlan(plan)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        <Button
                          size="sm"
                          disabled={isPrinting}
                          onClick={() => handlePrint(plan)}
                        >
                          {isPrinting ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4 mr-1" />
                          )}
                          Print
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Other plans */}
        {otherPlans.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Treatment Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {otherPlans.map((plan: TreatmentPlan) => {
                  const status = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft;
                  const patient = typeof plan.patientId === 'object' ? plan.patientId : null;
                  return (
                    <div
                      key={plan._id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{plan.planNumber}</span>
                          <Badge variant="outline" className={`text-[10px] ${status.color}`}>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="text-sm mt-1">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {plan.items.length} items — Le {plan.totalAmount.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewPlan(plan)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(plan.status === 'sent_to_reception' || plan.status === 'paid') && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isPrinting}
                            onClick={() => handlePrint(plan)}
                          >
                            <Printer className="h-4 w-4 mr-1" /> Print
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hidden receipt for browser print fallback */}
        {viewPlan && (
          <>
            <style>{treatmentPlanPrintStyles}</style>
            <div
              ref={receiptRef}
              className="receipt bg-white p-4 rounded shadow mx-auto"
              style={{ maxWidth: '58mm' }}
            >
              <TreatmentPlanReceipt plan={viewPlan} />
            </div>
          </>
        )}

        {/* View plan dialog */}
        {viewPlan && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{viewPlan.planNumber}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setViewPlan(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_CONFIG[viewPlan.status]?.color}>
                    {STATUS_CONFIG[viewPlan.status]?.label}
                  </Badge>
                  {typeof viewPlan.createdBy === 'object' && (
                    <span className="text-sm text-muted-foreground">
                      by {viewPlan.createdBy.fullName}
                    </span>
                  )}
                </div>

                {typeof viewPlan.patientId === 'object' && (
                  <div className="text-sm">
                    Patient: {viewPlan.patientId.firstName} {viewPlan.patientId.lastName} ({viewPlan.patientId.patientId})
                  </div>
                )}

                <div className="space-y-1">
                  {viewPlan.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span>
                        <Badge variant="outline" className="text-[10px] mr-1">{item.type.toUpperCase()}</Badge>
                        {item.description}
                      </span>
                      <span>Le {item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="text-right font-semibold">
                  Total: Le {viewPlan.totalAmount.toLocaleString()}
                </div>

                {viewPlan.notes && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Notes:</strong> {viewPlan.notes}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    disabled={isPrinting}
                    onClick={() => handlePrint(viewPlan)}
                  >
                    {isPrinting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4 mr-1" />
                    )}
                    Print Treatment Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </RoleLayout>
  );
}
