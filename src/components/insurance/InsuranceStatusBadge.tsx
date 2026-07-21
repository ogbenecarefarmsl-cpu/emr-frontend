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

function memberLabel(
  insurance?: { programCode?: string; subEntityCode?: string } | null,
  compact?: boolean,
) {
  if (!insurance?.programCode) return '';
  if (compact) return insurance.programCode;
  return insurance.subEntityCode
    ? `${insurance.programCode} / ${insurance.subEntityCode}`
    : insurance.programCode;
}

export function InsuranceStatusBadge({
  insurance,
  eligibility,
  coverageType,
  patientBalance = 0,
  compact = false,
  className,
}: InsuranceStatusBadgeProps) {
  const program = memberLabel(insurance, compact);
  const hasMember = !!insurance?.programCode;

  // Co-pay / partial balance takes priority for billing surfaces
  if (patientBalance > 0) {
    return (
      <Badge variant="outline" className={cn('gap-1 border-amber-300 bg-amber-50 text-amber-800', className)}>
        <AlertTriangle className="h-3 w-3" />
        {compact
          ? `Le ${patientBalance.toLocaleString()} due`
          : `Partially covered · Le ${patientBalance.toLocaleString()} due${program ? ` · ${program}` : ''}`}
      </Badge>
    );
  }

  if (eligibility?.status === 'blocked') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-red-300 bg-red-50 text-red-700', className)}>
        <ShieldOff className="h-3 w-3" />
        {compact ? (program ? `Blocked · ${program}` : 'Blocked') : `Coverage blocked${program ? ` · ${program}` : ''}`}
      </Badge>
    );
  }

  if (eligibility?.status === 'waiting_period') {
    const date = eligibility.nextEligibleAt ? new Date(eligibility.nextEligibleAt).toLocaleDateString() : '';
    return (
      <Badge variant="outline" className={cn('gap-1 border-amber-300 bg-amber-50 text-amber-800', className)}>
        <CalendarClock className="h-3 w-3" />
        {compact
          ? (date ? `Next ${date}` : 'Waiting period')
          : `Consult self-pay until ${date || 'next window'}${program ? ` · ${program}` : ''}`}
      </Badge>
    );
  }

  // Visit already covered by insurer this encounter
  if (coverageType === 'insurance') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-emerald-300 bg-emerald-50 text-emerald-700', className)}>
        <ShieldCheck className="h-3 w-3" />
        {compact
          ? (program || 'Covered')
          : `Consultation covered${program ? ` · ${program}` : ''}`}
      </Badge>
    );
  }

  if (coverageType === 'follow_up') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-violet-300 bg-violet-50 text-violet-700', className)}>
        <ShieldCheck className="h-3 w-3" />
        {compact ? 'Follow-up' : 'Included follow-up'}
      </Badge>
    );
  }

  // Self-pay consultation but still an insurance member (labs/Rx may still bill)
  if (coverageType === 'paid' || coverageType === 'pending') {
    if (hasMember) {
      return (
        <Badge variant="outline" className={cn('gap-1 border-slate-300 bg-slate-50 text-slate-700', className)}>
          <CircleDollarSign className="h-3 w-3" />
          {compact
            ? `Self-pay · ${program}`
            : `Self-pay consult · member ${program}`}
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
  }

  // Pre-visit eligibility (registration)
  if (eligibility?.status === 'eligible') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-emerald-300 bg-emerald-50 text-emerald-700', className)}>
        <ShieldCheck className="h-3 w-3" />
        {compact
          ? (program || 'Eligible')
          : `Insurance eligible${program ? ` · ${program}` : ''}`}
      </Badge>
    );
  }

  if (!hasMember) return null;

  // Membership only (no coverage/eligibility context)
  return (
    <Badge variant="outline" className={cn('gap-1 border-blue-200 bg-blue-50 text-blue-700', className)}>
      <ShieldCheck className="h-3 w-3" />
      {compact ? program : `Insurance member · ${program}`}
    </Badge>
  );
}
