import qz from 'qz-tray';
import { buildReceiptESCPOS, type ReceiptData } from '@/utils/escpos';

/**
 * QZ Tray Service for automatic thermal receipt printing
 * 
 * QZ Tray is a background service that enables direct printing to thermal printers
 * without browser print dialogs. It must be installed and running on the client PC.
 * 
 * Download: https://qz.io/download/
 */

class QZTrayService {
  private connected = false;
  private printerName: string | null = null;

  /**
   * Check if QZ Tray is available (installed and running)
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await qz.websocket.isActive();
    } catch {
      return false;
    }
  }

  /**
   * Connect to QZ Tray websocket
   */
  async connect(): Promise<boolean> {
    try {
      if (this.connected) {
        console.log('✅ QZ Tray already connected');
        return true;
      }

      console.log('🔌 Connecting to QZ Tray...');
      await qz.websocket.connect();
      this.connected = true;
      console.log('✅ Connected to QZ Tray');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to QZ Tray:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from QZ Tray
   */
  async disconnect(): Promise<void> {
    try {
      if (!this.connected) return;
      await qz.websocket.disconnect();
      this.connected = false;
      console.log('🔌 Disconnected from QZ Tray');
    } catch (error) {
      console.error('❌ Failed to disconnect from QZ Tray:', error);
    }
  }

  /**
   * Get list of available printers
   */
  async getPrinters(): Promise<string[]> {
    try {
      if (!this.connected) {
        await this.connect();
      }
      const printers = await qz.printers.find();
      console.log('🖨️ Available printers:', printers);
      return printers;
    } catch (error) {
      console.error('❌ Failed to get printers:', error);
      return [];
    }
  }

  /**
   * Find XPrinter in the list of available printers
   */
  async findXPrinter(): Promise<string | null> {
    try {
      const printers = await this.getPrinters();
      
      // Look for XPrinter (case-insensitive)
      const xprinter = printers.find(p => 
        p.toLowerCase().includes('xprinter') || 
        p.toLowerCase().includes('xp-80') ||
        p.toLowerCase().includes('xp-58')
      );

      if (xprinter) {
        console.log('✅ Found XPrinter:', xprinter);
        return xprinter;
      }

      // If no XPrinter found, try to get default printer
      const defaultPrinter = await qz.printers.getDefault();
      console.log('⚠️ No XPrinter found, using default:', defaultPrinter);
      return defaultPrinter;
    } catch (error) {
      console.error('❌ Failed to find printer:', error);
      return null;
    }
  }

  /**
   * Set the printer to use for printing
   */
  setPrinter(printerName: string): void {
    this.printerName = printerName;
    console.log('🖨️ Printer set to:', printerName);
  }

  /**
   * Get the currently configured printer
   */
  getPrinter(): string | null {
    return this.printerName;
  }

  /**
   * Print receipt using ESC/POS commands
   * This is the main method for automatic printing
   */
  async printReceipt(receiptData: ReceiptData, copyType: 'patient' | 'lab'): Promise<boolean> {
    try {
      // Ensure connected
      if (!this.connected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error('Failed to connect to QZ Tray');
        }
      }

      // Get printer name
      let printer = this.printerName;
      if (!printer) {
        printer = await this.findXPrinter();
        if (!printer) {
          throw new Error('No printer found');
        }
        this.printerName = printer;
      }

      console.log(`🖨️ Printing ${copyType} copy to ${printer}...`);

      // Build ESC/POS commands
      const escposBytes = buildReceiptESCPOS(receiptData, copyType);

      // Convert Uint8Array to regular array for QZ Tray
      const data = Array.from(escposBytes);

      // Create printer configuration
      const config = qz.configs.create(printer);

      // Print
      await qz.print(config, [{ type: 'raw', data }]);

      console.log(`✅ ${copyType} copy printed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to print ${copyType} copy:`, error);
      return false;
    }
  }

  /**
   * Print both patient and lab copies sequentially
   */
  async printBothCopies(receiptData: ReceiptData): Promise<{ success: boolean; printedCount: number }> {
    let printedCount = 0;

    try {
      // Print patient copy
      const patientSuccess = await this.printReceipt(receiptData, 'patient');
      if (patientSuccess) {
        printedCount++;
      }

      // Wait a bit between prints
      await new Promise(resolve => setTimeout(resolve, 800));

      // Print lab copy
      const labSuccess = await this.printReceipt(receiptData, 'lab');
      if (labSuccess) {
        printedCount++;
      }

      return {
        success: printedCount === 2,
        printedCount,
      };
    } catch (error) {
      console.error('❌ Error printing both copies:', error);
      return {
        success: false,
        printedCount,
      };
    }
  }

  /**
   * Test print - prints a simple test receipt
   */
  async testPrint(): Promise<boolean> {
    try {
      if (!this.connected) {
        await this.connect();
      }

      let printer = this.printerName;
      if (!printer) {
        printer = await this.findXPrinter();
        if (!printer) {
          throw new Error('No printer found');
        }
      }

      console.log('🖨️ Sending test print to', printer);

      const config = qz.configs.create(printer);
      const testData = [
        '\x1B\x40',              // Initialize printer
        '\x1B\x61\x01',          // Center align
        'QZ TRAY TEST PRINT\n',
        '==================\n',
        '\x1B\x61\x00',          // Left align
        'If you can read this,\n',
        'QZ Tray is working!\n',
        '\n\n\n',
        '\x1D\x56\x00'           // Cut paper
      ];

      await qz.print(config, testData);
      console.log('✅ Test print sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Test print failed:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Export singleton instance
export const qzTrayService = new QZTrayService();
