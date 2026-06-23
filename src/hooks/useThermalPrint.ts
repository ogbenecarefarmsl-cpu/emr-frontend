import { useCallback } from 'react';
import { usePrinterContext } from '@/context/PrinterContext';
import { usbPrinterService } from '@/services/usbPrinterService';
import { btPrinterService } from '@/services/bluetoothPrinterService';
import { qzTrayService } from '@/services/qzTrayService';
import { buildReceiptESCPOS, type ReceiptData } from '@/utils/escpos';

export const useThermalPrint = () => {
  const { settings, qzTrayConnected } = usePrinterContext();

  /**
   * Prints both receipt copies via ESC/POS (USB → BT → QZ Tray).
   * Never opens a browser print dialog.
   */
  const printBothCopies = useCallback(
    async (
      _patientCopyElement: HTMLElement | null,
      _labCopyElement: HTMLElement | null,
      _receiptNumber: string,
      receiptData?: ReceiptData
    ): Promise<{ success: boolean; printedCount: number }> => {
      if (!receiptData) return { success: false, printedCount: 0 };

      // Try USB first
      try {
        if (!usbPrinterService.isConnected) {
          await usbPrinterService.autoConnect();
        }
        if (usbPrinterService.isConnected) {
          const patientBytes = buildReceiptESCPOS(receiptData, 'patient');
          await usbPrinterService.print(patientBytes);
          let printedCount = 1;

          if (settings.thermal.copies === 2) {
            await new Promise(r => setTimeout(r, 800));
            const labBytes = buildReceiptESCPOS(receiptData, 'lab');
            await usbPrinterService.print(labBytes);
            printedCount = 2;
          }

          return { success: true, printedCount };
        }
      } catch {}

      // Try Bluetooth — autoConnect first, then reconnect (which falls back to picker)
      try {
        if (!btPrinterService.isConnected) {
          const ok = await btPrinterService.autoConnect();
          if (!ok) {
            // Silent reconnect failed — try reconnect with user gesture fallback
            // Note: this may open the browser picker if autoConnect fails
            await btPrinterService.reconnect();
          }
        }
        if (btPrinterService.isConnected) {
          const patientBytes = buildReceiptESCPOS(receiptData, 'patient');
          await btPrinterService.print(patientBytes);
          let printedCount = 1;

          if (settings.thermal.copies === 2) {
            await new Promise(r => setTimeout(r, 800));
            const labBytes = buildReceiptESCPOS(receiptData, 'lab');
            await btPrinterService.print(labBytes);
            printedCount = 2;
          }

          return { success: true, printedCount };
        }
      } catch {}

      // Try QZ Tray
      if (qzTrayConnected) {
        try {
          return await qzTrayService.printBothCopies(receiptData);
        } catch {}
      }

      return { success: false, printedCount: 0 };
    },
    [settings.thermal.copies, qzTrayConnected]
  );

  return {
    printBothCopies,
  };
};
