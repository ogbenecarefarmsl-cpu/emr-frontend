import api from './api';
import { Consultation, ConsultationStatusEnum, ConsultationTypeEnum } from '@/types/consultation';

export const consultationService = {
  async create(data: {
    patientId: string;
    doctorId: string;
    consultationType: ConsultationTypeEnum;
    consultationFee: number;
    chiefComplaint?: string;
    nurseId?: string;
  }): Promise<Consultation> {
    const response = await api.post('/consultations', data);
    return response.data;
  },

  async findAll(status?: ConsultationStatusEnum): Promise<Consultation[]> {
    const response = await api.get('/consultations', {
      params: status ? { status } : {},
    });
    return response.data;
  },

  async findById(id: string): Promise<Consultation> {
    const response = await api.get(`/consultations/${id}`);
    return response.data;
  },

  async findByPatient(patientId: string): Promise<Consultation[]> {
    const response = await api.get(`/consultations/patient/${patientId}`);
    return response.data;
  },

  async update(id: string, data: Partial<Consultation>): Promise<Consultation> {
    const response = await api.patch(`/consultations/${id}`, data);
    return response.data;
  },

  async markAsPaid(id: string): Promise<Consultation> {
    const response = await api.patch(`/consultations/${id}/mark-paid`);
    return response.data;
  },

  async cancel(id: string, reason: string, cancelledBy: string): Promise<Consultation> {
    const response = await api.patch(`/consultations/${id}/cancel`, {
      reason,
      cancelledBy,
    });
    return response.data;
  },
};
