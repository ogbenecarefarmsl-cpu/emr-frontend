export enum PaymentTypeEnum {
  LAB_ORDER = 'lab_order',
  CONSULTATION = 'consultation',
  PRESCRIPTION = 'prescription',
  OTHER = 'other',
}

export interface Payment {
  _id: string;
  paymentType: PaymentTypeEnum;
  amount: number;
  paymentMethod: string;
  orderId?: string;
  consultationId?: string;
  prescriptionId?: string;
  receivedBy?: {
    _id: string;
    fullName: string;
  };
  notes?: string;
  isRefunded: boolean;
  refundReason?: string;
  createdAt: string;
  updatedAt: string;
}
