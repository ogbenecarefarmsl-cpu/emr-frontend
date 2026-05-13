/**
 * Unified print service that uses Electron's native printing when available,
 * falling back to browser window.print() in the web version.
 */

const isElectron = !!window.electronAPI?.isElectron;

export interface NativePrintOptions {
  copies?: number;
  pageSize?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  silent?: boolean;
  margins?: {
    marginType?: 'default' | 'none' | 'printableArea' | 'custom';
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

/**
 * Print the current page.
 * - Electron: uses native silent print (no dialog popup)
 * - Browser: falls back to window.print()
 */
export async function printCurrentPage(options?: NativePrintOptions): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    const result = await window.electronAPI.printSilent(options);
    return result.success;
  }
  window.print();
  return true;
}

/**
 * Print with the system print dialog.
 * - Electron: native OS print dialog
 * - Browser: window.print() (always shows dialog)
 */
export async function printWithDialog(): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    const result = await window.electronAPI.printWithDialog();
    return result.success;
  }
  window.print();
  return true;
}

/**
 * Print arbitrary HTML content silently (e.g., receipts, labels).
 * - Electron: renders in a hidden BrowserWindow and prints silently
 * - Browser: opens a popup window and calls print()
 */
export async function printHTML(
  html: string,
  options?: NativePrintOptions,
): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    const result = await window.electronAPI.printHTML(html, options);
    return result.success;
  }

  // Browser fallback: popup print
  return new Promise((resolve) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      resolve(false);
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
        resolve(true);
      }, 500);
    }, 250);
  });
}

/**
 * Export the current page to PDF with a save dialog.
 * - Electron: native printToPDF + save dialog
 * - Browser: triggers window.print() (user can choose "Save as PDF")
 */
export async function exportToPDF(options?: NativePrintOptions): Promise<boolean> {
  if (isElectron && window.electronAPI) {
    const result = await window.electronAPI.printToPDF(options);
    return result.success;
  }
  window.print();
  return true;
}

/**
 * Get the list of printers available on this machine.
 * Only works in Electron.
 */
export async function getAvailablePrinters() {
  if (isElectron && window.electronAPI) {
    return window.electronAPI.getPrinters();
  }
  return [];
}
