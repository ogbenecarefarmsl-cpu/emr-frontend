export enum SoapNoteTypeEnum {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
  NURSE_NOTE = 'nurse_note',
}

export interface VitalSigns {
  bloodPressure?: string;
  temperature?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

export interface SoapNote {
  _id: string;
  branchId?: string;
  visitId?: string;
  addendumTo?: string;
  addendumText?: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    patientId: string;
  };
  consultationId: {
    _id: string;
    consultationNumber: string;
  };
  doctorId: {
    _id: string;
    fullName: string;
  };
  noteType: SoapNoteTypeEnum;
  
  // Subjective
  chiefComplaint?: string;
  historyPresentIllness?: string;
  reviewOfSystems?: string;
  
  // Objective
  vitalSigns?: VitalSigns;
  physicalExamination?: string;
  laboratoryResults?: string;
  radiologyResults?: string;
  
  // Assessment
  assessment?: string;
  diagnosis?: string;
  differentialDiagnosis?: string[];
  
  // Plan
  treatmentPlan?: string;
  medications?: string;
  followUpInstructions?: string;
  patientEducation?: string;
  
  nurseId?: {
    _id: string;
    fullName: string;
  };
  
  isSigned: boolean;
  signedAt?: string;
  signedBy?: {
    _id: string;
    fullName: string;
  };
  
  createdAt: string;
  updatedAt: string;
}
