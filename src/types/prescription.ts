export enum PrescriptionStatusEnum {
  PENDING = 'pending',
  DISPENSED = 'dispensed',
  CANCELLED = 'cancelled',
}

export interface PrescriptionItem {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

export interface Prescription {
  _id: string;
  prescriptionNumber: string;
  patientId: {
    _id: string;
    patientId: string;
    firstName: string;
    lastName: string;
  };
  consultationId: {
    _id: string;
    consultationNumber: string;
  };
  doctorId: {
    _id: string;
    fullName: string;
  };
  items: PrescriptionItem[];
  status: PrescriptionStatusEnum;
  notes?: string;
  dispensedBy?: {
    _id: string;
    fullName: string;
  };
  dispensedAt?: string;
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
}
