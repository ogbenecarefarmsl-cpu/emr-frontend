import api from './api';
import { QueueStatusEnum, PriorityLevelEnum } from '@/types/queue';

export const queueService = {
  async addToQueue(data: {
    patientId: string;
    consultationId?: string;
    priority?: PriorityLevelEnum;
    notes?: string;
  }): Promise<any> {
    const response = await api.post('/queue', data);
    return response.data;
  },

  async getQueue(status?: QueueStatusEnum): Promise<any[]> {
    const response = await api.get('/queue', {
      params: status ? { status } : {},
    });
    return response.data;
  },

  async findById(id: string): Promise<any> {
    const response = await api.get(`/queue/${id}`);
    return response.data;
  },

  async updateStatus(id: string, status: QueueStatusEnum, userId?: string): Promise<any> {
    const response = await api.patch(`/queue/${id}/status`, {
      status,
      userId,
    });
    return response.data;
  },

  async removeFromQueue(id: string, reason: string, cancelledBy: string): Promise<any> {
    const response = await api.patch(`/queue/${id}/remove`, {
      reason,
      cancelledBy,
    });
    return response.data;
  },

  async reorderQueue(queueIds: string[]): Promise<void> {
    await api.patch('/queue/reorder', { queueIds });
  },
};
