import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import { TreatmentPlanBuilder } from '@/pages/shared/TreatmentPlanBuilder';
import { Loader2, Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface TreatmentPlanItem {
  type: string;
  description: string;
  amount: number;
}

interface TreatmentPlan {
  _id: string;
  planNumber: string;
  status: string;
  createdByName: string;
  createdByRole: string;
  items: TreatmentPlanItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

interface DoctorTreatmentPlanCardProps {
  visitId?: string;
  patientId?: string;
  patientName?: string;
  canEdit?: boolean;
}

const statusColor: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent_to_reception: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

export function DoctorTreatmentPlanCard({ visitId, patientId, patientName, canEdit }: DoctorTreatmentPlanCardProps) {
  const queryClient = useQueryClient();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TreatmentPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans', visitId ? 'visit' : 'patient', visitId || patientId],
    queryFn: () => visitId
      ? treatmentPlanService.getForVisit(visitId)
      : treatmentPlanService.getForPatient(patientId!),
    enabled: !!(visitId || patientId),
  });

  const cancelPlan = useMutation({
    mutationFn: (id: string) => treatmentPlanService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
    },
  });

  const handleEdit = (plan: TreatmentPlan) => {
    setEditingPlan(plan);
    setBuilderOpen(true);
  };

  const handleBuilderCreated = async () => {
    // If editing a draft plan, cancel the old one after the new one is created
    if (editingPlan?.status === 'draft') {
      try {
        await cancelPlan.mutateAsync(editingPlan._id);
      } catch {
        // Non-blocking: old plan may already be sent
      }
    }
    setBuilderOpen(false);
    setEditingPlan(null);
    queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
    queryClient.invalidateQueries({ queryKey: ['visits'] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading treatment plans…
        </CardContent>
      </Card>
    );
  }

  const sorted = [...plans].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Treatment Plans
            </span>
            {canEdit && (
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditingPlan(null); setBuilderOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> New Plan
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No treatment plans yet.</p>
          ) : (
            sorted.map((plan: any) => (
              <div key={plan._id} className="border rounded-lg p-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{plan.planNumber}</p>
                    <p className="text-[10px] text-muted-foreground">By {plan.createdByName} ({plan.createdByRole}) · {new Date(plan.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={cn("text-[9px] h-5", statusColor[plan.status] || '')}>
                      {plan.status}
                    </Badge>
                    {canEdit && plan.status === 'draft' && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(plan)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {(plan.items || []).map((item: TreatmentPlanItem, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate">{item.description}</span>
                      <span className="text-muted-foreground shrink-0">Le {item.amount?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {plan.notes && <p className="text-[10px] text-muted-foreground mt-2 italic">{plan.notes}</p>}
                <p className="text-xs font-medium mt-2">Total: Le {plan.totalAmount?.toLocaleString()}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Treatment Plan' : 'Create Treatment Plan'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <TreatmentPlanBuilder
              preselectedVisitId={visitId}
              preselectedPatientId={!visitId ? patientId : undefined}
              preselectedPatientName={!visitId ? patientName : undefined}
              onPlanCreated={handleBuilderCreated}
              inline
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
