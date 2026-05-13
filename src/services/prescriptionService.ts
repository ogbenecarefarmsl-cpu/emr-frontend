import api from './api';
import { Prescription, PrescriptionStatusEnum } from '@/types/prescription';

export const prescriptionService = {
  async create(data: {
    patientId: string;
    consultationId?: string;
    visitId?: string;
    doctorId: string;
    items: Array<{
      medicationId: string;
      medicationName: string;
      dosage: string;
      frequency: string;
      duration: string;
      quantity: number;
      instructions?: string;
    }>;
    notes?: string;
    totalAmount?: number;
  }): Promise<Prescription> {
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

  async dispense(id: string, dispensedBy: string): Promise<Prescription> {
    const response = await api.patch(`/prescriptions/${id}/dispense`, {
      dispensedBy,
    });
    return response.data;
  },

  async markAsPaid(id: string): Promise<Prescription> {
    const response = await api.patch(`/prescriptions/${id}/mark-paid`);
    return response.data;
  },

  async cancel(id: string, reason: string, cancelledBy: string): Promise<Prescription> {
    const response = await api.patch(`/prescriptions/${id}/cancel`, {
      reason,
      cancelledBy,
    });
    return response.data;
  },
};
