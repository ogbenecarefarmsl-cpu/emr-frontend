import { Fragment } from 'react';
import { PageCategory } from './SmartPaginatedReport';
import { ReportTemplate } from '../../hooks/useReportTemplates';

/** Parse pipe-delimited stool microscopy values like "Color:Brown|Appearance:Formed|Mucus:Nil" */
function parseStoolValue(value: string): { label: string; val: string }[] | null {
  if (!value || !value.includes(':')) return null;
  const parts = value.split('|').map(p => p.trim()).filter(Boolean);
  const pairs = parts.map(p => {
    const idx = p.indexOf(':');
    return idx > 0 ? { label: p.slice(0, idx).trim(), val: p.slice(idx + 1).trim() } : null;
  }).filter(Boolean) as { label: string; val: string }[];
  return pairs.length >= 2 ? pairs : null;
}

interface PaginatedCategorySectionProps {
  pageCategory: PageCategory;
  template?: ReportTemplate;
}

/**
 * Renders a category section for a single page
 * Handles continuation markers and panel grouping
 */
export function PaginatedCategorySection({ pageCategory, template }: PaginatedCategorySectionProps) {
  const colors = template?.colors;
  const resultsSection = template?.resultsSection;

  const primaryColor = colors?.primary || template?.styling?.primaryColor || '#1e3a8a';
  // Always use a strong red for category headings regardless of template setting
  const categoryHeadingColor = '#dc2626';
  const tableHeaderBg = resultsSection?.tableHeaderColor || colors?.secondary || '#f3f4f6';

  // Determine if this category uses special layouts.
  // serology → 3 cols: Test | Result | Interpretation (Non-Reactive/Reactive interpretation from comments)
  // urinalysis/microbiology → 3 cols: Test | Result | Range (reference range only, no unit col)
  // immunoassay/chemistry/hematology → 4 cols: Test | Result | Range | Unit
  const isSerologyLayout = pageCategory.category === 'serology';
  const isRangeOnlyLayout = pageCategory.category === 'microbiology' || pageCategory.category === 'urinalysis';
  const useThreeColumns = isSerologyLayout || isRangeOnlyLayout;
  const thirdColumnLabel = isSerologyLayout ? 'Interpretation' : 'Range';

  // Shared header cell styles for consistency
  const headerCellClass = "text-left py-1.5 px-3 font-semibold uppercase tracking-wide text-[11px]";

  return (
    <div className="category-section mb-4">
      {/* Category title */}
      <h3
        className="text-[20px] font-extrabold uppercase tracking-[0.08em] text-center mb-1 py-1 border-y"
        style={{
          color: categoryHeadingColor,
          fontWeight: 900,
          borderColor: '#fecaca',
          background: 'linear-gradient(90deg, #fff1f2 0%, #ffffff 45%, #fff1f2 100%)',
        }}
      >
        {pageCategory.categoryDisplayName}
      </h3>

      {/* Render each panel */}
      {pageCategory.panels.map((panel, panelIndex) => {
        const panelTitle = panel.panelName || panel.panelCode;
        const showPanelHeader = Boolean(panelTitle);

        // Check if tests have subcategories (e.g., urinalysis)
        const hasSubcategories = panel.results.some(r => r.subcategory);
        
        // Group results by subcategory if they exist
        const subcategoryMap = new Map<string, typeof panel.results>();
        if (hasSubcategories) {
          for (const result of panel.results) {
            const subcategory = result.subcategory || 'Other';
            if (!subcategoryMap.has(subcategory)) {
              subcategoryMap.set(subcategory, []);
            }
            subcategoryMap.get(subcategory)!.push(result);
          }
        }

        return (
          <Fragment key={`panel-${panelIndex}`}>
            <table className="results-table w-full border-collapse text-sm mb-3">
              <colgroup>
                {useThreeColumns ? (
                  <>
                    <col style={{ width: '56%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '22%' }} />
                  </>
                ) : (
                  <>
                    <col style={{ width: '52%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '12%' }} />
                  </>
                )}
              </colgroup>
              <thead>
                {/* Panel name row - show if there's a specific panel */}
                {showPanelHeader && (
                  <tr>
                    <th
                      colSpan={useThreeColumns ? 3 : 4}
                      className="text-left py-1.5 px-3 font-bold uppercase text-[12px] border-b border-solid"
                      style={{
                        background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 75%)',
                        borderColor: '#dbe2ea',
                        color: primaryColor,
                      }}
                    >
                      {panelTitle}
                    </th>
                  </tr>
                )}
                {/* Table header row — all columns get the same background */}
                <tr className="border-y border-solid" style={{ borderColor: '#cfd8e3' }}>
                  <th
                    className={headerCellClass}
                    style={{ backgroundColor: tableHeaderBg, color: primaryColor }}
                  >
                    Test
                  </th>
                  <th
                    className={headerCellClass}
                    style={{ backgroundColor: tableHeaderBg, color: primaryColor }}
                  >
                    Result
                  </th>
                  <th
                    className={headerCellClass}
                    style={{ backgroundColor: tableHeaderBg, color: primaryColor }}
                  >
                    {useThreeColumns ? thirdColumnLabel : 'Range'}
                  </th>
                  {!useThreeColumns && (
                    <th
                      className={headerCellClass}
                      style={{ backgroundColor: tableHeaderBg, color: primaryColor }}
                    >
                      Unit
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {hasSubcategories ? (
                  // Render results grouped by subcategory
                  <>
                    {Array.from(subcategoryMap.entries()).map(([subcategory, results], subIndex) => (
                      <Fragment key={`subcategory-${subIndex}`}>
                        {/* Subcategory header row */}
                        <tr>
                          <td
                            colSpan={useThreeColumns ? 3 : 4}
                            className="py-1 px-3 font-semibold uppercase text-xs bg-gray-50 border-y border-gray-300"
                            style={{ color: primaryColor }}
                          >
                            {subcategory}
                          </td>
                        </tr>
                        {/* Results for this subcategory */}
                        {results.map((result, resultIndex) => {
                          const firstColumnValue = result.testName || result.testCode;
                          // Exclude WBC comments from third column (FBC panel messages shown as panel footer instead)
                          const thirdColumnValue = isSerologyLayout
                            ? (result.testCode !== 'WBC' ? (result.comments || result.referenceRange || '-') : (result.referenceRange || '-'))
                            : (result.referenceRange || '-');

                          // Check if this is a hormone test with multiple ranges
                          const hasMultipleRanges = result.allReferenceRanges && 
                            (() => {
                              try {
                                const ranges = typeof result.allReferenceRanges === 'string' 
                                  ? JSON.parse(result.allReferenceRanges) 
                                  : result.allReferenceRanges;
                                return Array.isArray(ranges) && ranges.length > 1;
                              } catch {
                                return false;
                              }
                            })();

                          const stoolFields = parseStoolValue(result.value || '');

                          return (
                            <Fragment key={`result-${resultIndex}`}>
                              {stoolFields ? (
                                // Stool microscopy — expand into individual field rows
                                <>
                                  <tr className="result-row border-b border-solid" style={{ borderColor: '#e2e8f0', backgroundColor: '#f0fdf4' }}>
                                    <td colSpan={useThreeColumns ? 3 : 4} className="py-1 px-3 font-bold text-[12px] uppercase tracking-wide" style={{ color: primaryColor }}>
                                      {firstColumnValue}
                                    </td>
                                  </tr>
                                  {stoolFields.map((field, fi) => (
                                    <tr key={fi} className="border-b border-solid" style={{ borderColor: '#e2e8f0', backgroundColor: fi % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                      <td className="py-1 px-3 pl-6 text-[13px] text-slate-600">{field.label}</td>
                                      <td className="py-1 px-3 font-semibold text-[13px]" colSpan={useThreeColumns ? 2 : 3}>{field.val || '—'}</td>
                                    </tr>
                                  ))}
                                </>
                              ) : (
                              <tr
                                key={`result-${resultIndex}`}
                                className="result-row border-b border-solid"
                                style={{
                                  borderColor: '#e2e8f0',
                                  backgroundColor: resultIndex % 2 === 0 ? '#f8fafc' : '#ffffff',
                                  borderLeft:
                                    result.flag === 'critical_high' || result.flag === 'critical_low'
                                      ? `2px solid ${resultsSection?.criticalColor || colors?.critical || '#dc2626'}`
                                      : result.flag === 'high' || result.flag === 'low'
                                        ? `2px solid ${resultsSection?.abnormalColor || colors?.abnormal || '#dc2626'}`
                                        : '2px solid transparent',
                                }}
                              >
                                <td className="py-1 px-3 font-semibold text-[13px]">{firstColumnValue}</td>
                                <td
                                  className="py-1 px-3 font-bold whitespace-nowrap text-[13px]"
                                  style={{
                                    color:
                                      result.flag === 'critical_high' || result.flag === 'critical_low'
                                        ? (resultsSection?.criticalColor || colors?.critical || '#dc2626')
                                        : result.flag === 'high' || result.flag === 'low'
                                          ? (resultsSection?.abnormalColor || colors?.abnormal || '#dc2626')
                                          : undefined,
                                  }}
                                >
                                  <span>
                                    {result.value}
                                    {(result.flag === 'high' || result.flag === 'critical_high') && (
                                      <span style={{ marginLeft: '4px', fontSize: '0.85em' }}>&#x2191;</span>
                                    )}
                                    {(result.flag === 'low' || result.flag === 'critical_low') && (
                                      <span style={{ marginLeft: '4px', fontSize: '0.85em' }}>&#x2193;</span>
                                    )}
                                  </span>
                                  {/* Show interpretation subtitle for immunoassay/chemistry tests - exclude WBC in FBC panels (shown as panel footer instead) */}
                                  {!isSerologyLayout && result.comments && result.testCode !== 'WBC' && (
                                    <div
                                      className="text-[10px] font-normal mt-0.5"
                                      style={{
                                        color:
                                          result.flag === 'high' || result.flag === 'critical_high' || result.flag === 'low' || result.flag === 'critical_low'
                                            ? (resultsSection?.abnormalColor || colors?.abnormal || '#dc2626')
                                            : '#64748b',
                                      }}
                                    >
                                      {result.comments}
                                    </div>
                                  )}
                                </td>
                                <td className="py-1 px-3 text-[12px] text-slate-700">
                                  {typeof thirdColumnValue === 'string' ? thirdColumnValue.replace(/(\d)-(\d)/g, '$1 – $2') : thirdColumnValue}
                                </td>
                                {!useThreeColumns && (
                                  <td className="py-1 px-3 text-[12px] text-slate-600">{result.unit || '-'}</td>
                                )}
                              </tr>
                              )}
                              {/* Show all reference ranges for hormone tests */}
                              {hasMultipleRanges && (
                                <tr className="border-b border-solid" style={{ borderColor: '#e2e8f0', backgroundColor: resultIndex % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                  <td colSpan={useThreeColumns ? 3 : 4} className="py-1 px-3">
                                    <div className="text-[10px] text-slate-600 pl-4 border-l-2 border-primary/30">
                                      <span className="font-semibold">All Reference Ranges: </span>
                                      {(() => {
                                        try {
                                          const ranges = typeof result.allReferenceRanges === 'string' 
                                            ? JSON.parse(result.allReferenceRanges) 
                                            : result.allReferenceRanges;
                                          return ranges.map((r: any, i: number) => (
                                            <span key={i}>
                                              {i > 0 && ' | '}
                                              <span className={result.menstrualPhase && (r.ageGroup || '').toLowerCase().includes(result.menstrualPhase) ? 'font-bold text-primary' : ''}>
                                                {r.ageGroup}: {r.range} {r.unit}
                                              </span>
                                            </span>
                                          ));
                                        } catch {
                                          return null;
                                        }
                                      })()}
                                      {result.menstrualPhase && (
                                        <span className="italic text-primary ml-2">
                                          (Flagged based on {result.menstrualPhase} phase)
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    ))}
                  </>
                ) : (
                  // Render results without subcategory grouping
                  (() => {
                    const ELEC_ORDER = ['K', 'NA', 'CL', 'ICA', 'NCA', 'TCA', 'TCO2', 'PH'];
                    const orderedResults = panel.panelCode === 'ELEC'
                      ? [...panel.results].sort((a, b) => {
                          const ia = ELEC_ORDER.indexOf((a.testCode || '').toUpperCase());
                          const ib = ELEC_ORDER.indexOf((b.testCode || '').toUpperCase());
                          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                        })
                      : panel.results;
                    return orderedResults.map((result, resultIndex) => {
                      const firstColumnValue = result.testName || result.testCode;
                    // Exclude WBC comments from third column (FBC panel messages shown as panel footer instead)
                    const thirdColumnValue = isSerologyLayout
                      ? (result.testCode !== 'WBC' ? (result.comments || result.referenceRange || '-') : (result.referenceRange || '-'))
                      : (result.referenceRange || '-');

                    // Check if this is a hormone test with multiple ranges
                    const hasMultipleRanges = result.allReferenceRanges && 
                      (() => {
                        try {
                          const ranges = typeof result.allReferenceRanges === 'string' 
                            ? JSON.parse(result.allReferenceRanges) 
                            : result.allReferenceRanges;
                          return Array.isArray(ranges) && ranges.length > 1;
                        } catch {
                          return false;
                        }
                      })();

                    const stoolFields = parseStoolValue(result.value || '');

                    return (
                      <Fragment key={`result-${resultIndex}`}>
                        {stoolFields ? (
                          // Stool microscopy — expand into individual field rows
                          <>
                            <tr className="result-row border-b border-solid" style={{ borderColor: '#e2e8f0', backgroundColor: '#f0fdf4' }}>
                              <td colSpan={useThreeColumns ? 3 : 4} className="py-1 px-3 font-bold text-[12px] uppercase tracking-wide" style={{ color: primaryColor }}>
                                {firstColumnValue}
                              </td>
                            </tr>
                            {stoolFields.map((field, fi) => (
                              <tr key={fi} className="border-b border-solid" style={{ borderColor: '#e2e8f0', backgroundColor: fi % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                                <td className="py-1 px-3 pl-6 text-[13px] text-slate-600">{field.label}</td>
                                <td className="py-1 px-3 font-semibold text-[13px]" colSpan={useThreeColumns ? 2 : 3}>{field.val || '—'}</td>
                              </tr>
                            ))}
                          </>
                        ) : (
                        <tr
                          key={`result-${resultIndex}`}
                          className="result-row border-b border-solid"
                          style={{
                            borderColor: '#e2e8f0',
                            backgroundColor: resultIndex % 2 === 0 ? '#f8fafc' : '#ffffff',
                            borderLeft:
                              result.flag === 'critical_high' || result.flag === 'critical_low'
                                ? `2px solid ${resultsSection?.criticalColor || colors?.critical || '#dc2626'}`
                                : result.flag === 'high' || result.flag === 'low'
                                  ? `2px solid ${resultsSection?.abnormalColor || colors?.abnormal || '#dc2626'}`
                                  : '2px solid transparent',
                          }}
                        >
                          <td className="py-1 px-3 font-semibold text-[13px]">{firstColumnValue}</td>
                          <td
                            className="py-1 px-3 font-bold whitespace-nowrap text-[13px]"
                            style={{
                              color:
                                result.flag === 'critical_high' || result.flag === 'critical_low'
                                  ? (resultsSection?.criticalColor || colors?.critical || '#dc2626')
                                  : result.flag === 'high' || result.flag === 'low'
                                    ? (resultsSection?.abnormalColor || colors?.abnormal || '#dc2626')
                                    : undefined,
                            }}
                          >
                            <span>
                              {result.value}
                              {(result.flag === 'high' || result.flag === 'critical_high') && (
                                <span style={{ marginLeft: '4px', fontSize: '0.85em' }}>&#x2191;</span>
                              )}
                              {(result.flag === 'low' || result.flag === 'critical_low') && (
                                <span style={{ marginLeft: '4px', fontSize: '0.85em' }}>&#x2193;</span>
                              )}
                            </span>
                            {/* Show interpretation subtitle for immunoassay/chemistry tests - exclude WBC in FBC panels (shown as panel footer instead) */}
                            {!isSerologyLayout && result.comments && result.testCode !== 'WBC' && (
                              <div
                                className="text-[10px] font-normal mt-0.5"
                                style={{
                                  color:
                                    result.flag === 'high' || result.flag === 'critical_high' || result.flag === 'low' || result.flag === 'critical_low'
                                      ? (resultsSection?.abnormalColor || colors?.abnormal || '#dc2626')
                                      : '#64748b',
                                }}
                              >
                                {result.comments}
                              </div>
                            )}
                          </td>
                          <td className="py-1 px-3 text-[12px] text-slate-700">
                            {typeof thirdColumnValue === 'string' ? thirdColumnValue.replace(/(\d)-(\d)/g, '$1 – $2') : thirdColumnValue}
                          </td>
                          {!useThreeColumns && (
                            <td className="py-1 px-3 text-[12px] text-slate-600">{result.unit || '-'}</td>
                          )}
                        </tr>
                        )}
                        {/* Show all reference ranges for hormone tests */}
                        {hasMultipleRanges && (
                          <tr className="border-b border-solid" style={{ borderColor: '#e2e8f0', backgroundColor: resultIndex % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                            <td colSpan={useThreeColumns ? 3 : 4} className="py-1 px-3">
                              <div className="text-[10px] text-slate-600 pl-4 border-l-2 border-primary/30">
                                <span className="font-semibold">All Reference Ranges: </span>
                                {(() => {
                                  try {
                                    const ranges = typeof result.allReferenceRanges === 'string' 
                                      ? JSON.parse(result.allReferenceRanges) 
                                      : result.allReferenceRanges;
                                    return ranges.map((r: any, i: number) => (
                                      <span key={i}>
                                        {i > 0 && ' | '}
                                        <span className={result.menstrualPhase && (r.ageGroup || '').toLowerCase().includes(result.menstrualPhase) ? 'font-bold text-primary' : ''}>
                                          {r.ageGroup}: {r.range} {r.unit}
                                        </span>
                                      </span>
                                    ));
                                  } catch {
                                    return null;
                                  }
                                })()}
                                {result.menstrualPhase && (
                                  <span className="italic text-primary ml-2">
                                    (Flagged based on {result.menstrualPhase} phase)
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                    });
                  })()
                )}
              </tbody>
            </table>

            {/* FBC Panel Interpretation Message - display after FBC panel */}
            {panel.panelCode === 'FBC' && panel.results.some(r => r.testCode === 'WBC' && r.comments) && (
              <div className="mt-1 px-3 py-1 text-xs font-medium text-gray-700 border-t border-gray-200">
                {panel.results.find(r => r.testCode === 'WBC')?.comments}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
