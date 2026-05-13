import api from './api';
import { PaymentTypeEnum } from '@/types/payment';

export const paymentService = {
  async create(data: {
    paymentType: PaymentTypeEnum;
    amount: number;
    paymentMethod: string;
    orderId?: string;
    consultationId?: string;
    prescriptionId?: string;
    receivedBy: string;
    notes?: string;
  }): Promise<any> {
    const response = await api.post('/payments', data);
    return response.data;
  },

  async findByOrder(orderId: string): Promise<any[]> {
    const response = await api.get(`/payments/order/${orderId}`);
    return response.data;
  },

  async findByConsultation(consultationId: string): Promise<any[]> {
    const response = await api.get(`/payments/consultation/${consultationId}`);
    return response.data;
  },

  async findByPrescription(prescriptionId: string): Promise<any[]> {
    const response = await api.get(`/payments/prescription/${prescriptionId}`);
    return response.data;
  },

  async refund(paymentId: string, reason: string): Promise<any> {
    const response = await api.patch(`/payments/${paymentId}/refund`, {
      reason,
    });
    return response.data;
  },
};
