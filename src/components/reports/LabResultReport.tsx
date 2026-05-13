import { useRef, useEffect } from 'react';
import { useLabReport } from '../../hooks/useLabReport';
import { useDefaultTemplate } from '../../hooks/useReportTemplates';
import { usePrinterContext } from '@/context/PrinterContext';
import { usePaginatedReport } from './SmartPaginatedReport';
import { ReportHeader } from './ReportHeader';
import { PatientInfoSection } from './PatientInfoSection';
import { PaginatedCategorySection } from './PaginatedCategorySection';
import { VerificationSection } from './VerificationSection';
import { ReportFooter } from './ReportFooter';
import { Button } from '../ui/button';
import { Printer, Download, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

interface LabResultReportProps {
  /** MongoDB ObjectId of the order to generate report for */
  orderId: string;
  /** Optional callback invoked after successful print */
  onPrintComplete?: () => void;
}

/**
 * LabResultReport Component
 * 
 * Displays a professional, printable laboratory results report with the following sections:
 * - Laboratory header with branding
 * - Patient demographics and order information
 * - Test results grouped by category with visual flags
 * - Verification signatures
 * - Legal disclaimers and laboratory credentials
 * 
 * Features:
 * - Print functionality with optimized layout
 * - PDF export via browser print-to-PDF
 * - Color-coded result flags (normal, high, low, critical)
 * - Arrow indicators for abnormal results
 * - Responsive design for screen viewing
 * - Print-specific CSS for paper output
 * 
 * @example
 * ```tsx
 * <LabResultReport 
 *   orderId="507f1f77bcf86cd799439011" 
 *   onPrintComplete={() => console.log('Printed')}
 * />
 * ```
 */
export function LabResultReport({ orderId, onPrintComplete }: LabResultReportProps) {
  const { reportData, loading, error, refetch } = useLabReport(orderId);
  const { data: template, isLoading: templateLoading } = useDefaultTemplate();
  const { settings: printerSettings } = usePrinterContext();
  const printRef = useRef<HTMLDivElement>(null);
  const margins = template?.margins;
  const paperSettings = template?.paperSettings;

  const marginTop = margins?.top ?? paperSettings?.marginTop ?? 10;
  const marginRight = margins?.right ?? paperSettings?.marginRight ?? 10;
  const marginBottom = margins?.bottom ?? paperSettings?.marginBottom ?? 12;
  const marginLeft = margins?.left ?? paperSettings?.marginLeft ?? 10;

  // Use admin-configured paper size and orientation
  const pageSize = `${printerSettings.a4.paperSize} ${printerSettings.a4.orientation}`;
  const reportWatermarkSrc = import.meta.env.VITE_REPORT_HEADER_LOGO || '/logo_resized.png';

  // Use smart pagination to split results across pages intelligently
  // Heights calibrated to print layout (mm) - COMPACT VERSION
  const paginatedPages = usePaginatedReport(
    reportData?.resultsByCategory || [],
    {
      headerHeight: 22,        // header with logo + lab name (reduced)
      patientInfoHeight: 18,   // patient info grid (reduced)
      footerHeight: 18,        // footer with wave + disclaimer (reduced)
      categoryTitleHeight: 7,  // category heading (reduced)
      panelHeaderHeight: 5,    // panel header row (reduced)
      tableHeaderHeight: 5,    // table column headers (reduced)
      testRowHeight: 4.8,      // row height for 12px font (reduced from 5.8)
      totalPageHeight: 297,
      margins: marginTop + marginBottom,
      maxTestsBeforeSplit: 50, // Never split FBC (24 tests) or similar panels
    }
  );

  // Debug: Log pagination results and report data
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('Report Data:', {
        hasData: !!reportData,
        orderId,
        paginatedPages: paginatedPages.length,
      });

      if (paginatedPages.length > 0) {
        console.log('Paginated Report:', {
          totalPages: paginatedPages.length,
          pages: paginatedPages.map(p => ({
            pageNumber: p.pageNumber,
            categories: p.categories.map(c => ({
              name: c.categoryDisplayName,
              panels: c.panels.length,
              totalTests: c.panels.reduce((sum, panel) => sum + panel.results.length, 0),
            })),
          })),
        });
      }

      if (reportData) {
        console.log('Report Content:', {
          patient: reportData.patientInfo.fullName,
          orderNumber: reportData.orderInfo.orderNumber,
          categories: reportData.resultsByCategory.length,
          totalResults: reportData.resultsByCategory.reduce((sum, cat) => sum + cat.results.length, 0),
        });
      }
    }
  }, [paginatedPages, reportData, orderId]);

  // Inject @page rule matching admin settings before printing
  // We use @page { margin: 0 } and apply margins as padding on .report-page
  // so that flexbox footer-at-bottom works correctly.
  const applyPrintPageRule = () => {
    const styleId = '__lab_report_page_style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@media print {
      @page { size: ${pageSize}; margin: 0; }
      .report-page { padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important; }
    }`;
  };

  const handlePrint = async () => {
    if (import.meta.env.DEV) {
      console.log('Print button clicked');
      console.log('Report ref:', printRef.current ? 'Found' : 'Not found');
      console.log('Report data:', reportData ? 'Loaded' : 'Not loaded');
      console.log('Paginated pages:', paginatedPages.length);
    }

    // Apply print styles first
    applyPrintPageRule();

    // Small delay to ensure styles are applied
    await new Promise(resolve => setTimeout(resolve, 200));

    if (import.meta.env.DEV) {
      console.log('Triggering window.print()');
    }

    // Electron: silent native print with configured settings
    if (window.electronAPI?.printSilent) {
      await window.electronAPI.printSilent({
        copies: printerSettings.a4.copies || 1,
        pageSize: printerSettings.a4.paperSize || 'A4',
        landscape: printerSettings.a4.orientation === 'landscape',
        silent: true,
      });
    } else {
      // Use window.print() for browser print
      window.print();
    }
    onPrintComplete?.();
  };

  const handleExportPDF = async () => {
    try {
      applyPrintPageRule();
      // Small delay to ensure styles are applied
      await new Promise(resolve => setTimeout(resolve, 200));

      // Electron: native PDF export with save dialog
      if (window.electronAPI?.printToPDF) {
        await window.electronAPI.printToPDF({
          pageSize: printerSettings.a4.paperSize || 'A4',
          landscape: printerSettings.a4.orientation === 'landscape',
        });
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF. Please try using your browser\'s print function and select "Save as PDF".');
    }
  };

  if (loading || templateLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex gap-2">
          <Button onClick={refetch}>Retry</Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No report data available.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="lab-result-report-container">
      {/* Action buttons - hidden when printing */}
      <div className="no-print flex gap-2 justify-end mb-6">
        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
        <Button
          onClick={handleExportPDF}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Report content — intelligently paginated */}
      <div ref={printRef} className="report-pages">
        {paginatedPages.map((page) => {
          return (
            <div
              key={page.pageNumber}
              className={`report-page relative w-full mx-auto bg-white p-8 print:p-0 ${!page.isLastPage ? 'report-page-break' : ''
                }`}
            >
              <div className="report-watermark" aria-hidden="true">
                <img src={reportWatermarkSrc} alt="" />
              </div>

              <div className="report-content relative z-10 flex-grow">
                {/* Header on every page */}
                <ReportHeader
                  laboratoryInfo={reportData.laboratoryInfo}
                  template={template}
                />

                {/* Patient info on every page */}
                <PatientInfoSection
                  patientInfo={reportData.patientInfo}
                  orderInfo={reportData.orderInfo}
                  template={template}
                />

                {/* Render categories for this page */}
                {page.categories.map((pageCategory, idx) => (
                  <PaginatedCategorySection
                    key={`${pageCategory.category}-${idx}`}
                    pageCategory={pageCategory}
                    template={template}
                  />
                ))}

              </div>

              {/* Verification + Footer pinned to bottom of page */}
              <div className="report-footer-container relative z-10 mt-auto">
                {/* Verification section only on last page */}
                {page.isLastPage && (
                  <VerificationSection verificationInfo={reportData.verificationInfo} />
                )}
                <ReportFooter
                  laboratoryInfo={reportData.laboratoryInfo}
                  reportMetadata={reportData.reportMetadata}
                  template={template}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          /* Hide ALL UI chrome: sidebar, nav, buttons, fixed overlays, etc. */
          .no-print,
          aside,
          nav,
          header:not(.report-header),
          button,
          .fixed,
          .sticky,
          .z-50,
          [role="navigation"] {
            display: none !important;
          }

          /* Reset the entire document */
          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* ===== CRITICAL: Remove RoleLayout sidebar offset ===== */
          /* The RoleLayout wraps content in div.ml-64 — this pushes
             everything 256px to the right. We MUST reset ALL margin-left
             and padding on every ancestor of the report. */
          #root > div,
          #root > div > div,
          .ml-64,
          [class*="ml-"] {
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          main, main.p-6 {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          /* Report container — full width, no constraints */
          .lab-result-report-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* Report pages container — full width */
          .report-pages {
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          /* ===== Each report page ===== */
          .report-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            /* Flex column to allow footer positioning */
            display: flex !important;
            flex-direction: column !important;
            /* Ensure page fills the full height to push footer to bottom */
            min-height: 277mm !important; /* A4 height (297mm) minus top/bottom margins (10mm each) */
            height: auto !important;
            box-sizing: border-box !important;
            position: relative !important;
          }

          .report-watermark {
            position: absolute !important;
            inset: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            pointer-events: none !important;
            z-index: 0 !important;
            overflow: hidden !important;
          }

          .report-watermark img {
            width: 70% !important;
            max-width: 700px !important;
            opacity: 0.03 !important;
            transform: translateY(8mm) !important;
            filter: grayscale(100%) !important;
          }

          /* Page break between pages (except the last one) */
          .report-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }

          .report-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* Report content area — grows to push footer to bottom */
          .report-content {
            overflow: visible !important;
            flex: 1 1 auto !important;
          }

          /* Footer pinned to bottom of each page */
          .report-footer-container {
            margin-top: auto !important;
            flex-shrink: 0 !important;
          }

          /* @page margins set to 0 — the .report-page padding handles edge spacing.
             The dynamically injected @page rule from admin settings overrides this. */
          @page {
            size: A4 portrait;
            margin: 0;
          }

          /* Preserve all colors and backgrounds */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Prevent individual rows from breaking mid-element */
          .page-break-inside-avoid,
          .results-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Ensure tables span full width */
          .results-table {
            width: 100% !important;
          }

          /* ===== PRINT LAYOUT — sized to fit A4 ===== */

          /* Header */
          .report-header {
            padding-bottom: 1mm !important;
            margin-bottom: 2mm !important;
          }
          .report-header h1 {
            font-size: 20px !important;
            line-height: 1.1 !important;
          }
          .report-header img {
            height: 42px !important;
          }
          .report-header .flex {
            gap: 6px !important;
          }
          .report-header .text-right {
            font-size: 11px !important;
          }

          /* Patient info section */
          .patient-info-section {
            margin-bottom: 2mm !important;
          }
          .patient-info-section .grid {
            gap: 10px !important;
          }
          .patient-info-section p {
            font-size: 11.5px !important;
            line-height: 1.3 !important;
            margin: 0 !important;
          }
          .patient-info-section h3 {
            font-size: 11px !important;
            margin: 0 !important;
            padding-bottom: 1px !important;
          }
          .patient-info-section .space-y-1 > * + * {
            margin-top: 1px !important;
          }

          /* Category headings */
          .category-section {
            margin-bottom: 1mm !important;
          }
          .category-section > h3 {
            font-size: 20px !important;
            font-weight: 900 !important;
            color: #dc2626 !important;
            margin-bottom: 1.5mm !important;
            line-height: 1.1 !important;
          }

          /* Results table */
          .results-table {
            margin-bottom: 1mm !important;
            font-size: 12px !important;
          }
          .results-table th {
            padding: 2px 6px !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
          }
          .results-table td {
            padding: 1px 6px !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }

          .results-table tbody tr {
            border-bottom: 1px solid #dbe4ee !important;
          }

          .results-table tbody tr.result-row:nth-child(odd) td {
            background: #f8fafc !important;
          }

          .results-table tbody tr.result-row:nth-child(even) td {
            background: #ffffff !important;
          }

          /* Verification section */
          .verification-section {
            margin-top: 3mm !important;
            margin-bottom: 1mm !important;
          }
          .verification-section .grid {
            gap: 16px !important;
          }
          .verification-section p,
          .verification-section .text-sm {
            font-size: 12px !important;
            line-height: 1.3 !important;
          }

          /* Footer */
          .report-footer {
            margin-top: 1mm !important;
            padding-top: 1mm !important;
          }
          .report-footer .decorative-wave svg {
            height: 24px !important;
          }
          .report-footer .decorative-wave {
            margin-bottom: 0.5mm !important;
          }
          .report-footer .grid {
            gap: 8px !important;
          }
          .report-footer-container {
            margin-top: 2mm !important;
          }
        }

        @media screen {
          .report-page {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 8px 24px -14px rgba(15, 23, 42, 0.35);
            overflow: hidden;
            animation: report-fade-in 260ms ease-out;
            position: relative;
          }

          .report-watermark {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 0;
            overflow: hidden;
          }

          .report-watermark img {
            width: min(72%, 760px);
            opacity: 0.05;
            transform: translateY(10mm);
            filter: grayscale(100%);
          }

          @keyframes report-fade-in {
            from {
              opacity: 0;
              transform: translateY(4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .report-page + .report-page {
            margin-top: 2rem;
            border-top: 2px dashed #d1d5db;
            padding-top: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
