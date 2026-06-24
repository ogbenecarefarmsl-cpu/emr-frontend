/**
 * ESC/POS command builder for 80mm thermal receipt printers (e.g. Xprinter XT-80P).
 *
 * Line width at normal font on 80mm paper is approximately 42 characters.
 * ESC/POS reference: https://reference.epson-biz.com/modules/ref_escpos/index.php
 */

const ESC = 0x1b;
const GS  = 0x1d;

export const LINE_WIDTH = 42;
export const LINE_WIDTH_58 = 32;

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
  paymentMethod: 'cash' | 'orange_money' | 'afrimoney' | 'wallet';
  paymentDate: string;
  cashier: string;
  collectionDate?: string;
  /** Optional branch letterhead. If omitted, falls back to generic placeholder. */
  branch?: BranchHeaderData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Branch letterhead data. Pulled from the user's assigned branch in
 * the DB (via useMyBranch hook) so every receipt prints the right
 * outlet address/phone/email. Falls back to generic strings if null.
 */
export interface BranchHeaderData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  tagline?: string;
  website?: string;
  operatingHours?: string;
  footerText?: string;
}

export const FALLBACK_BRANCH: BranchHeaderData = {
  name: 'Harbour Medical Diagnostic',
  address: '555, Bai Bureh Road, Allen Town',
  phone: '+23275405804',
  email: 'harbourmedicaldiagnostics@gmail.com',
  footerText: 'Thank you for choosing us! | Open 6 days/week | Lab & Pharmacy under one roof',
};

/**
 * Build the ESC/POS header (centered) from a branch object.
 * Use this when you have the branch in memory (e.g. you called useMyBranch
 * already). For a sync fallback use buildGenericHeaderESCPOS.
 */
export function buildBranchHeaderESCPOS(b: EscPosBuilder, branch: BranchHeaderData | null | undefined) {
  const data = branch || FALLBACK_BRANCH;
  b.init();
  b.align('center');
  b.bold(true);
  b.line(data.name.toUpperCase());
  b.bold(false);
  if (data.address) b.line(data.address);
  if (data.phone) b.line(`Tel: ${data.phone}`);
  b.separator('=');
}

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

/** Wrap text to fit within width, breaking at spaces. */
function wrapText(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text.slice(0, width)];
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
    const sanitized = str
      .replace(/\u2014/g, '-')   // em-dash → hyphen
      .replace(/\u2013/g, '-')   // en-dash → hyphen
      .replace(/\u2018/g, "'")   // left single quote → apostrophe
      .replace(/\u2019/g, "'")   // right single quote → apostrophe
      .replace(/\u201C/g, '"')   // left double quote → straight quote
      .replace(/\u201D/g, '"')   // right double quote → straight quote
      .replace(/\u2026/g, '...') // ellipsis → three dots
      .replace(/\u00B0/g, 'deg') // degree symbol → "deg"
      .replace(/\u00A0/g, ' ')   // non-breaking space → space
      .replace(/\u2022/g, '*')   // bullet → asterisk
      .replace(/\u2010/g, '-')   // hyphen → hyphen
      .replace(/\u2011/g, '-')   // non-breaking hyphen
      .replace(/\u2012/g, '-')   // figure dash
      .replace(/\u00E9/g, 'e')   // e-acute → e
      .replace(/[^\x00-\x7E]/g, '?'); // anything else → ?
    const encoded = new TextEncoder().encode(sanitized);
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
 * Pass `branch` to print the user's assigned branch letterhead; if
 * omitted, falls back to a generic placeholder.
 */
export function buildTestReceiptESCPOS(): Uint8Array {
  const b = new EscPosBuilder();
  const now = new Date();

  b.init();
  b.align('center');
  b.bold(true);
  b.fontSize(1);
  b.line('PRINTER TEST');
  b.fontSize(0);
  b.bold(false);
  b.separator();

  b.align('left');
  b.line(`Time: ${now.toLocaleTimeString('en-GB')}`);
  b.line(`Date: ${now.toLocaleDateString('en-GB')}`);
  b.separator();

  b.align('center');
  b.bold(true);
  b.line('TEST SUCCESSFUL');
  b.bold(false);
  b.line('Printer is working correctly');

  b.feed(2);
  b.cut();

  return b.build();
}

export function buildReceiptESCPOS(
  data: ReceiptData,
  copyType: 'patient' | 'lab',
  branch?: BranchHeaderData | null
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

  // ── Header (branch letterhead from DB) ──────────────────────────────────
  buildBranchHeaderESCPOS(b, branch);

  // ── Copy type ────────────────────────────────────────────────────────────
  b.bold(true);
  b.line(center(copyType === 'patient' ? '*** PATIENT COPY ***' : '*** LAB COPY ***'));
  b.bold(false);

  // ── Receipt info ─────────────────────────────────────────────────────────
  b.align('left');
  b.line(padLine('Receipt:', data.receiptNumber));
  b.line(padLine('Order:', data.orderNumber));
  b.line(padLine('Date:', dateStr));

  // ── Patient info ─────────────────────────────────────────────────────────
  b.line(padLine('Patient:', data.patientName));
  b.line(padLine('ID:', data.patientId));
  if (data.patientAge) b.line(padLine('Age:', data.patientAge));
  if (data.patientGender) b.line(padLine('Sex:', data.patientGender));

  // ── Tests ────────────────────────────────────────────────────────────────
  for (const test of data.tests) {
    const nameTrunc =
      test.name.length > LINE_WIDTH - test.code.length - 3
        ? test.name.slice(0, LINE_WIDTH - test.code.length - 3 - 2) + '..'
        : test.name;
    b.line(`${test.code}  ${nameTrunc}`);
    b.line(padLine('', formatCurrency(test.price)));
  }
  b.separator('=');

  // ── Totals ───────────────────────────────────────────────────────────────
  b.bold(true);
  b.line(padLine('TOTAL:', formatCurrency(data.total)));
  b.bold(false);
  b.line(padLine('Paid:', formatCurrency(data.amountPaid)));
  b.line(padLine('Method:', data.paymentMethod.replace('-', ' ').toUpperCase()));
  b.separator('=');

  // ── Footer ───────────────────────────────────────────────────────────────
  b.align('center');
  b.line(`*** ${data.orderNumber} ***`);
  b.line(`Printed: ${new Date().toLocaleString('en-GB')}`);

  b.feed(2);
  b.cut();

  return b.build();
}

// ── Treatment Plan (58mm thermal) ────────────────────────────────────────────

export interface TreatmentPlanEscPosData {
  planNumber: string;
  patientName: string;
  patientId: string;
  patientAge?: string;
  patientGender?: string;
  patientPhone?: string;
  visitNumber?: string;
  items: Array<{
    type: string;
    description: string;
    amount: number;
  }>;
  totalAmount: number;
  amountPaid?: number;
  balance?: number;
  paymentStatus?: string;
  notes?: string;
  printedAt?: string;
}

function padLine58(label: string, value: string, width = LINE_WIDTH_58): string {
  const spaces = width - label.length - value.length;
  return spaces > 0 ? label + ' '.repeat(spaces) + value : `${label} ${value}`;
}

function wrapText58(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text.slice(0, width)];
}

export function buildTreatmentPlanESCPOS(
  data: TreatmentPlanEscPosData,
  branch?: BranchHeaderData | null,
): Uint8Array {
  const b = new EscPosBuilder();
  const w = LINE_WIDTH_58;

  // ── Header (branch letterhead) ─────────────────────────────────────────
  buildBranchHeaderESCPOS(b, branch);

  // ── Title ──────────────────────────────────────────────────────────────
  b.bold(true);
  b.align('center');
  b.line(center('TREATMENT PLAN', w));
  b.bold(false);
  b.separator('-');

  // ── Plan + Patient info ────────────────────────────────────────────────
  b.align('left');
  b.line(padLine58('Plan:', data.planNumber));
  b.line(padLine58('Date:', new Date().toLocaleString('en-GB')));
  if (data.visitNumber) b.line(padLine58('Visit:', data.visitNumber));
  b.line(padLine58('Patient:', data.patientName));
  b.line(padLine58('ID:', data.patientId));
  if (data.patientAge || data.patientGender) {
    const ageSex = [data.patientAge, data.patientGender].filter(Boolean).join('/');
    b.line(padLine58('Age/Sex:', ageSex));
  }
  b.separator('-');

  // ── Items ──────────────────────────────────────────────────────────────
  data.items.forEach((item, idx) => {
    const typeBadge = item.type.toUpperCase().padEnd(4);
    const num = `${idx + 1}.`;
    const descLines = wrapText58(item.description, w - 2);
    b.line(`${num} [${typeBadge}] ${descLines[0] || ''}`);
    for (let i = 1; i < descLines.length; i++) {
      b.line(`   ${descLines[i]}`);
    }
    b.line(padLine58('   ', formatCurrency58(item.amount)));
  });
  b.separator('-');

  // ── Total + Payment ────────────────────────────────────────────────────
  b.bold(true);
  b.line(padLine58('TOTAL:', formatCurrency58(data.totalAmount)));
  b.bold(false);
  if ((data.amountPaid || 0) > 0) {
    b.line(padLine58('PAID:', formatCurrency58(data.amountPaid)));
  }
  if ((data.balance || 0) > 0) {
    b.line(padLine58('BALANCE:', formatCurrency58(data.balance)));
  }
  b.separator('-');

  b.feed(2);
  b.cut();

  return b.build();
}

function formatCurrency58(n: number): string {
  return `Le ${n.toLocaleString('en-US')}`;
}

// ── Visit Receipt ─────────────────────────────────────────────────────────────

export interface VisitReceiptEscPosData {
  visitNumber: string;
  patientName: string;
  patientId: string;
  serviceLabel: string;
  procedureType?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  cashier: string;
}

export function buildVisitReceiptESCPOS(
  data: VisitReceiptEscPosData,
  branch?: BranchHeaderData | null,
): Uint8Array {
  const b = new EscPosBuilder();
  const dateStr = new Date(data.paymentDate).toLocaleDateString('en-GB') +
    ' ' + new Date(data.paymentDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  buildBranchHeaderESCPOS(b, branch);

  b.bold(true);
  b.align('center');
  b.line(center('VISIT FEE RECEIPT'));
  b.bold(false);

  b.align('left');
  b.line(padLine('Visit:', data.visitNumber));
  b.line(padLine('Date:', dateStr));
  b.line(padLine('Patient:', data.patientName));
  b.line(padLine('ID:', data.patientId));
  b.line(padLine('Type:', data.serviceLabel));
  if (data.procedureType) b.line(padLine('Procedure:', data.procedureType));
  b.separator('=');

  b.bold(true);
  b.line(padLine('TOTAL PAID:', formatCurrency(data.amount)));
  b.bold(false);
  b.line(padLine('Method:', data.paymentMethod.toUpperCase()));
  b.separator('=');

  b.align('center');
  b.line(`Printed: ${new Date().toLocaleString('en-GB')}`);

  b.feed(2);
  b.cut();

  return b.build();
}

// ── Prescription Receipt ──────────────────────────────────────────────────────

export interface PrescriptionReceiptEscPosData {
  prescriptionNumber: string;
  patientName: string;
  patientId: string;
  dispenseDate: string;
  status: string;
  items: Array<{
    medicationName: string;
    strengthPerDose?: string;
    dosesPerDay?: number;
    durationDays?: number;
    instructions?: string;
    dispensedSellUnits?: number;
    priceAtDispense?: number;
    lineTotalAtDispense?: number;
    dispenseMode?: string;
    dispensedPackName?: string;
  }>;
  totalAmount: number;
  actualTotalAmount?: number;
  isPaid: boolean;
}

export function buildPrescriptionReceiptESCPOS(
  data: PrescriptionReceiptEscPosData,
  branch?: BranchHeaderData | null,
): Uint8Array {
  const b = new EscPosBuilder();

  buildBranchHeaderESCPOS(b, branch);

  b.bold(true);
  b.align('center');
  b.line(center('PRESCRIPTION'));
  b.bold(false);

  b.align('left');
  b.line(padLine('Rx No:', data.prescriptionNumber));
  b.line(padLine('Date:', data.dispenseDate));
  b.line(padLine('Patient:', data.patientName));
  b.line(padLine('ID:', data.patientId));

  data.items.forEach((item, i) => {
    b.line(`${i + 1}. ${item.medicationName}`);
    if (item.strengthPerDose) {
      b.line(`   ${item.strengthPerDose}, ${item.dosesPerDay}x/day, ${item.durationDays}d`);
    }
    if (item.lineTotalAtDispense != null) {
      b.line(`   ${item.dispensedSellUnits} x ${formatCurrency(item.priceAtDispense || 0)} = ${formatCurrency(item.lineTotalAtDispense)}`);
    }
  });
  b.separator('=');

  const total = data.actualTotalAmount || data.totalAmount;
  b.bold(true);
  b.line(padLine('TOTAL:', formatCurrency(total)));
  b.bold(false);
  b.line(padLine('Payment:', data.isPaid ? 'PAID' : 'UNPAID'));
  b.separator('=');

  b.feed(2);
  b.cut();

  return b.build();
}

// ── Walk-in Receipt ─────────────────────────────────────────────────────

export interface WalkInReceiptEscPosData {
  patientName: string;
  paymentMethod: string;
  cashier: string;
  items: Array<{ description: string; amount: number }>;
  total: number;
}

export function buildWalkInReceiptESCPOS(
  data: WalkInReceiptEscPosData,
  branch?: BranchHeaderData | null,
): Uint8Array {
  const b = new EscPosBuilder();
  const w = LINE_WIDTH_58;

  buildBranchHeaderESCPOS(b, branch);

  b.bold(true);
  b.align('center');
  b.line(center('WALK-IN SALE', w));
  b.bold(false);
  b.separator('-');

  b.align('left');
  b.line(padLine58('Customer:', data.patientName));
  b.line(padLine58('Date:', new Date().toLocaleString('en-GB')));
  b.separator('-');

  data.items.forEach((item, i) => {
    const descLines = wrapText58(item.description, w - 2);
    b.line(`${i + 1}. ${descLines[0] || ''}`);
    for (let j = 1; j < descLines.length; j++) {
      b.line(`   ${descLines[j]}`);
    }
    b.line(padLine58('   ', formatCurrency58(item.amount)));
  });
  b.separator('-');

  b.bold(true);
  b.line(padLine58('TOTAL:', formatCurrency58(data.total)));
  b.bold(false);
  b.line(padLine58('Method:', data.paymentMethod.toUpperCase()));
  b.line(padLine58('Cashier:', data.cashier));
  b.separator('-');

  b.feed(2);
  b.cut();

  return b.build();
}
