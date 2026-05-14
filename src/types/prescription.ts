export enum PrescriptionStatusEnum {
  PENDING = 'pending',
  DISPENSED = 'dispensed',
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
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  route?: RouteOfAdministrationEnum;
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
  doctorId: {
    _id: string;
    fullName: string;
  };
  items: PrescriptionItem[];
  status: PrescriptionStatusEnum;
  /** General notes from doctor — visible to pharmacist and patient */
  notes?: string;
  /** Pharmacist's dispensing notes — added at dispense time */
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
  createdAt: string;
  updatedAt: string;
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
  reorderLevel?: number;
  expiryDate?: string;
}
