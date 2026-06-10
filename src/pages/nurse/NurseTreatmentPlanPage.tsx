import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TreatmentPlanBuilder } from '@/pages/shared/TreatmentPlanBuilder';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import type { TreatmentPlan } from '@/types/treatment-plan';
import { Loader2, Send, CheckCircle, Clock, FileText, Eye } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent_to_reception: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export default function NurseTreatmentPlanPage() {
  const queryClient = useQueryClient();
  const [viewPlan, setViewPlan] = useState<TreatmentPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans', 'nurse'],
    queryFn: () => treatmentPlanService.findAll(),
    staleTime: 15_000,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => treatmentPlanService.sendToReception(id),
    onSuccess: () => {
      toast.success('Treatment plan sent to reception');
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to send');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => treatmentPlanService.cancel(id),
    onSuccess: () => {
      toast.success('Treatment plan cancelled');
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      setViewPlan(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to cancel');
    },
  });

  return (
    <RoleLayout title="Treatment Plans" subtitle="Create and manage treatment plans" role="nurse">
      <div className="space-y-6">
        {/* Create form */}
        <TreatmentPlanBuilder onPlanCreated={() => queryClient.invalidateQueries({ queryKey: ['treatment-plans'] })} />

        {/* Plans list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Treatment Plans</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No treatment plans yet. Create one above.
              </div>
            ) : (
              <div className="space-y-2">
                {plans.map((plan: TreatmentPlan) => {
                  const status = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft;
                  const patient = typeof plan.patientId === 'object' ? plan.patientId : null;
                  return (
                    <div
                      key={plan._id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{plan.planNumber}</span>
                          <Badge variant="outline" className={`text-[10px] ${status.color}`}>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="text-sm mt-1">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown patient'}
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
                        {plan.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={sendMutation.isPending}
                              onClick={() => sendMutation.mutate(plan._id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(plan._id)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
                  <span className="text-sm text-muted-foreground">
                    Created by {typeof viewPlan.createdBy === 'object' ? viewPlan.createdBy.fullName : viewPlan.createdByName}
                  </span>
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

                {viewPlan.status === 'draft' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      disabled={sendMutation.isPending}
                      onClick={() => {
                        sendMutation.mutate(viewPlan._id);
                        setViewPlan(null);
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" /> Send to Reception
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(viewPlan._id)}
                    >
                      Cancel Plan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </RoleLayout>
  );
}
