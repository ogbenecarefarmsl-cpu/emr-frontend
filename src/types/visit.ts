export type VisitStatus =
  | 'waiting_payment'
  | 'in_queue'
  | 'in_consultation'
  | 'awaiting_lab'
  | 'awaiting_pharmacy'
  | 'awaiting_results'
  | 'results_ready'
  | 'completed'
  | 'cancelled';

export type VisitType = 'new' | 'follow_up' | 'emergency';

export interface Visit {
  id: string;
  _id?: string;
  visitNumber: string;
  patientId: string | Patient;
  doctorId?: string | Doctor;
  visitType: VisitType;
  status: VisitStatus;
  consultationFee: number;
  consultationPaid: boolean;
  consultationOrderId?: string;
  chiefComplaint?: string;
  notes?: string;
  registeredBy?: string;
  checkedInAt?: string;
  consultationStartedAt?: string;
  consultationCompletedAt?: string;
  dischargedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id?: string;
  _id?: string;
  patientId: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  phone?: string;
  email?: string;
}

export interface Doctor {
  id?: string;
  _id?: string;
  fullName: string;
  phone?: string;
  facility?: string;
}

export interface CreateVisitDto {
  patientId: string;
  doctorId?: string;
  visitType?: VisitType;
  consultationFee: number;
  chiefComplaint?: string;
  notes?: string;
}

export interface UpdateVisitDto {
  doctorId?: string;
  status?: VisitStatus;
  visitType?: VisitType;
  consultationPaid?: boolean;
  consultationOrderId?: string;
  chiefComplaint?: string;
  notes?: string;
}

export interface VisitStats {
  totalVisits: number;
  waitingPayment: number;
  inQueue: number;
  inConsultation: number;
  awaitingLab: number;
  awaitingPharmacy: number;
  completed: number;
}
