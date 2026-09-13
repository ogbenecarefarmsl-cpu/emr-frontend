import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoctorRdtOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRdts: { malaria: boolean; typhoid: boolean };
  onToggleRdt: (key: 'malaria' | 'typhoid', checked: boolean) => void;
  malariaPrice?: number;
  typhoidPrice?: number;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function DoctorRdtOrderModal({
  open,
  onOpenChange,
  selectedRdts,
  onToggleRdt,
  malariaPrice = 50,
  typhoidPrice = 50,
  onCancel,
  onSubmit,
  isPending,
}: DoctorRdtOrderModalProps) {
  const rdtOptions = [
    {
      key: 'malaria' as const,
      label: 'Rapid Malaria Test (RDT)',
      detail: 'HRP-2 / pLDH antigen bedside blood test',
      price: malariaPrice,
    },
    {
      key: 'typhoid' as const,
      label: 'Rapid Typhoid Test (RDT)',
      detail: 'Salmonella Typhi O/H IgM/IgG rapid test',
      price: typhoidPrice,
    },
  ];

  const hasSelection = selectedRdts.malaria || selectedRdts.typhoid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Order Rapid Diagnostic Tests</DialogTitle>
          <DialogDescription>
            Select bedside rapid tests. Patient pays at reception, then nurse performs the test.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {rdtOptions.map((rdt) => (
            <label
              key={rdt.key}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors',
                selectedRdts[rdt.key]
                  ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={selectedRdts[rdt.key]}
                onChange={(e) => onToggleRdt(rdt.key, e.target.checked)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-950">{rdt.label}</p>
                <p className="text-xs text-muted-foreground">{rdt.detail}</p>
              </div>
              <span className="text-sm font-semibold text-slate-900 shrink-0">Le {rdt.price}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !hasSelection}>
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Order Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
