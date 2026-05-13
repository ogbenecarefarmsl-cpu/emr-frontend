import { LaboratoryInfo, ReportMetadata } from '../../hooks/useLabReport';
import { ReportTemplate } from '../../hooks/useReportTemplates';

interface ReportFooterProps {
  laboratoryInfo: LaboratoryInfo;
  reportMetadata: ReportMetadata;
  template?: ReportTemplate;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }) + ', ' + date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReportFooter({ laboratoryInfo, reportMetadata, template }: ReportFooterProps) {
  const footerSettings = template?.footerSettings;
  const footer = template?.footer;
  const colors = template?.colors;
  const styling = template?.styling;

  const showWave = footerSettings?.showWave ?? footer?.showWaveDesign ?? true;
  const primaryColor = footer?.waveColor1 || colors?.primary || styling?.primaryColor || '#1e3a8a';
  const secondaryColor = footer?.waveColor2 || colors?.secondary || styling?.secondaryColor || '#10b981';
  const disclaimerText =
    footerSettings?.disclaimerText ||
    footer?.disclaimerText ||
    'All tests conducted using calibrated, automated systems ensuring high accuracy and precision. For detailed interpretation, kindly consult your healthcare provider.';
  const footerText = footer?.footerText || 'OPEN 24/7 | ONSITE & ONLINE ACCESS | TRUSTED BY CLINICS & HOSPITALS';

  return (
    <div className="report-footer mt-4 pt-1">
      {/* Decorative wave */}
      {showWave && (
        <div className="decorative-wave mb-1">
          <svg
            viewBox="0 0 1200 100"
            className="w-full h-8"
            preserveAspectRatio="none"
          >
            <path
              d="M0,40 Q300,0 600,35 T1200,40 L1200,100 L0,100 Z"
              fill={primaryColor}
              opacity="0.9"
            />
            <path
              d="M0,60 Q300,20 600,55 T1200,60 L1200,100 L0,100 Z"
              fill={secondaryColor}
              opacity="0.95"
            />
          </svg>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 items-end">
        {footerSettings?.showDisclaimer !== false && footer?.showDisclaimer !== false ? (
          <div className="text-[10px] text-gray-700 leading-snug">
            <p className="font-semibold">Disclaimer:</p>
            <p>{disclaimerText}</p>
          </div>
        ) : (
          <div />
        )}

        <div
          className="text-right text-[10px] font-semibold tracking-wide text-white px-2 py-0.5 rounded-sm"
          style={{ backgroundColor: primaryColor }}
        >
          {footerText}
        </div>
      </div>

      <p className="generation-info text-[9px] text-gray-500 mt-1 text-right">
        Generated: {formatDateTime(reportMetadata.generatedAt)}
      </p>
    </div>
  );
}
