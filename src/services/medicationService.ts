import api from './api';
import { MedicationCategoryEnum } from '@/types/medication';

export const medicationService = {
  async create(data: {
    medicationCode: string;
    name: string;
    genericName: string;
    category?: MedicationCategoryEnum;
    description?: string;
    dosageForm?: string;
    strength?: string;
    manufacturer?: string;
    stockQuantity?: number;
    unit?: string;
    unitPrice?: number;
    reorderLevel?: number;
    batchNumber?: string;
    expiryDate?: Date;
  }): Promise<any> {
    const response = await api.post('/medications', data);
    return response.data;
  },

  async findAll(category?: MedicationCategoryEnum, lowStock?: boolean): Promise<any[]> {
    const response = await api.get('/medications', {
      params: {
        ...(category && { category }),
        ...(lowStock && { lowStock: true }),
      },
    });
    return response.data;
  },

  async search(searchTerm: string): Promise<any[]> {
    const response = await api.get('/medications/search', {
      params: { q: searchTerm },
    });
    return response.data;
  },

  async findById(id: string): Promise<any> {
    const response = await api.get(`/medications/${id}`);
    return response.data;
  },

  async update(id: string, data: any): Promise<any> {
    const response = await api.patch(`/medications/${id}`, data);
    return response.data;
  },

  async updateStock(id: string, quantity: number, operation: 'add' | 'subtract'): Promise<any> {
    const response = await api.patch(`/medications/${id}/stock`, {
      quantity,
      operation,
    });
    return response.data;
  },

  async getInventoryReport(): Promise<any> {
    const response = await api.get('/medications/report');
    return response.data;
  },

  async deactivate(id: string): Promise<any> {
    const response = await api.delete(`/medications/${id}`);
    return response.data;
  },
};
