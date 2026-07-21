import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TreatmentPlanBuilder } from '@/pages/shared/TreatmentPlanBuilder';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import type { TreatmentPlan } from '@/types/treatment-plan';
import { LayoutDashboard, Loader2, Send, Eye, Plus, Trash2, FileText } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  sent_to_reception: { label: 'Sent', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200' },
};

export default function DoctorTreatmentPlanPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, exitDoctorMode } = useAuth();
  const [viewPlan, setViewPlan] = useState<TreatmentPlan | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [cancelConfirmPlan, setCancelConfirmPlan] = useState<TreatmentPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans', 'doctor'],
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

  const handleExitDoctorMode = async () => {
    const { error } = await exitDoctorMode();
    if (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to exit doctor mode');
      return;
    }
    toast.success('Exited doctor mode');
    navigate('/admin');
  };

  return (
    <RoleLayout
      title="Treatment Plans"
      subtitle="Create and manage treatment plans"
      role="doctor"
      doctorMode={!!user?.doctorMode}
      onExitDoctorMode={user?.doctorMode ? handleExitDoctorMode : undefined}
    >
      <div className="space-y-6">
        {/* Create button */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => navigate('/doctor')} className="gap-2">
            <LayoutDashboard className="h-4 w-4" /> Doctor Dashboard
          </Button>
          <Button onClick={() => setBuilderOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Treatment Plan
          </Button>
        </div>

        {/* Plans list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Treatment Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No treatment plans yet</p>
                <p className="text-xs">Click "New Treatment Plan" to get started.</p>
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
                              onClick={() => setCancelConfirmPlan(plan)}
                            >
                              <Trash2 className="h-4 w-4" />
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

        {/* Create dialog */}
        <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Treatment Plan</DialogTitle>
              <DialogDescription>Build a plan of drugs, IVs, labs, and procedures for the patient.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <TreatmentPlanBuilder
                onPlanCreated={() => {
                  setBuilderOpen(false);
                  queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
                }}
                inline
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* View plan dialog */}
        <Dialog open={!!viewPlan} onOpenChange={(open) => !open && setViewPlan(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{viewPlan?.planNumber}</DialogTitle>
              <DialogDescription>
                {viewPlan ? `Created by ${typeof viewPlan.createdBy === 'object' ? viewPlan.createdBy.fullName : viewPlan.createdByName}` : ''}
              </DialogDescription>
            </DialogHeader>
            {viewPlan && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[viewPlan.status]?.color || ''}`}>
                    {STATUS_CONFIG[viewPlan.status]?.label}
                  </Badge>
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
                  <DialogFooter className="gap-2">
                    <Button
                      size="sm"
                      disabled={sendMutation.isPending}
                      onClick={() => {
                        sendMutation.mutate(viewPlan._id, {
                          onSuccess: () => setViewPlan(null),
                        });
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" /> Send to Reception
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={cancelMutation.isPending}
                      onClick={() => setCancelConfirmPlan(viewPlan)}
                    >
                      Cancel Plan
                    </Button>
                  </DialogFooter>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        {/* Cancel confirmation dialog */}
        <AlertDialog open={!!cancelConfirmPlan} onOpenChange={(open) => !open && setCancelConfirmPlan(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Treatment Plan</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel plan <strong>{cancelConfirmPlan?.planNumber}</strong>? This will delete all linked prescriptions and mark orders as cancelled. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Plan</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (cancelConfirmPlan) {
                    cancelMutation.mutate(cancelConfirmPlan._id);
                    if (viewPlan?._id === cancelConfirmPlan._id) setViewPlan(null);
                    setCancelConfirmPlan(null);
                  }
                }}
              >
                Cancel Plan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleLayout>
  );
}
