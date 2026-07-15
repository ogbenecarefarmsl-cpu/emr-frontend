import api from './api';
import { SoapNoteTypeEnum } from '@/types/soap-note';

export const soapNoteService = {
  async create(data: {
    patientId: string;
    consultationId?: string;
    visitId?: string;
    doctorId?: string;
    noteType?: SoapNoteTypeEnum;
    chiefComplaint?: string;
    historyPresentIllness?: string;
    reviewOfSystems?: string;
    vitalSigns?: any;
    physicalExamination?: string;
    laboratoryResults?: string;
    assessment?: string;
    diagnosis?: string;
    treatmentPlan?: string;
    medications?: string;
    followUpInstructions?: string;
    nurseId?: string;
  }): Promise<any> {
    const response = await api.post('/soap-notes', data);
    return response.data;
  },

  async findAll(): Promise<any[]> {
    const response = await api.get('/soap-notes');
    return response.data;
  },

  async findById(id: string): Promise<any> {
    const response = await api.get(`/soap-notes/${id}`);
    return response.data;
  },

  async findByPatient(patientId: string): Promise<any[]> {
    const response = await api.get(`/soap-notes/patient/${patientId}`);
    return response.data;
  },

  async findByConsultation(consultationId: string): Promise<any[]> {
    const response = await api.get(`/soap-notes/consultation/${consultationId}`);
    return response.data;
  },

  async findByVisit(visitId: string): Promise<any[]> {
    const response = await api.get(`/soap-notes/visit/${visitId}`);
    return response.data;
  },

  async update(id: string, data: any): Promise<any> {
    const response = await api.patch(`/soap-notes/${id}`, data);
    return response.data;
  },

  async sign(id: string): Promise<any> {
    const response = await api.patch(`/soap-notes/${id}/sign`);
    return response.data;
  },

  async createAddendum(id: string, text: string): Promise<any> {
    const response = await api.post(`/soap-notes/${id}/addenda`, { text });
    return response.data;
  },
};
