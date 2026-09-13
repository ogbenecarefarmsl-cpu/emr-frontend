import { Pill, FlaskConical, ClipboardList, BedDouble, Send, AlertTriangle, Check, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuickActionBarProps {
  onOpenPrescribe: () => void;
  onOpenRdt: () => void;
  onOpenLab: () => void;
  onOpenTreatmentPlan: () => void;
  onOpenAdmit: () => void;
  onOpenRefer: () => void;
  isReadOnly?: boolean;
  canWriteConsultation?: boolean;
  consultationPaymentBlocked?: boolean;
  hasAbnormalResults?: boolean;
  abnormalResultsCount?: number;
  activeOrdersCount?: number;
  treatmentPlansCount?: number;
  onOpenResultsTab?: () => void;
}

export function QuickActionBar({
  onOpenPrescribe,
  onOpenRdt,
  onOpenLab,
  onOpenTreatmentPlan,
  onOpenAdmit,
  onOpenRefer,
  isReadOnly,
  canWriteConsultation,
  consultationPaymentBlocked,
  hasAbnormalResults,
  abnormalResultsCount = 0,
  activeOrdersCount = 0,
  treatmentPlansCount = 0,
  onOpenResultsTab,
}: QuickActionBarProps) {
  const disabled = isReadOnly || !canWriteConsultation;

  return (
    <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
      {/* 1-Click Order Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenPrescribe}
          disabled={disabled}
          className="h-7.5 px-2.5 text-xs font-medium bg-white text-slate-800 border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 shadow-2xs gap-1.5 shrink-0"
        >
          <Pill className="h-3.5 w-3.5 text-blue-600" />
          <span>+ Prescribe</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenRdt}
          disabled={disabled}
          className="h-7.5 px-2.5 text-xs font-medium bg-white text-slate-800 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 shadow-2xs gap-1.5 shrink-0"
        >
          <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
          <span>+ Rapid Test</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenLab}
          disabled={disabled}
          className="h-7.5 px-2.5 text-xs font-medium bg-white text-slate-800 border-slate-300 hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-700 shadow-2xs gap-1.5 shrink-0"
        >
          <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
          <span>+ Lab Order</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenTreatmentPlan}
          disabled={disabled}
          className="h-7.5 px-2.5 text-xs font-medium bg-white text-slate-800 border-slate-300 hover:border-purple-400 hover:bg-purple-50/50 hover:text-purple-700 shadow-2xs gap-1.5 shrink-0"
        >
          <ClipboardList className="h-3.5 w-3.5 text-purple-600" />
          <span>+ Plan</span>
          {treatmentPlansCount > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] bg-purple-100 text-purple-800">
              {treatmentPlansCount}
            </Badge>
          )}
        </Button>

        <div className="h-4 w-px bg-slate-200 shrink-0 mx-0.5" />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onOpenAdmit}
          disabled={disabled}
          className="h-7.5 px-2 text-xs text-slate-700 hover:text-slate-900 gap-1 shrink-0"
        >
          <BedDouble className="h-3.5 w-3.5 text-slate-500" />
          <span>Admit</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onOpenRefer}
          disabled={disabled}
          className="h-7.5 px-2 text-xs text-slate-700 hover:text-slate-900 gap-1 shrink-0"
        >
          <Send className="h-3.5 w-3.5 text-slate-500" />
          <span>Refer</span>
        </Button>
      </div>

      {/* Right alerts & ledger summary */}
      <div className="flex items-center gap-2 shrink-0">
        {consultationPaymentBlocked && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
            <AlertTriangle className="h-3 w-3" /> Consultation Unpaid (Pay at Reception)
          </span>
        )}

        {hasAbnormalResults && onOpenResultsTab && (
          <button
            type="button"
            onClick={onOpenResultsTab}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-100/80 hover:bg-red-200/80 border border-red-300 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
          >
            <ShieldAlert className="h-3 w-3 text-red-600" />
            <span>{abnormalResultsCount} Abnormal Lab Flag{abnormalResultsCount > 1 ? 's' : ''}</span>
          </button>
        )}

        {activeOrdersCount > 0 && (
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
            {activeOrdersCount} order{activeOrdersCount !== 1 ? 's' : ''} in visit
          </span>
        )}
      </div>
    </div>
  );
}
