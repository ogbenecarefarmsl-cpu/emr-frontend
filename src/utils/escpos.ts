/**
 * ESC/POS command builder for 80mm thermal receipt printers (e.g. Xprinter XT-80P).
 *
 * Line width at normal font on 80mm paper is approximately 42 characters.
 * ESC/POS reference: https://reference.epson-biz.com/modules/ref_escpos/index.php
 */

const ESC = 0x1b;
const GS  = 0x1d;

export const LINE_WIDTH = 42;

// Re-exported so callers can share the type without importing ThermalReceipt
export interface ReceiptData {
  receiptNumber: string;
  orderNumber: string;
  patientName: string;
  patientId: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
  tests: Array<{ code: string; name: string; price: number }>;
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  total: number;
  amountPaid: number;
  paymentMethod: 'cash' | 'card' | 'mobile-money';
  paymentDate: string;
  cashier: string;
  collectionDate?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Right-aligns `value` and left-aligns `label`, filling with spaces. */
function padLine(label: string, value: string, width = LINE_WIDTH): string {
  const spaces = width - label.length - value.length;
  return spaces > 0 ? label + ' '.repeat(spaces) + value : `${label} ${value}`;
}

/** Centers `text` within `width` characters. */
function center(text: string, width = LINE_WIDTH): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

/** Formats a Sierra Leone Leones currency amount. */
function formatCurrency(n: number): string {
  return `Le ${n.toLocaleString('en-US')}`;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export class EscPosBuilder {
  private bytes: number[] = [];

  /** ESC @ — Initialize/reset printer */
  init(): this {
    this.bytes.push(ESC, 0x40);
    return this;
  }

  /** ESC a n — Set text alignment */
  align(a: 'left' | 'center' | 'right'): this {
    const n = a === 'left' ? 0 : a === 'center' ? 1 : 2;
    this.bytes.push(ESC, 0x61, n);
    return this;
  }

  /** ESC E n — Bold on/off */
  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  /**
   * GS ! n — Font size.
   * 0x00 = normal, 0x11 = double width+height, 0x10 = double height only,
   * 0x01 = double width only.
   */
  fontSize(n: number): this {
    this.bytes.push(GS, 0x21, n);
    return this;
  }

  /** Append raw text bytes (UTF-8 or ASCII) */
  text(str: string): this {
    const encoded = new TextEncoder().encode(str);
    encoded.forEach(b => this.bytes.push(b));
    return this;
  }

  /** Append text + LF */
  line(str = ''): this {
    return this.text(str + '\n');
  }

  /** Print a separator line */
  separator(char = '-', width = LINE_WIDTH): this {
    return this.line(char.repeat(width));
  }

  /** ESC d n — Feed n lines */
  feed(lines = 3): this {
    this.bytes.push(ESC, 0x64, lines);
    return this;
  }

  /** GS V 66 0 — Partial paper cut */
  cut(): this {
    this.bytes.push(GS, 0x56, 0x42, 0x00);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

// ── Receipt builder ───────────────────────────────────────────────────────────

/**
 * Builds the full ESC/POS byte sequence for one receipt copy.
 * Both patient and lab copies are supported via `copyType`.
 */
export function buildReceiptESCPOS(
  data: ReceiptData,
  copyType: 'patient' | 'lab'
): Uint8Array {
  const paymentDate = new Date(data.paymentDate);
  const dateStr =
    paymentDate.toLocaleDateString('en-GB') +
    ' ' +
    paymentDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const discountAmount =
    data.discountType === 'percentage'
      ? (data.subtotal * data.discount) / 100
      : data.discount;

  const b = new EscPosBuilder();

  // ── Header ───────────────────────────────────────────────────────────────
  b.init();
  b.align('center');
  b.bold(true).fontSize(0x11);
  b.line('HARBOUR Medical Diagnostic');
  b.fontSize(0x00).bold(false);
  b.line('114, Fourah Bay Road, Freetown, Sierra Leone');
  b.line('Tel: +23274414434');
  b.line('harbourmedicaldiagnostics@gmail.com');
  b.separator('=');

  // ── Copy type ────────────────────────────────────────────────────────────
  b.bold(true);
  b.line(center(copyType === 'patient' ? '*** PATIENT COPY ***' : '*** LAB COPY ***'));
  b.bold(false);
  b.separator('=');

  // ── Receipt info ─────────────────────────────────────────────────────────
  b.align('left');
  b.line(padLine('Receipt No:', data.receiptNumber));
  b.line(padLine('Order No:', data.orderNumber));
  b.line(padLine('Date:', dateStr));
  b.separator();

  // ── Patient info ─────────────────────────────────────────────────────────
  b.bold(true).line('PATIENT INFORMATION').bold(false);
  b.line(padLine('Name:', data.patientName));
  b.line(padLine('Patient ID:', data.patientId));
  if (data.patientAge) b.line(padLine('Age:', data.patientAge));
  if (data.patientGender) b.line(padLine('Sex:', data.patientGender));
  if (data.patientPhone) b.line(padLine('Phone:', data.patientPhone));
  b.separator();

  // ── Tests ────────────────────────────────────────────────────────────────
  b.bold(true).line('TESTS ORDERED').bold(false);
  for (const test of data.tests) {
    // Code + short name on first line
    const nameTrunc =
      test.name.length > LINE_WIDTH - test.code.length - 3
        ? test.name.slice(0, LINE_WIDTH - test.code.length - 3 - 2) + '..'
        : test.name;
    b.line(`${test.code}  ${nameTrunc}`);
    b.line(padLine('', formatCurrency(test.price)));
  }
  b.separator();

  // ── Totals ───────────────────────────────────────────────────────────────
  b.line(padLine('Subtotal:', formatCurrency(data.subtotal)));
  if (data.discount > 0) {
    const discLabel =
      data.discountType === 'percentage'
        ? `Discount (${data.discount}%):`
        : 'Discount:';
    b.line(padLine(discLabel, `-${formatCurrency(discountAmount)}`));
  }
  b.bold(true);
  b.line(padLine('TOTAL:', formatCurrency(data.total)));
  b.bold(false);
  b.separator('=');

  // ── Payment ──────────────────────────────────────────────────────────────
  b.line(padLine('Payment Method:', data.paymentMethod.replace('-', ' ').toUpperCase()));
  b.line(padLine('Amount Paid:', formatCurrency(data.amountPaid)));
  if (data.amountPaid > data.total) {
    b.line(padLine('Change:', formatCurrency(data.amountPaid - data.total)));
  }
  b.line(padLine('Cashier:', data.cashier));
  b.separator();

  // ── Instructions ─────────────────────────────────────────────────────────
  if (copyType === 'patient') {
    b.bold(true).line('INSTRUCTIONS').bold(false);
    b.line('* Keep this receipt for sample collection');
    b.line('* Arrive 15 minutes before scheduled time');
    if (data.collectionDate) b.line(`* Collection: ${data.collectionDate}`);
    b.line('* Results ready within 24-48 hours');
  } else {
    b.bold(true).line('LAB TECHNICIAN NOTES').bold(false);
    b.line('* Verify patient ID before collection');
    b.line('* Check test requirements and prep');
    b.line('* Label all samples with order number');
    b.line('* Update system after collection');
  }
  b.separator();

  // ── Footer ───────────────────────────────────────────────────────────────
  b.align('center');
  b.bold(true).line('THANK YOU FOR CHOOSING US!').bold(false);
  b.line('Open 24/7  |  Onsite & Online Access');
  b.line('Trusted by Clinics & Hospitals');
  b.line(' ');
  b.line(`*** ${data.orderNumber} ***`);
  b.line(' ');
  b.line(`Printed: ${new Date().toLocaleString('en-GB')}`);

  b.feed(4);
  b.cut();

  return b.build();
}
