import api from './api';
import type { TreatmentPlan, CreateTreatmentPlanInput } from '@/types/treatment-plan';

export const treatmentPlanService = {
  async create(data: CreateTreatmentPlanInput): Promise<TreatmentPlan> {
    const response = await api.post('/treatment-plans', data);
    return response.data;
  },

  async findAll(): Promise<TreatmentPlan[]> {
    const response = await api.get('/treatment-plans');
    return response.data;
  },

  async findById(id: string): Promise<TreatmentPlan> {
    const response = await api.get(`/treatment-plans/${id}`);
    return response.data;
  },

  async getSent(): Promise<TreatmentPlan[]> {
    const response = await api.get('/treatment-plans/sent');
    return response.data;
  },

  async getForPatient(patientId: string): Promise<TreatmentPlan[]> {
    const response = await api.get(`/treatment-plans/patient/${patientId}`);
    return response.data;
  },

  async getForVisit(visitId: string): Promise<TreatmentPlan[]> {
    const response = await api.get(`/treatment-plans/visit/${visitId}`);
    return response.data;
  },

  async sendToReception(id: string): Promise<TreatmentPlan> {
    const response = await api.post(`/treatment-plans/${id}/send`);
    return response.data;
  },

  async markPrinted(id: string): Promise<TreatmentPlan> {
    const response = await api.post(`/treatment-plans/${id}/print`);
    return response.data;
  },

  async cancel(id: string): Promise<TreatmentPlan> {
    const response = await api.delete(`/treatment-plans/${id}`);
    return response.data;
  },
};
