import { useMyBranch, type Branch } from '@/hooks/useBranch';
import { LIS_LOGO_ALT, LIS_LOGO_URL } from '@/lib/branding';

/** Shared LIS logo with the current outlet's branch-specific letterhead. */
export function BranchLetterhead({
  compact = false,
  branch: suppliedBranch,
}: {
  compact?: boolean;
  branch?: Partial<Branch> | null;
}) {
  const { data: currentBranch, isLoading } = useMyBranch(!suppliedBranch);
  const branch = suppliedBranch || currentBranch;

  if (isLoading) {
    return (
      <div className="branch-letterhead" data-state="loading">
        <img className="logo logo-image" src={LIS_LOGO_URL} alt={LIS_LOGO_ALT} />
        <div className="company-name">Loading…</div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="branch-letterhead" data-state="no-branch">
        <img className="logo logo-image" src={LIS_LOGO_URL} alt={LIS_LOGO_ALT} />
        <div className="company-name">Harbour Medical Diagnostic</div>
        <div className="company-info company-info-warn">
          Branch not assigned — contact admin
        </div>
      </div>
    );
  }

  return (
    <div className="branch-letterhead" data-state="ready">
      <img className="logo logo-image" src={LIS_LOGO_URL} alt={LIS_LOGO_ALT} />
      <div className="company-name">{branch.name}</div>
      {branch.tagline && !compact && (
        <div className="company-tagline">{branch.tagline}</div>
      )}
      {branch.address && <div className="company-info">{branch.address}</div>}
      {branch.phone && <div className="company-info">Tel: {branch.phone}</div>}
      {branch.email && <div className="company-info">{branch.email}</div>}
      {!compact && branch.website && (
        <div className="company-info">{branch.website}</div>
      )}
      {!compact && branch.operatingHours && (
        <div className="company-info company-info-muted">{branch.operatingHours}</div>
      )}
    </div>
  );
}

export function BranchFooterText({ branch: suppliedBranch }: { branch?: Partial<Branch> | null } = {}) {
  const { data: currentBranch } = useMyBranch(!suppliedBranch);
  const branch = suppliedBranch || currentBranch;
  const text =
    branch?.footerText?.trim() ||
    'Thank you for choosing us! | Please keep this receipt for your records.';
  return <div className="footer-text">{text}</div>;
}

export function useBranchHeader() {
  const { data: branch, isLoading } = useMyBranch();
  return { branch: branch || null, isLoading };
}
