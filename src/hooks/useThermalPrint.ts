import { useCallback } from 'react';
import { thermalPrintStyles } from '@/components/receipts/ThermalReceipt';
import { usePrinterContext } from '@/context/PrinterContext';
import { usbPrinterService } from '@/services/usbPrinterService';
import { qzTrayService } from '@/services/qzTrayService';
import { buildReceiptESCPOS, type ReceiptData } from '@/utils/escpos';
import { printBothReceiptCopies } from '@/services/browserThermalPrint';

interface PrintOptions {
  title: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useThermalPrint = () => {
  const { settings, thermalConnected, qzTrayConnected } = usePrinterContext();

  // ── ESC/POS path (WebUSB) ──────────────────────────────────────────────

  /**
   * Sends a receipt directly to the USB thermal printer using raw ESC/POS.
   * Does NOT open any browser dialog.
   */
  const printReceiptESCPOS = useCallback(
    async (data: ReceiptData, copyType: 'patient' | 'lab'): Promise<void> => {
      const bytes = buildReceiptESCPOS(data, copyType);
      await usbPrinterService.print(bytes);
    },
    []
  );

  // ── Print fallback (Browser with installed driver) ────────────────────

  /**
   * Renders the DOM element and prints it using browser print dialog.
   * Works with installed printer drivers (e.g., XPrinter).
   * 
   * This is the RECOMMENDED approach when you have printer drivers installed.
   */
  const printReceipt = useCallback(
    (element: HTMLElement | null, options: PrintOptions): Promise<void> => {
      return new Promise(async (resolve, reject) => {
        if (!element) {
          const error = new Error('Receipt element not found');
          options.onError?.(error);
          reject(error);
          return;
        }

        const html = `<html><head><title>${options.title}</title><style>${thermalPrintStyles}</style></head><body>${element.innerHTML}</body></html>`;

        // Electron path: require silent print via IPC (no popup, no dialog)
        if (window.electronAPI?.isElectron) {
          if (!window.electronAPI?.printHTML) {
            const error = new Error('Electron print bridge is not available');
            options.onError?.(error);
            reject(error);
            return;
          }

          try {
            const result = await window.electronAPI.printHTML(html, {
              copies: 1,
              silent: true,
            });
            if (result.success) {
              options.onSuccess?.();
              resolve();
              return;
            }

            const error = new Error(result.error || 'Silent print failed');
            options.onError?.(error);
            reject(error);
            return;
          } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            options.onError?.(error);
            reject(error);
            return;
          }
        }

        // Browser fallback: popup window
        const printWindow = window.open('', '', 'width=302,height=600');
        if (!printWindow) {
          const error = new Error('Failed to open print window');
          options.onError?.(error);
          reject(error);
          return;
        }

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
            options.onSuccess?.();
            resolve();
          }, 500);
        }, 250);
      });
    },
    []
  );

  // ── Smart combined entrypoint ──────────────────────────────────────────

  /**
   * Prints both receipt copies (patient and lab).
   *
   * Priority order:
   * 1. If QZ Tray connected → Use QZ Tray (fully automatic, no dialog)
   * 2. If USB thermal printer connected → Use ESC/POS (no dialog)
   * 3. Otherwise → Use browser print with installed driver (shows dialog)
   *
   * For installed printer drivers (XPrinter, etc.):
   * - Set printer as default in Windows
   * - Browser will remember printer selection
   * - Both copies print sequentially with minimal interaction
   *
   * @param patientCopyElement  DOM ref for the patient-copy receipt
   * @param labCopyElement      DOM ref for the lab-copy receipt
   * @param receiptNumber       Used for window title
   * @param receiptData         Required for ESC/POS and QZ Tray paths
   */
  const printBothCopies = useCallback(
    async (
      patientCopyElement: HTMLElement | null,
      labCopyElement: HTMLElement | null,
      receiptNumber: string,
      receiptData?: ReceiptData
    ): Promise<{ success: boolean; printedCount: number }> => {
      console.log('🖨️ Print Debug:', {
        hasReceiptData: receiptData != null,
        qzTrayConnected,
        usbServiceConnected: usbPrinterService.isConnected,
      });

      try {
        // Try direct USB printing first (like test print does)
        if (receiptData) {
          console.log('🖨️ Attempting direct USB print (like test print)...');
          
          try {
            // Auto-connect if not connected (like test print does)
            if (!usbPrinterService.isConnected) {
              console.log('🔌 USB not connected, attempting auto-connect...');
              const connected = await usbPrinterService.autoConnect();
              if (!connected) {
                console.log('⚠️ Auto-connect failed, will try QZ Tray or browser fallback');
                throw new Error('USB auto-connect failed');
              }
              console.log('✅ USB auto-connected successfully');
            }

            // Print patient copy
            console.log('🖨️ Printing patient copy via USB...');
            const patientBytes = buildReceiptESCPOS(receiptData, 'patient');
            await usbPrinterService.print(patientBytes);
            console.log('✅ Patient copy sent to USB printer');
            
            let printedCount = 1;

            // Print lab copy if configured
            if (settings.thermal.copies === 2) {
              await new Promise(r => setTimeout(r, 800));
              console.log('🖨️ Printing lab copy via USB...');
              const labBytes = buildReceiptESCPOS(receiptData, 'lab');
              await usbPrinterService.print(labBytes);
              console.log('✅ Lab copy sent to USB printer');
              printedCount = 2;
            }

            return { success: true, printedCount };
          } catch (usbError) {
            console.log('⚠️ USB printing failed:', usbError);
            console.log('🔄 Trying QZ Tray fallback...');
            
            // Try QZ Tray as fallback
            if (qzTrayConnected) {
              console.log('✅ Using QZ Tray for automatic printing');
              return await qzTrayService.printBothCopies(receiptData);
            }
            
            // If both USB and QZ Tray failed, throw to trigger browser fallback
            throw usbError;
          }
        }

        // Final fallback: Browser print dialog
        console.log('✅ Using browser print with installed driver (XPrinter)');
        console.log('💡 Tip: Set XPrinter as default printer to skip selection');
        return await printBothReceiptCopies(patientCopyElement, labCopyElement);
        
      } catch (error) {
        console.error('❌ Print error:', error);
        // Still try browser fallback even if everything else failed
        try {
          console.log('🔄 Final fallback: Browser print dialog');
          return await printBothReceiptCopies(patientCopyElement, labCopyElement);
        } catch (fallbackError) {
          console.error('❌ All print methods failed:', fallbackError);
          return { success: false, printedCount: 0 };
        }
      }
    },
    [settings.thermal.copies, qzTrayConnected]
  );

  return {
    printReceipt,
    printReceiptESCPOS,
    printBothCopies,
  };
};
