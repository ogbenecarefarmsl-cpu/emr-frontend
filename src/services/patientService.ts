import api from './api';

export const patientService = {
  async getById(id: string): Promise<any> {
    const response = await api.get(`/patients/${id}`);
    return response.data;
  },

  async getChart(id: string): Promise<any> {
    const response = await api.get(`/patients/${id}/chart`);
    return response.data;
  },

  async search(query: string): Promise<any[]> {
    const response = await api.get('/patients/search', {
      params: { q: query },
    });
    return response.data;
  },

  async update(id: string, data: any): Promise<any> {
    const response = await api.patch(`/patients/${id}`, data);
    return response.data;
  },
};
