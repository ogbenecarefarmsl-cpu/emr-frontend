import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { treatmentPlanService } from '@/services/treatmentPlanService';
import type { TreatmentPlan } from '@/types/treatment-plan';
import { Loader2, Pill, FlaskConical, Beaker, Scissors, FileText } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  sent_to_reception: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

const TYPE_ICONS: Record<string, any> = {
  drug: Pill,
  iv: FlaskConical,
  lab: Beaker,
  procedure: Scissors,
  other: FileText,
};

interface PatientTreatmentPlansProps {
  patientId: string;
}

export function PatientTreatmentPlans({ patientId }: PatientTreatmentPlansProps) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['treatment-plans', 'patient', patientId],
    queryFn: () => treatmentPlanService.getForPatient(patientId),
    enabled: !!patientId,
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No treatment plans for this patient.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan: TreatmentPlan) => {
        const status = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft;
        const creator = typeof plan.createdBy === 'object' ? plan.createdBy : null;
        return (
          <div key={plan._id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{plan.planNumber}</span>
                <Badge variant="outline" className={`text-[10px] ${status.color}`}>
                  {status.label}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(plan.createdAt).toLocaleDateString()}
              </span>
            </div>

            {creator && (
              <div className="text-xs text-muted-foreground">
                Created by {creator.fullName}
              </div>
            )}

            {/* Items */}
            <div className="space-y-1">
              {plan.items.map((item, idx) => {
                const Icon = TYPE_ICONS[item.type] || FileText;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm p-1.5 bg-muted/50 rounded"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{item.description}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      Le {item.amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="text-right text-sm font-medium">
              Total: Le {plan.totalAmount.toLocaleString()}
            </div>

            {plan.notes && (
              <div className="text-xs text-muted-foreground">
                <strong>Notes:</strong> {plan.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
