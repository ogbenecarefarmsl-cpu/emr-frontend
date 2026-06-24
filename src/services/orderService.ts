import api from './api';

export const orderService = {
  async findByPatient(patientId: string): Promise<any[]> {
    const response = await api.get('/orders', {
      params: { patientId },
    });
    const data = response.data;
    return Array.isArray(data) ? data : data?.data || [];
  },

  async findById(id: string): Promise<any> {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  async findByPatientDetailed(patientId: string): Promise<any[]> {
    const response = await api.get('/orders', {
      params: { patientId, includeResults: true },
    });
    const data = response.data;
    return Array.isArray(data) ? data : data?.data || [];
  },
};
