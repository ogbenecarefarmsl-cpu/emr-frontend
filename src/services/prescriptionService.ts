import api from './api';
import { Prescription, RouteOfAdministrationEnum } from '@/types/prescription';

export interface CreatePrescriptionItemInput {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  route?: RouteOfAdministrationEnum;
  /** Patient-facing label text. If omitted, backend auto-generates from dosage+frequency+duration+route */
  instructions?: string;
  /** Internal pharmacist note — not printed on label */
  pharmacistNote?: string;
}

export interface CreatePrescriptionInput {
  patientId: string;
  consultationId?: string;
  visitId?: string;
  doctorId: string;
  items: CreatePrescriptionItemInput[];
  /** General notes from doctor — visible to pharmacist and patient */
  notes?: string;
  totalAmount?: number;
}

export const prescriptionService = {
  async create(data: CreatePrescriptionInput): Promise<Prescription> {
    const response = await api.post('/prescriptions', data);
    return response.data;
  },

  async findAll(): Promise<Prescription[]> {
    const response = await api.get('/prescriptions');
    return response.data;
  },

  async findById(id: string): Promise<Prescription> {
    const response = await api.get(`/prescriptions/${id}`);
    return response.data;
  },

  async findByPatient(patientId: string): Promise<Prescription[]> {
    const response = await api.get(`/prescriptions/patient/${patientId}`);
    return response.data;
  },

  async findPendingPayment(): Promise<Prescription[]> {
    const response = await api.get('/prescriptions/pending-payment');
    return response.data;
  },

  async findPendingDispense(): Promise<Prescription[]> {
    const response = await api.get('/prescriptions/pending-dispense');
    return response.data;
  },

  /**
   * Dispense a prescription.
   * dispensedBy is read from the JWT on the backend — do not send it in the body.
   * dispensingNotes is the pharmacist's internal note added at dispense time.
   */
  async dispense(id: string, dispensingNotes?: string): Promise<Prescription> {
    const response = await api.patch(`/prescriptions/${id}/dispense`, {
      ...(dispensingNotes ? { dispensingNotes } : {}),
    });
    return response.data;
  },

  async markAsPaid(id: string): Promise<Prescription> {
    const response = await api.patch(`/prescriptions/${id}/mark-paid`);
    return response.data;
  },

  async cancel(id: string, reason: string): Promise<Prescription> {
    const response = await api.patch(`/prescriptions/${id}/cancel`, { reason });
    return response.data;
  },
};
