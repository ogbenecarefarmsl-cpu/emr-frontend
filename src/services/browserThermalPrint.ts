/**
 * Browser-based thermal receipt printing service
 * Uses hidden iframe and window.print() with installed printer driver
 */

import { thermalPrintStyles } from '@/components/receipts/ThermalReceipt';

export interface ThermalPrintOptions {
  printerName?: string; // Optional: specific printer name
  copies?: number; // Number of copies (default: 1)
  autoPrint?: boolean; // Auto-trigger print dialog (default: true)
}

/**
 * Print HTML content to thermal printer using browser print dialog
 * Works with installed printer drivers (e.g., XPrinter)
 */
export async function printThermalReceipt(
  htmlContent: string,
  options: ThermalPrintOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Failed to access iframe document');
      }

      // Write receipt HTML with thermal print styles
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Receipt</title>
          <style>
            ${thermalPrintStyles}
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `);
      iframeDoc.close();

      // Wait for content to load
      iframe.onload = () => {
        setTimeout(() => {
          try {
            // Trigger print dialog
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            // Clean up after print
            setTimeout(() => {
              document.body.removeChild(iframe);
              resolve();
            }, 1000);
          } catch (error) {
            document.body.removeChild(iframe);
            reject(error);
          }
        }, 250);
      };

      iframe.onerror = () => {
        document.body.removeChild(iframe);
        reject(new Error('Failed to load print iframe'));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Print multiple copies sequentially
 * Each copy will show a print dialog
 */
export async function printMultipleCopies(
  htmlContent: string,
  copies: number = 2,
  delayBetweenCopies: number = 1500
): Promise<{ success: boolean; printedCount: number }> {
  let printedCount = 0;

  try {
    for (let i = 0; i < copies; i++) {
      await printThermalReceipt(htmlContent);
      printedCount++;

      // Delay between copies to allow user to complete first print
      if (i < copies - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenCopies));
      }
    }

    return { success: true, printedCount };
  } catch (error) {
    console.error('Print error:', error);
    return { success: false, printedCount };
  }
}

/**
 * Generate receipt HTML from DOM element
 */
export function generateReceiptHTML(element: HTMLElement): string {
  return element.innerHTML;
}

/**
 * Print both patient and lab copies
 */
export async function printBothReceiptCopies(
  patientCopyElement: HTMLElement | null,
  labCopyElement: HTMLElement | null
): Promise<{ success: boolean; printedCount: number }> {
  if (!patientCopyElement || !labCopyElement) {
    throw new Error('Receipt elements not found');
  }

  let printedCount = 0;

  try {
    // Print patient copy first
    console.log('🖨️ Printing patient copy...');
    const patientHTML = generateReceiptHTML(patientCopyElement);
    await printThermalReceipt(patientHTML);
    printedCount++;

    // Wait before printing lab copy
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Print lab copy
    console.log('🖨️ Printing lab copy...');
    const labHTML = generateReceiptHTML(labCopyElement);
    await printThermalReceipt(labHTML);
    printedCount++;

    return { success: true, printedCount };
  } catch (error) {
    console.error('Print error:', error);
    return { success: false, printedCount };
  }
}
