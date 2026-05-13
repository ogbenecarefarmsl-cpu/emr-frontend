import { LaboratoryInfo } from '../../hooks/useLabReport';

interface ReportHeaderProps {
  laboratoryInfo: LaboratoryInfo;
}

export function ReportHeader({ laboratoryInfo }: ReportHeaderProps) {
  const primaryColor = '#1e3a8a';
  const secondaryColor = '#16a34a';
  const showLogo = true;

  // Keep logo code-driven with an optional env override and no template/database dependency.
  // Use the resized logo from public folder
  const hardcodedLogoUrl = import.meta.env.VITE_REPORT_HEADER_LOGO || '/logo_resized.png';
  const logoSrc = hardcodedLogoUrl;

  const defaultLabName = 'HARBOUR Medical Diagnostic';
  const defaultMotto = 'Automated Precision...';
  const defaultAddress = '114, Fourah Bay Road, Freetown, Sierra leone';
  const defaultPhone = '+23274414434';
  const defaultEmail = 'harbourmedicaldiagnostics@gmail.com';

  const labName = defaultLabName;
  const motto = defaultMotto;
  const address = defaultAddress;
  const phone = defaultPhone;
  const email = defaultEmail;

  // Attempt to split the first word from the rest for dynamic styling
  const labNameTrimmed = labName.trim();
  const firstSpaceIndex = labNameTrimmed.indexOf(' ');
  const firstWord = firstSpaceIndex > -1 ? labNameTrimmed.substring(0, firstSpaceIndex) : labNameTrimmed;
  const restWords = firstSpaceIndex > -1 ? labNameTrimmed.substring(firstSpaceIndex + 1) : '';
  const showLabName = true;
  const showAddress = true;

  return (
    <div className="report-header w-full pb-1">
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Left Side: Logo + Lab Name */}
        <div className="flex items-center gap-4 min-w-0">
          {showLogo && logoSrc && (
            <div className="flex items-center justify-start">
              <img
                src={logoSrc}
                alt="Laboratory Logo"
                className="h-[76px] w-auto object-contain"
              />
            </div>
          )}

          {!showLogo && showLabName && (
            <div className="flex flex-col justify-center leading-tight">
              <span
                className="font-bold tracking-wide uppercase"
                style={{ color: primaryColor, fontSize: '28px', lineHeight: '1.1' }}
              >
                {firstWord}
              </span>
              {restWords && (
                <span
                  className="font-medium"
                  style={{ color: secondaryColor, fontSize: '18px', lineHeight: '1.1' }}
                >
                  {restWords}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Contact Info */}
        <div
          className="flex flex-col items-end text-[11px] leading-[1.3] text-right shrink-0 max-w-[340px]"
          style={{ color: primaryColor }}
        >
          {phone && <span className="font-semibold tracking-[0.1px]">{phone}</span>}
          {email && <span className="font-medium">{email}</span>}
          {showAddress && address && <span className="font-medium">{address}</span>}
        </div>
      </div>

      {/* Accent Divider */}
      <div className="relative w-full h-[4px] mt-[8px]">
        <div className="absolute inset-0" style={{ backgroundColor: secondaryColor }} />
        <div className="absolute right-0 top-0 h-full w-[33%]" style={{ backgroundColor: primaryColor }} />
      </div>

      {/* Motto */}
      <div className="w-full text-left mt-[3px]">
        {motto && (
          <span
            className="italic text-[11px] font-semibold"
            style={{ color: primaryColor }}
          >
            {motto.toLowerCase().startsWith('motto') ? motto : `Motto: ${motto}`}
          </span>
        )}
      </div>
    </div>
  );
}
