/**
 * Unified Print Service
 * Handles receipt printing with automatic fallback
 */

import { thermalPrinter } from './thermalPrinterService';
import { browserPrint } from './browserPrintService';

export interface ReceiptData {
  labName: string;
  labAddress: string;
  labPhone: string;
  orderNumber: string;
  patientName: string;
  date: string;
  tests: Array<{ name: string; price: number }>;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentMethod: string;
}

export type PrintMethod = 'serial' | 'browser' | 'auto';

class PrintService {
  private preferredMethod: PrintMethod = 'auto';
  private isSerialConnected = false;

  /**
   * Set preferred print method
   */
  setPreferredMethod(method: PrintMethod): void {
    this.preferredMethod = method;
    localStorage.setItem('preferredPrintMethod', method);
  }

  /**
   * Get preferred print method from storage
   */
  getPreferredMethod(): PrintMethod {
    const stored = localStorage.getItem('preferredPrintMethod') as PrintMethod;
    return stored || 'auto';
  }

  /**
   * Check if Web Serial API is available
   */
  isSerialSupported(): boolean {
    return thermalPrinter.isSupported();
  }

  /**
   * Connect to thermal printer via Web Serial
   */
  async connectSerialPrinter(): Promise<boolean> {
    try {
      await thermalPrinter.connect();
      this.isSerialConnected = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to serial printer:', error);
      this.isSerialConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from thermal printer
   */
  async disconnectSerialPrinter(): Promise<void> {
    await thermalPrinter.disconnect();
    this.isSerialConnected = false;
  }

  /**
   * Check if serial printer is connected
   */
  isSerialPrinterConnected(): boolean {
    return this.isSerialConnected && thermalPrinter.isConnected();
  }

  /**
   * Print receipt using the best available method
   */
  async printReceipt(receipt: ReceiptData): Promise<{ success: boolean; method: string; error?: string }> {
    const method = this.getPreferredMethod();

    // Try serial printing first (if auto or serial)
    if ((method === 'auto' || method === 'serial') && this.isSerialSupported()) {
      try {
        // Connect if not already connected
        if (!this.isSerialPrinterConnected()) {
          const connected = await this.connectSerialPrinter();
          if (!connected && method === 'serial') {
            return { 
              success: false, 
              method: 'serial', 
              error: 'Failed to connect to thermal printer' 
            };
          }
        }

        // Print via serial
        if (this.isSerialPrinterConnected()) {
          await thermalPrinter.printReceipt(receipt);
          return { success: true, method: 'serial' };
        }
      } catch (error: unknown) {
        console.error('Serial printing failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Serial printing failed';
        
        // If serial was explicitly requested, don't fallback
        if (method === 'serial') {
          return { 
            success: false, 
            method: 'serial', 
            error: errorMessage
          };
        }
      }
    }

    // Fallback to browser print dialog
    if (method === 'auto' || method === 'browser') {
      try {
        browserPrint.printReceipt(receipt);
        return { success: true, method: 'browser' };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Browser printing failed';
        return { 
          success: false, 
          method: 'browser', 
          error: errorMessage
        };
      }
    }

    return { 
      success: false, 
      method: 'none', 
      error: 'No print method available' 
    };
  }

  /**
   * Test printer connection
   */
  async testPrinter(): Promise<boolean> {
    try {
      if (!this.isSerialPrinterConnected()) {
        await this.connectSerialPrinter();
      }

      await thermalPrinter.printText('=== PRINTER TEST ===\n');
      await thermalPrinter.printText('Connection successful!\n');
      await thermalPrinter.feed(3);
      await thermalPrinter.cut();
      
      return true;
    } catch (error) {
      console.error('Printer test failed:', error);
      return false;
    }
  }

  /**
   * Open cash drawer (if connected)
   */
  async openCashDrawer(): Promise<boolean> {
    try {
      if (!this.isSerialPrinterConnected()) {
        await this.connectSerialPrinter();
      }

      await thermalPrinter.openDrawer();
      return true;
    } catch (error) {
      console.error('Failed to open cash drawer:', error);
      return false;
    }
  }
}

export const printService = new PrintService();
