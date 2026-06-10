import { useMyBranch } from '@/hooks/useBranch';

/**
 * BranchLetterhead
 *
 * Renders the receipt header (logo, branch name, address, phone, email,
 * tagline, website, operating hours) from the current user's branch.
 *
 * Used by every thermal receipt HTML view. The byte-level ESC/POS path
 * uses escpos.buildBranchHeaderESCPOS() (same data, different renderer).
 *
 * If the user has no branch assigned, falls back to a generic placeholder
 * so the receipt still prints.
 */
export function BranchLetterhead({ compact = false }: { compact?: boolean }) {
  const { data: branch, isLoading } = useMyBranch();

  if (isLoading) {
    return (
      <div className="branch-letterhead" data-state="loading">
        <div className="logo">🏥</div>
        <div className="company-name">Loading…</div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="branch-letterhead" data-state="no-branch">
        <div className="logo">🏥</div>
        <div className="company-name">Harbour Medical Diagnostic</div>
        <div className="company-info company-info-warn">
          ⚠ Branch not assigned — contact admin
        </div>
      </div>
    );
  }

  return (
    <div className="branch-letterhead" data-state="ready">
      {branch.logoUrl ? (
        <img className="logo logo-image" src={branch.logoUrl} alt="Logo" />
      ) : (
        <div className="logo">🏥</div>
      )}
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

/**
 * BranchFooterText
 *
 * Renders the receipt footer (thank-you message, hours, etc.) from
 * the current branch's settings. Falls back to a generic message.
 */
export function BranchFooterText() {
  const { data: branch } = useMyBranch();
  const text =
    branch?.footerText?.trim() ||
    'Thank you for choosing us! | Please keep this receipt for your records.';
  return <div className="footer-text">{text}</div>;
}

/**
 * Plain-data access for non-React code (e.g. ESC/POS byte builder).
 * Same source of truth as the React component above — pulls from the
 * cached React Query key.
 *
 * Returns null if the branch is still loading or the user has no branch.
 * Callers that need a non-null fallback should use escpos.buildBranchHeaderESCPOS
 * which uses a generic placeholder.
 */
export function useBranchHeader() {
  const { data: branch, isLoading } = useMyBranch();
  return { branch: branch || null, isLoading };
}
