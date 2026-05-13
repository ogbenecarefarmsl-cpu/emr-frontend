import { PatientInfo, OrderInfo } from '../../hooks/useLabReport';
import { ReportTemplate } from '../../hooks/useReportTemplates';

interface PatientInfoSectionProps {
  patientInfo: PatientInfo;
  orderInfo: OrderInfo;
  template?: ReportTemplate;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}

export function PatientInfoSection({ patientInfo, orderInfo, template }: PatientInfoSectionProps) {
  const patientSettings = template?.patientSettings;
  const patientSection = template?.patientSection;
  const showDoctor = patientSection?.showDoctor ?? template?.patientInfo?.showDoctor ?? true;
  const showCopiesTo = patientSection?.showCopiesTo ?? true;
  const showCollected = patientSection?.showCollectionDate ?? true;
  const showReceived = patientSection?.showReceivedDate ?? true;
  const showReported = patientSection?.showReportedDate ?? true;
  const showPrinted = patientSection?.showPrintedDate ?? true;

  const primaryColor = template?.colors?.primary || template?.styling?.primaryColor || '#1e3a8a';

  const normalizedAgeUnit =
    typeof patientInfo.ageUnit === 'string' ? patientInfo.ageUnit.trim() : '';

  const patientAge = Number.isFinite(patientInfo.ageValue)
    && normalizedAgeUnit.length > 0
    ? `${patientInfo.ageValue} ${normalizedAgeUnit}`
    : '-';

  // Sanitize name fields
  function sanitizeName(value: string | undefined | null): string {
    if (!value) return '';
    const cleaned = value
      .replace(/\bundefined\b/gi, '')
      .replace(/\bnull\b/gi, '')
      .trim();
    return cleaned || '';
  }

  const orderingPhysician = sanitizeName(orderInfo.orderingPhysician);
  const copiesTo = sanitizeName((orderInfo as any).copiesTo) || sanitizeName(orderInfo.orderingPhysician);

  const printedDate = formatDate(new Date().toISOString());

  return (
    <div className="patient-info-section mb-[6px] w-full">
      <div 
        className="flex w-full pb-[2px] mb-[4px] pt-[2px]"
        style={{ borderBottom: `1.5px solid ${primaryColor}` }}
      >
        <div className="w-[38%]">
          <h3 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: primaryColor }}>Patient</h3>
        </div>
        <div className="w-[32%] text-center">
          <h3 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: primaryColor }}>Doctor</h3>
        </div>
        <div className="w-[30%] text-center">
          <h3 className="text-[12px] font-bold uppercase tracking-wide ml-8" style={{ color: primaryColor }}>Copies To</h3>
        </div>
      </div>

      <div 
        className="flex w-full text-[10px] pb-1 font-bold"
        style={{ borderBottom: `1.5px solid ${primaryColor}` }}
      >
        {/* Patient Col */}
        <div className="w-[38%] space-y-[2px]">
          {patientSettings?.showName !== false && (
            <div className="flex">
              <span className="uppercase text-[9px] w-[65px] flex-shrink-0 text-gray-600 mt-[1px]">NAME:</span> 
              <span className="font-serif text-[13px] font-normal text-black leading-tight">{patientInfo.fullName || '-'}</span>
            </div>
          )}
          {patientSettings?.showAge !== false && (
            <div className="flex">
              <span className="uppercase text-[9px] w-[65px] flex-shrink-0 text-gray-600 self-center">AGE:</span> 
              <span className="text-black">{patientAge}</span>
            </div>
          )}
          {patientSettings?.showGender !== false && (
            <div className="flex">
              <span className="uppercase text-[9px] w-[65px] flex-shrink-0 text-gray-600 self-center">GENDER:</span> 
              <span className="text-black">{patientInfo.gender || '-'}</span>
            </div>
          )}
          {patientSettings?.showPatientId !== false && (
            <div className="flex">
              <span className="uppercase text-[9px] w-[65px] flex-shrink-0 text-gray-600 self-center">ID NUMBER:</span> 
              <span className="text-black">{patientInfo.patientId?.substring(0, 8) || '-'}</span>
            </div>
          )}
        </div>

        {/* Doctor Col */}
        <div className="w-[32%] space-y-[2px] flex justify-center mt-auto">
          <div className="w-full pl-6">
            {showDoctor && (
              <div className="flex mb-2">
                <span className="uppercase text-[9px] text-gray-600 mr-2">{orderingPhysician}</span> 
              </div>
            )}
            {showCollected && (
              <div className="flex justify-between w-[150px]">
                <span className="uppercase text-[9px] text-gray-600 self-center">COLLECTED:</span> 
                <span className="text-black text-[11px] font-medium tracking-wide">{formatDate(orderInfo.collectedAt || orderInfo.orderDate)}</span>
              </div>
            )}
            {showReceived && (
              <div className="flex justify-between w-[150px]">
                <span className="uppercase text-[9px] text-gray-600 self-center">RECEIVED:</span> 
                <span className="text-black text-[11px] font-medium tracking-wide">{formatDate(orderInfo.receivedAt || orderInfo.orderDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Copies To Col */}
        <div className="w-[30%] space-y-[2px] flex justify-center mt-auto">
          <div className="w-full pl-6">
             {showCopiesTo && (
              <div className="flex mb-2">
                <span className="uppercase text-[9px] text-gray-600 mr-2">{copiesTo !== orderingPhysician ? copiesTo : ''}</span> 
              </div>
            )}
            {showReported && (
              <div className="flex justify-between w-[150px]">
                <span className="uppercase text-[9px] text-gray-600 self-center">REPORTED:</span> 
                <span className="text-black text-[11px] font-medium tracking-wide">{formatDate(orderInfo.reportedAt || orderInfo.orderDate)}</span>
              </div>
            )}
            {showPrinted && (
              <div className="flex justify-between w-[150px]">
                <span className="uppercase text-[9px] text-gray-600 self-center">PRINTED:</span> 
                <span className="text-black text-[11px] font-medium tracking-wide">{printedDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
