import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, CalendarClock, CircleDollarSign, ShieldCheck, ShieldOff } from 'lucide-react';
import type { InsuranceEligibility } from '@/hooks/useVisits';

type InsuranceStatusBadgeProps = {
  insurance?: {
    programCode?: string;
    subEntityCode?: string;
  } | null;
  eligibility?: InsuranceEligibility | null;
  coverageType?: 'pending' | 'paid' | 'follow_up' | 'insurance' | string;
  patientBalance?: number;
  compact?: boolean;
  className?: string;
};

export function InsuranceStatusBadge({
  insurance,
  eligibility,
  coverageType,
  patientBalance = 0,
  compact = false,
  className,
}: InsuranceStatusBadgeProps) {
  if (patientBalance > 0) {
    return (
      <Badge variant="outline" className={cn('gap-1 border-amber-300 bg-amber-50 text-amber-800', className)}>
        <AlertTriangle className="h-3 w-3" />
        {compact ? `Le ${patientBalance.toLocaleString()} due` : `Partially covered · Le ${patientBalance.toLocaleString()} due`}
      </Badge>
    );
  }

  if (coverageType === 'paid') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-slate-300 bg-slate-50 text-slate-700', className)}>
        <CircleDollarSign className="h-3 w-3" /> Self-pay visit
      </Badge>
    );
  }

  if (coverageType === 'follow_up') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-violet-300 bg-violet-50 text-violet-700', className)}>
        <ShieldCheck className="h-3 w-3" /> Included follow-up
      </Badge>
    );
  }

  if (eligibility?.status === 'blocked') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-red-300 bg-red-50 text-red-700', className)}>
        <ShieldOff className="h-3 w-3" /> Coverage blocked
      </Badge>
    );
  }

  if (eligibility?.status === 'waiting_period') {
    const date = eligibility.nextEligibleAt ? new Date(eligibility.nextEligibleAt).toLocaleDateString() : '';
    return (
      <Badge variant="outline" className={cn('gap-1 border-amber-300 bg-amber-50 text-amber-800', className)}>
        <CalendarClock className="h-3 w-3" /> {compact ? `Eligible ${date}` : `Insurance eligible on ${date}`}
      </Badge>
    );
  }

  if (eligibility?.status === 'eligible' || coverageType === 'insurance') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-emerald-300 bg-emerald-50 text-emerald-700', className)}>
        <ShieldCheck className="h-3 w-3" /> {compact ? 'Insurance eligible' : 'Insurance eligible now'}
      </Badge>
    );
  }

  if (!insurance?.programCode) return null;

  return (
    <Badge variant="outline" className={cn('gap-1 border-blue-200 bg-blue-50 text-blue-700', className)}>
      <ShieldCheck className="h-3 w-3" />
      {compact ? insurance.programCode : `Insurance member · ${insurance.programCode}`}
      {!compact && insurance.subEntityCode ? ` / ${insurance.subEntityCode}` : ''}
    </Badge>
  );
}
