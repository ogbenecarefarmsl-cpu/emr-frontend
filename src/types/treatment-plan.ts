export type TreatmentPlanItemType = 'drug' | 'iv' | 'lab' | 'procedure' | 'other';
export type TreatmentPlanStatus = 'draft' | 'sent_to_reception' | 'paid' | 'completed' | 'cancelled';
export type TreatmentPlanPaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface TreatmentPlanItem {
  type: TreatmentPlanItemType;
  description: string;
  amount: number;
  refId?: string;
}

export interface TreatmentPlanPatient {
  _id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  age?: number;
  gender?: string;
}

export interface TreatmentPlanVisit {
  _id: string;
  visitNumber: string;
  status: string;
}

export interface TreatmentPlanCreator {
  _id: string;
  fullName: string;
  role?: string;
}

export interface TreatmentPlan {
  _id: string;
  planNumber: string;
  patientId: TreatmentPlanPatient;
  visitId?: TreatmentPlanVisit;
  createdBy: TreatmentPlanCreator;
  createdByName: string;
  createdByRole: string;
  status: TreatmentPlanStatus;
  prescriptionIds: any[];
  orderIds: any[];
  items: TreatmentPlanItem[];
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentStatus: TreatmentPlanPaymentStatus;
  notes?: string;
  sentToReceptionAt?: string;
  printedAt?: string;
  printedBy?: { _id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTreatmentPlanItemInput {
  type: TreatmentPlanItemType;
  medicationId?: string;
  medicationName?: string;
  strengthPerDose?: string;
  dosesPerDay?: number;
  durationDays?: number;
  route?: string;
  testCode?: string;
  testName?: string;
  testPrice?: number;
  testId?: string;
  description?: string;
  amount?: number;
  notes?: string;
}

export interface CreateTreatmentPlanInput {
  patientId: string;
  visitId?: string;
  items: CreateTreatmentPlanItemInput[];
  notes?: string;
}
