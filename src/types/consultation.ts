export enum ConsultationStatusEnum {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ConsultationTypeEnum {
  NEW = 'new',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
}

export interface Consultation {
  _id: string;
  consultationNumber: string;
  patientId: {
    _id: string;
    patientId: string;
    firstName: string;
    lastName: string;
  };
  doctorId: {
    _id: string;
    fullName: string;
  };
  consultationType: ConsultationTypeEnum;
  status: ConsultationStatusEnum;
  consultationFee: number;
  isPaid: boolean;
  chiefComplaint?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  vitalSigns?: {
    bloodPressure?: string;
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
  };
  nurseId?: {
    _id: string;
    fullName: string;
  };
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
