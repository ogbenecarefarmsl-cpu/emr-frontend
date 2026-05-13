export enum QueueStatusEnum {
  WAITING = 'waiting',
  WITH_NURSE = 'with_nurse',
  WITH_DOCTOR = 'with_doctor',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PriorityLevelEnum {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface QueueEntry {
  _id: string;
  queueNumber: string;
  patientId: {
    _id: string;
    patientId: string;
    firstName: string;
    lastName: string;
  };
  consultationId?: {
    _id: string;
    consultationNumber: string;
  };
  status: QueueStatusEnum;
  priority: PriorityLevelEnum;
  queueOrder: number;
  nurseId?: {
    _id: string;
    fullName: string;
  };
  doctorId?: {
    _id: string;
    fullName: string;
  };
  nurseCalledAt?: string;
  doctorCalledAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
