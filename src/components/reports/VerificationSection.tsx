import { VerificationInfo } from '../../hooks/useLabReport';

interface VerificationSectionProps {
  verificationInfo: VerificationInfo;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}

export function VerificationSection({ verificationInfo }: VerificationSectionProps) {
  const verifiedByName = verificationInfo.verifiedBy || verificationInfo.performedBy || '-';

  return (
    <div className="verification-section mt-10 mb-4 page-break-inside-avoid">
      <div className="grid grid-cols-2 gap-8 items-end">
        <div className="text-sm">
          <p className="font-semibold">Verified By:</p>
          <p className="mt-2 text-gray-800">{verifiedByName}</p>
          {verificationInfo.verifiedAt && (
            <p className="text-xs text-gray-600 mt-1">{formatDate(verificationInfo.verifiedAt)}</p>
          )}
        </div>

        <div className="text-right">
          <div className="inline-block w-56 border-b border-dotted border-gray-700 h-8"></div>
          <p className="text-sm font-semibold mt-2">Signature & Stamp</p>
        </div>
      </div>
    </div>
  );
}
