/**
 * Thermal Printer Service for XPrinter 80mm
 * Uses Web Serial API for direct ESC/POS printing
 */

// ESC/POS Commands for thermal printers
const ESC = '\x1B';
const GS = '\x1D';

export class ThermalPrinterService {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  /**
   * Check if Web Serial API is supported
   */
  isSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Request connection to thermal printer
   */
  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API is not supported in this browser. Use Chrome, Edge, or Opera.');
    }

    try {
      // Request a port and open a connection
      this.port = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x0416 }, // XPrinter vendor ID
          { usbVendorId: 0x04b8 }, // Epson (some XPrinters use this)
        ]
      });

      await this.port.open({ 
        baudRate: 9600, // Standard for most thermal printers
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });

      this.writer = this.port.writable.getWriter();
      
      // Initialize printer
      await this.initialize();
      
      return true;
    } catch (error) {
      console.error('Failed to connect to printer:', error);
      throw error;
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  /**
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.port !== null && this.writer !== null;
  }

  /**
   * Initialize printer (reset to default state)
   */
  private async initialize(): Promise<void> {
    await this.sendCommand(`${ESC}@`); // Initialize printer
  }

  /**
   * Send raw command to printer
   */
  private async sendCommand(command: string): Promise<void> {
    if (!this.writer) {
      throw new Error('Printer not connected');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(command);
    await this.writer.write(data);
  }

  /**
   * Print text
   */
  async printText(text: string): Promise<void> {
    await this.sendCommand(text);
  }

  /**
   * Print text with alignment
   */
  async printAligned(text: string, alignment: 'left' | 'center' | 'right'): Promise<void> {
    const alignCode = alignment === 'left' ? 0 : alignment === 'center' ? 1 : 2;
    await this.sendCommand(`${ESC}a${String.fromCharCode(alignCode)}${text}`);
  }

  /**
   * Print text with bold
   */
  async printBold(text: string): Promise<void> {
    await this.sendCommand(`${ESC}E1${text}${ESC}E0`);
  }

  /**
   * Print text with size (1-8)
   */
  async printWithSize(text: string, width: number = 1, height: number = 1): Promise<void> {
    const size = ((width - 1) << 4) | (height - 1);
    await this.sendCommand(`${GS}!${String.fromCharCode(size)}${text}${GS}!${String.fromCharCode(0)}`);
  }

  /**
   * Print line separator
   */
  async printLine(char: string = '-', length: number = 32): Promise<void> {
    await this.printText(char.repeat(length) + '\n');
  }

  /**
   * Feed paper (line breaks)
   */
  async feed(lines: number = 1): Promise<void> {
    await this.sendCommand('\n'.repeat(lines));
  }

  /**
   * Cut paper (if printer supports it)
   */
  async cut(): Promise<void> {
    await this.sendCommand(`${GS}V${String.fromCharCode(66)}${String.fromCharCode(0)}`);
  }

  /**
   * Open cash drawer (if connected)
   */
  async openDrawer(): Promise<void> {
    await this.sendCommand(`${ESC}p${String.fromCharCode(0)}${String.fromCharCode(50)}${String.fromCharCode(250)}`);
  }

  /**
   * Print receipt for an order
   */
  async printReceipt(receipt: {
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
  }): Promise<void> {
    try {
      // Header
      await this.printAligned(receipt.labName, 'center');
      await this.printWithSize(receipt.labName, 2, 2);
      await this.feed(1);
      await this.printAligned(receipt.labAddress, 'center');
      await this.printAligned(receipt.labPhone, 'center');
      await this.feed(1);
      await this.printLine('=', 32);
      
      // Order info
      await this.printBold(`Order: ${receipt.orderNumber}`);
      await this.printText(`Patient: ${receipt.patientName}\n`);
      await this.printText(`Date: ${receipt.date}\n`);
      await this.printLine('-', 32);
      
      // Tests
      await this.printBold('Tests:\n');
      for (const test of receipt.tests) {
        const testLine = this.formatLine(test.name, `GHS ${test.price.toFixed(2)}`, 32);
        await this.printText(testLine + '\n');
      }
      await this.printLine('-', 32);
      
      // Totals
      await this.printText(this.formatLine('Subtotal:', `GHS ${receipt.subtotal.toFixed(2)}`, 32) + '\n');
      if (receipt.discount > 0) {
        await this.printText(this.formatLine('Discount:', `-GHS ${receipt.discount.toFixed(2)}`, 32) + '\n');
      }
      await this.printBold(this.formatLine('TOTAL:', `GHS ${receipt.total.toFixed(2)}`, 32) + '\n');
      await this.printText(this.formatLine('Paid:', `GHS ${receipt.amountPaid.toFixed(2)}`, 32) + '\n');
      
      if (receipt.balance !== 0) {
        const balanceLabel = receipt.balance > 0 ? 'Balance Due:' : 'Change:';
        const balanceAmount = Math.abs(receipt.balance);
        await this.printBold(this.formatLine(balanceLabel, `GHS ${balanceAmount.toFixed(2)}`, 32) + '\n');
      }
      
      await this.printLine('-', 32);
      await this.printText(`Payment: ${receipt.paymentMethod}\n`);
      await this.printLine('=', 32);
      
      // Footer
      await this.feed(1);
      await this.printAligned('Thank you for your visit!', 'center');
      await this.printAligned('Get well soon', 'center');
      await this.feed(3);
      
      // Cut paper
      await this.cut();
      
    } catch (error) {
      console.error('Failed to print receipt:', error);
      throw error;
    }
  }

  /**
   * Format a line with left and right aligned text
   */
  private formatLine(left: string, right: string, width: number): string {
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(0, spaces)) + right;
  }
}

// Singleton instance
export const thermalPrinter = new ThermalPrinterService();
