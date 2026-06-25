export enum PrescriptionStatusEnum {
  PENDING = 'pending',
  DISPENSED = 'dispensed',
  ADMINISTERING = 'administering',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RouteOfAdministrationEnum {
  ORAL = 'oral',
  SUBLINGUAL = 'sublingual',
  TOPICAL = 'topical',
  INTRAVENOUS = 'intravenous',
  INTRAMUSCULAR = 'intramuscular',
  SUBCUTANEOUS = 'subcutaneous',
  INHALATION = 'inhalation',
  RECTAL = 'rectal',
  OPHTHALMIC = 'ophthalmic',
  OTIC = 'otic',
  NASAL = 'nasal',
  OTHER = 'other',
}

export interface PrescriptionItem {
  medicationId: string | Medication;
  medicationName: string;
  // === Structured regimen (NEW) ===
  /** Strength per dose — e.g. "500mg", "1 tablet", "2 ampules" */
  strengthPerDose: string;
  /** Doses per day. 3 = "3x daily" */
  dosesPerDay: number;
  /** Duration in days. 7 = "1 week" */
  durationDays: number;
  /** Total in base units. Backend computes from above. */
  quantity: number;
  // === Legacy free-text (auto-generated from above) ===
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: RouteOfAdministrationEnum;
  // === Reception dispense data (filled at dispense time) ===
  dispenseMode?: 'individual' | 'pack';
  packSizeIndex?: number;
  dispensedPackName?: string;
  dispensedBaseUnits?: number;
  dispensedSellUnits?: number;
  priceAtDispense?: number;
  lineTotalAtDispense?: number;
  substituteForId?: string;
  substituteForName?: string;
  // === Doctor's notes (kept) ===
  /** Patient-facing label text — printed on dispensing label */
  instructions?: string;
  /** Internal pharmacist note — NOT printed on label */
  pharmacistNote?: string;
}

export interface Prescription {
  _id: string;
  prescriptionNumber: string;
  patientId: {
    _id: string;
    patientId: string;
    firstName: string;
    lastName: string;
    age?: number;
    gender?: string;
    allergies?: string[];
    phone?: string;
  };
  visitId?: string;
  consultationId?: {
    _id: string;
    consultationNumber: string;
  };
  /** External/referring doctor (optional, refs doctors collection) */
  doctorId?: {
    _id: string;
    fullName: string;
  };
  /** The system user (doctor/specialist) who wrote this prescription */
  prescribedBy?: {
    _id: string;
    fullName: string;
    email?: string;
    department?: string;
  };
  items: PrescriptionItem[];
  status: PrescriptionStatusEnum;
  notes?: string;
  dispensingNotes?: string;
  dispensedBy?: {
    _id: string;
    fullName: string;
  };
  dispensedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  isPaid: boolean;
  totalAmount?: number;
  /** Computed at dispense time from actual sell units × price */
  actualTotalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackSize {
  name: string;
  unit: string;
  unitsPerPack: number;
  sellingPrice: number;
  barcode?: string;
  isDefault?: boolean;
}

export interface Medication {
  _id: string;
  medicationCode: string;
  name: string;
  genericName: string;
  category?: string;
  dosageForm?: string;
  strength?: string;
  stockQuantity: number;
  unitPrice: number;
  unit?: string;
  /** Smallest indivisible unit — "tablet", "ampule", "ml" */
  baseUnit?: string;
  /** How the medication is sold: "individual", "pack", or "both" */
  sellMode?: 'individual' | 'pack' | 'both';
  /** Available pack variants (Box of 30, Strip of 10, etc.) */
  packSizes?: PackSize[];
  /** True if this medication is sourced from CAF (no local stock) */
  isCafSourced?: boolean;
  cafProductId?: string;
  reorderLevel?: number;
  expiryDate?: string;
}
