import { ResultItem } from '../../hooks/useLabReport';
import { ReportTemplate } from '../../hooks/useReportTemplates';

interface ResultRowProps {
  result: ResultItem;
  template?: ReportTemplate;
  compact?: boolean;
}

export function ResultRow({ result, template, compact = false }: ResultRowProps) {
  const colors = template?.colors;
  
  const getFlagIndicator = (flag: string) => {
    if (flag === 'high' || flag === 'critical_high') return '↑';
    if (flag === 'low' || flag === 'critical_low') return '↓';
    return '';
  };

  const getFlagClass = (flag: string) => {
    if (flag === 'critical_high' || flag === 'critical_low') {
      return 'font-bold';
    }
    if (flag === 'high' || flag === 'low') {
      return '';
    }
    return 'text-black';
  };

  const getFlagColor = (flag: string) => {
    if (flag === 'critical_high' || flag === 'critical_low') {
      return colors?.critical || '#dc2626';
    }
    if (flag === 'high' || flag === 'low') {
      return colors?.abnormal || '#dc2626';
    }
    return undefined;
  };

  return (
    <tr className="border-b border-gray-200">
      <td className="py-0.5 px-3">
        <div className="font-medium text-sm">{result.testCode}</div>
        {!compact && <div className="text-xs text-gray-600">{result.testName}</div>}
        {result.isAmended && (
          <div className="text-xs text-orange-600 font-semibold mt-1">
            AMENDED
            {result.amendmentReason && (
              <span className="text-gray-600 font-normal"> - {result.amendmentReason}</span>
            )}
          </div>
        )}
      </td>
      <td 
        className={`py-0.5 px-3 ${getFlagClass(result.flag)}`}
        style={{ color: getFlagColor(result.flag) }}
      >
        <span className="font-semibold">{result.value}</span>
        {!compact && getFlagIndicator(result.flag) && (
          <span className="ml-1 text-lg">{getFlagIndicator(result.flag)}</span>
        )}
      </td>
      <td className="py-0.5 px-3 text-sm">{result.referenceRange || ''}</td>
      <td className="py-0.5 px-3 text-sm">{result.unit || ''}</td>
    </tr>
  );
}
