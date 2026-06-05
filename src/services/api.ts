import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getConfiguredApiBaseUrl } from './apiUrl';

const API_BASE_URL = getConfiguredApiBaseUrl();

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        setTokens(accessToken, newRefreshToken || refreshToken);

        // Update authorization header
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 2,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableCodes: ['ECONNABORTED', 'ERR_NETWORK', 'ETIMEDOUT'],
};

// Request deduplication - prevent duplicate in-flight requests
const pendingRequests = new Map<string, Promise<any>>();

function getRequestKey(config: InternalAxiosRequestConfig): string {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${JSON.stringify(config.data || {})}`;
}

// Retry interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError & { config: InternalAxiosRequestConfig & { _retryCount?: number } }) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    const retryCount = config._retryCount || 0;
    const isRetryable =
      RETRY_CONFIG.retryableCodes.includes(error.code || '') ||
      RETRY_CONFIG.retryableStatuses.includes(error.response?.status || 0);

    if (isRetryable && retryCount < RETRY_CONFIG.maxRetries) {
      config._retryCount = retryCount + 1;
      const delay = RETRY_CONFIG.retryDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user } = response.data;
    setTokens(accessToken, refreshToken);
    return { user, accessToken, refreshToken };
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  refreshToken: async () => {
    const refreshToken = getRefreshToken();
    const response = await api.post('/auth/refresh', { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = response.data;
    const tokenToPersist = newRefreshToken || refreshToken;
    if (tokenToPersist) {
      setTokens(accessToken, tokenToPersist);
    }
    return response.data;
  },
};

export const patientsAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/patients', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/patients/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/patients', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/patients/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/patients/${id}`);
  },

  search: async (query: string) => {
    const response = await api.get('/patients/search', { params: { q: query } });
    return response.data;
  },

  getOrders: async (id: string) => {
    const response = await api.get(`/patients/${id}/orders`);
    return response.data;
  },

  getResults: async (id: string) => {
    const response = await api.get(`/patients/${id}/results`);
    return response.data;
  },

  addNote: async (id: string, note: string) => {
    const response = await api.post(`/patients/${id}/notes`, { note });
    return response.data;
  },

  getWallet: async (id: string) => {
    const response = await api.get(`/patients/${id}/wallet`);
    return response.data;
  },

  getWalletTransactions: async (id: string, page?: number, limit?: number) => {
    const response = await api.get(`/patients/${id}/wallet/transactions`, { params: { page, limit } });
    return response.data;
  },

  depositWallet: async (id: string, amount: number, notes?: string, paymentMethod = 'cash') => {
    const response = await api.post(`/patients/${id}/wallet/deposit`, { amount, notes, paymentMethod });
    return response.data;
  },

  withdrawWallet: async (id: string, amount: number, notes?: string) => {
    const response = await api.post(`/patients/${id}/wallet/withdraw`, { amount, notes });
    return response.data;
  },
};

export const ordersAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/orders', { params });
    // Backend returns paginated data { data, total, page, limit }
    // Return just the data array for compatibility
    return response.data.data || response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/orders', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/orders/${id}`, data);
    return response.data;
  },

  cancel: async (id: string, reason: string) => {
    const response = await api.post(`/orders/${id}/cancel`, { reason });
    return response.data;
  },

  collect: async (id: string) => {
    const response = await api.post(`/orders/${id}/collect`);
    return response.data;
  },

  getPendingCollection: async () => {
    const response = await api.get('/orders/pending-collection');
    return response.data.data || response.data;
  },

  getPendingResults: async () => {
    const response = await api.get('/orders/pending-results');
    return response.data.data || response.data;
  },

  getPaymentStats: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/orders/stats/payment', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getDailyIncome: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/orders/stats/daily-income', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getTests: async (id: string) => {
    const response = await api.get(`/orders/${id}/tests`);
    return response.data;
  },

  syncToLis: async (id: string) => {
    const response = await api.post(`/orders/${id}/sync-lis`);
    return response.data;
  },

  retryFailedLisSync: async () => {
    const response = await api.post('/orders/retry-failed-lis-sync');
    return response.data;
  },

  getLisCatalog: async () => {
    const response = await api.get('/orders/lis-catalog');
    const payload = response.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [
      ...(Array.isArray(payload?.tests) ? payload.tests : []),
      ...(Array.isArray(payload?.panels) ? payload.panels : []),
    ];
  },

  syncLisPayment: async (id: string) => {
    const response = await api.post(`/orders/${id}/sync-lis-payment`);
    return response.data;
  },

  fetchLisResults: async (id: string) => {
    const response = await api.post(`/orders/${id}/fetch-lis-results`);
    return response.data;
  },

  addPayment: async (id: string, data: { amount: number; paymentMethod: string; notes?: string }) => {
    const response = await api.post(`/orders/${id}/payment`, data);
    return response.data;
  },

  getOutstandingBalances: async () => {
    const response = await api.get('/orders/stats/outstanding');
    return response.data;
  },

  getPaymentHistory: async (id: string) => {
    const response = await api.get(`/orders/${id}/payments`);
    return response.data;
  },

  assignDoctor: async (id: string, data: { doctorId?: string; referredByDoctor?: string }) => {
    const response = await api.post(`/orders/${id}/assign-doctor`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/orders/${id}`);
  },
};

export const paymentsAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/payments', { params });
    return response.data;
  },
};

export const doctorsAPI = {
  getAll: async (params?: { search?: string; activeOnly?: boolean }) => {
    const response = await api.get('/doctors', { params });
    return response.data;
  },
  getSpecialists: async (specialty?: string) => {
    const response = await api.get('/doctors/specialists', { params: specialty ? { specialty } : {} });
    return response.data;
  },
  create: async (data: { fullName: string; phone?: string; facility?: string; doctorType?: string; specialty?: string; licenseNumber?: string; isActive?: boolean }) => {
    const response = await api.post('/doctors', data);
    return response.data;
  },
  update: async (id: string, data: { fullName?: string; phone?: string; facility?: string; doctorType?: string; specialty?: string; licenseNumber?: string; isActive?: boolean }) => {
    const response = await api.patch(`/doctors/${id}`, data);
    return response.data;
  },
};

export const samplesAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/samples', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/samples/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/samples', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/samples/${id}`, data);
    return response.data;
  },

  reject: async (id: string, reason: string) => {
    const response = await api.post(`/samples/${id}/reject`, { reason });
    return response.data;
  },
};

export const resultsAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/results', { params });
    return response.data.results || response.data.data || response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/results/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/results', data);
    return response.data;
  },

  createBulk: async (data: any[]) => {
    const response = await api.post('/results/bulk', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/results/${id}`, data);
    return response.data;
  },

  verify: async (id: string) => {
    const response = await api.post(`/results/${id}/verify`);
    return response.data;
  },

  amend: async (id: string, newValue: string, reason: string) => {
    const response = await api.post(`/results/${id}/amend`, { newValue, reason });
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/results/${id}`);
  },

  getPendingVerification: async () => {
    const response = await api.get('/results/pending-verification');
    return response.data.results || response.data.data || response.data;
  },

  getCritical: async () => {
    const response = await api.get('/results/critical');
    return response.data.results || response.data.data || response.data;
  },
};

export const testCatalogAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/test-catalog', { params, timeout: 30000 });
    return response.data;
  },

  getActive: async () => {
    const response = await api.get('/test-catalog/active-with-panels');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/test-catalog/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/test-catalog', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/test-catalog/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/test-catalog/${id}`);
  },

  activate: async (id: string) => {
    const response = await api.patch(`/test-catalog/${id}/activate`);
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.patch(`/test-catalog/${id}/deactivate`);
    return response.data;
  },

  getPanels: async () => {
    const response = await api.get('/test-panels');
    return response.data;
  },

  createPanel: async (data: any) => {
    const response = await api.post('/test-panels', data);
    return response.data;
  },
};

export const machinesAPI = {
  getAll: async () => {
    const response = await api.get('/machines');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/machines/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/machines', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/machines/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/machines/${id}`);
  },

  getMaintenance: async (id: string) => {
    const response = await api.get(`/machines/${id}/maintenance`);
    return response.data;
  },

  addMaintenance: async (id: string, data: any) => {
    const response = await api.post(`/machines/${id}/maintenance`, data);
    return response.data;
  },

  testConnection: async (id: string) => {
    const response = await api.post(`/machines/${id}/test-connection`);
    return response.data;
  },

  getOnlineMachines: async () => {
    const response = await api.get('/machines/online');
    return response.data;
  },
};

export const usersAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data;
  },

  resetPassword: async (id: string, newPassword: string) => {
    const response = await api.patch(`/users/${id}/password`, { newPassword });
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/users/${id}`);
  },

  assignRole: async (id: string, role: string) => {
    const response = await api.post(`/users/${id}/roles`, { role });
    return response.data;
  },

  removeRole: async (id: string, role: string) => {
    await api.delete(`/users/${id}/roles/${role}`);
  },
};

export const reportsAPI = {
  getDashboard: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/reports/dashboard', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getTestVolume: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/reports/test-volume', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getTurnaroundTime: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/reports/turnaround-time', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getRevenue: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/reports/revenue', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getMachineUtilization: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/reports/machine-utilization', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getTestDistribution: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/reports/test-distribution', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getLabResultReport: async (orderId: string) => {
    const response = await api.get(`/reports/lab-results/${orderId}`);
    return response.data;
  },
};

export const auditAPI = {
  getLogs: async (params?: any) => {
    const response = await api.get('/audit/logs', { params });
    return response.data;
  },

  getLogById: async (id: string) => {
    const response = await api.get(`/audit/logs/${id}`);
    return response.data;
  },

  getLogsByUser: async (userId: string, params?: any) => {
    const response = await api.get(`/audit/logs/user/${userId}`, { params });
    return response.data;
  },

  getLogsByTable: async (tableName: string, params?: any) => {
    const response = await api.get(`/audit/logs/table/${tableName}`, { params });
    return response.data;
  },
};

export const qcAPI = {
  getSamples: async (params?: any) => {
    const response = await api.get('/qc/samples', { params });
    return response.data;
  },

  createSample: async (data: any) => {
    const response = await api.post('/qc/samples', data);
    return response.data;
  },

  getResults: async (params?: any) => {
    const response = await api.get('/qc/results', { params });
    return response.data;
  },

  createResult: async (data: any) => {
    const response = await api.post('/qc/results', data);
    return response.data;
  },

  getOutOfRangeResults: async (params?: any) => {
    const response = await api.get('/qc/results/out-of-range', { params });
    return response.data;
  },
};

export const communicationLogsAPI = {
  getLogs: async (params?: any) => {
    const response = await api.get('/hl7/logs', { params });
    return response.data;
  },

  getLogById: async (id: string) => {
    const response = await api.get(`/hl7/logs/${id}`);
    return response.data;
  },

  getUnmatchedResults: async () => {
    const response = await api.get('/hl7/unmatched-results');
    return response.data;
  },

  matchResult: async (resultIndex: number, orderId: string) => {
    const response = await api.post('/hl7/match-result', { resultIndex, orderId });
    return response.data;
  },

  rejectResult: async (index: number) => {
    const response = await api.post(`/hl7/reject-result/${index}`);
    return response.data;
  },

  sendOrderToMachine: async (orderId: string, machineId: string) => {
    const response = await api.post('/hl7/send-order', { orderId, machineId });
    return response.data;
  },

  restartListener: async (machineId: string) => {
    const response = await api.post(`/hl7/restart-listener/${machineId}`);
    return response.data;
  },

  getListenerStatus: async () => {
    const response = await api.get('/hl7/listener-status');
    return response.data;
  },
};

// Critical result notifications (use resultsAPI.getCritical() instead)
// Keeping for backward compatibility, but getUnacknowledged is duplicate of resultsAPI.getCritical
export const criticalResultsAPI = {
  getUnacknowledged: async () => {
    const response = await api.get('/results/critical');
    return response.data;
  },

  // Note: acknowledge endpoint does not exist in backend
  // Critical results should be handled through result verification workflow
};

export const reconciliationAPI = {
  getExpectedAmounts: async (date: string) => {
    const response = await api.get(`/reconciliation/expected/${date}`);
    return response.data;
  },

  getAll: async (status?: string) => {
    const response = await api.get('/reconciliation', {
      params: status ? { status } : {},
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/reconciliation/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/reconciliation', data);
    return response.data;
  },

  review: async (id: string, approved: boolean, notes?: string) => {
    const response = await api.post(`/reconciliation/${id}/review`, {
      approved,
      notes,
    });
    return response.data;
  },

  getPendingCount: async () => {
    const response = await api.get('/reconciliation/pending/count');
    return response.data;
  },

  getDailyReport: async (date: string) => {
    const response = await api.get(`/reconciliation/daily-report/${date}`);
    return response.data;
  },

  getDoctorReferralReport: async (params?: { startDate?: string; endDate?: string; doctor?: string; doctorId?: string }) => {
    const response = await api.get('/reconciliation/doctor-referral-report', { params });
    return response.data;
  },
};

export const expendituresAPI = {
  getAll: async (params?: { startDate?: string; endDate?: string; category?: string }) => {
    const response = await api.get('/expenditures', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/expenditures/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/expenditures', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/expenditures/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/expenditures/${id}`);
  },

  flag: async (id: string, reason: string) => {
    const response = await api.post(`/expenditures/${id}/flag`, { reason });
    return response.data;
  },

  unflag: async (id: string) => {
    const response = await api.post(`/expenditures/${id}/unflag`);
    return response.data;
  },

  getSummary: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/expenditures/summary', {
      params: { startDate, endDate },
    });
    return response.data;
  },
};

export const reportTemplatesAPI = {
  getAll: async () => {
    const response = await api.get('/report-templates');
    return response.data;
  },

  getDefault: async () => {
    const response = await api.get('/report-templates/default');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/report-templates/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/report-templates', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/report-templates/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/report-templates/${id}`);
  },

  setDefault: async (id: string) => {
    const response = await api.post(`/report-templates/${id}/set-default`);
    return response.data;
  },

  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await api.post('/report-templates/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export const settingsAPI = {
  getPrinterSettings: async () => {
    // Backend stores settings by key — printer settings are stored under 'printer'
    const response = await api.get('/settings/printer');
    return response.data?.value ?? response.data ?? null;
  },
  updatePrinterSettings: async (patch: Record<string, any>) => {
    // Backend uses POST /settings to upsert by key
    const response = await api.post('/settings', { key: 'printer', value: patch });
    return response.data;
  },
};

export const visitsAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/visits', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/visits/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/visits', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/visits/${id}`, data);
    return response.data;
  },

  getDoctorQueue: async (doctorId?: string) => {
    const response = await api.get('/visits/doctor-queue', {
      params: doctorId ? { doctorId } : {},
    });
    return response.data;
  },

  getDoctorDashboard: async () => {
    const response = await api.get('/visits/doctor-dashboard');
    return response.data;
  },

  getDoctorPatients: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get('/visits/doctor-patients', { params });
    return response.data;
  },

  getAwaitingLabPayment: async () => {
    const response = await api.get('/visits/awaiting-lab-payment');
    return response.data;
  },

  getAwaitingPharmacyPayment: async () => {
    const response = await api.get('/visits/awaiting-pharmacy-payment');
    return response.data;
  },

  getAwaitingTriage: async () => {
    const response = await api.get('/visits/awaiting-triage');
    return response.data;
  },

  completeTriage: async (id: string, data: any) => {
    const response = await api.patch(`/visits/${id}/triage`, data);
    return response.data;
  },

  addRapidTestResult: async (id: string, data: { testType: 'malaria' | 'typhoid'; result: 'positive' | 'negative'; parasiteCount?: number; antigen?: string; notes?: string }) => {
    const response = await api.patch(`/visits/${id}/rapid-test-result`, data);
    return response.data;
  },

  referToSpecialist: async (id: string, data: { specialistId: string; reason: string; notes?: string }) => {
    const response = await api.patch(`/visits/${id}/refer`, data);
    return response.data;
  },

  acceptReferral: async (id: string) => {
    const response = await api.patch(`/visits/${id}/accept-referral`);
    return response.data;
  },

  getStats: async (date?: string) => {
    const response = await api.get('/visits/stats', {
      params: date ? { date } : {},
    });
    return response.data;
  },

  getByPatient: async (patientId: string) => {
    const response = await api.get(`/visits/patient/${patientId}`);
    return response.data;
  },

  markConsultationPaid: async (id: string, paymentMethod = 'cash') => {
    const response = await api.patch(`/visits/${id}/mark-paid`, { paymentMethod });
    return response.data;
  },

  acceptPatient: async (id: string) => {
    const response = await api.patch(`/visits/${id}/accept`);
    return response.data;
  },

  resultsReleased: async (id: string) => {
    const response = await api.patch(`/visits/${id}/results-released`);
    return response.data;
  },

  complete: async (id: string) => {
    const response = await api.patch(`/visits/${id}/complete`);
    return response.data;
  },

  cancel: async (id: string, reason: string, cancelledBy: string) => {
    const response = await api.patch(`/visits/${id}/cancel`, { reason, cancelledBy });
    return response.data;
  },

  /**
   * Nurse assigns or reassigns a queued patient to a specific doctor.
   * PATCH /visits/:id/assign-doctor
   */
  assignDoctorFromQueue: async (id: string, doctorId: string) => {
    const response = await api.patch(`/visits/${id}/assign-doctor`, { doctorId });
    return response.data;
  },
};

export const pendingOrdersAPI = {
  getPendingClinical: async (orderType?: string) => {
    const response = await api.get('/orders/pending-clinical', {
      params: orderType ? { orderType } : {},
    });
    return response.data;
  },

  getLabQueue: async () => {
    const response = await api.get('/orders/lab-queue');
    return response.data;
  },

  getPharmacyQueue: async () => {
    const response = await api.get('/orders/pharmacy-queue');
    return response.data;
  },

  markAsPaid: async (id: string, paymentMethod: string) => {
    const response = await api.patch(`/orders/${id}/mark-paid`, { paymentMethod });
    return response.data;
  },
};

export const prescriptionsAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/prescriptions', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/prescriptions/${id}`);
    return response.data;
  },

  create: async (data: { visitId: string; patientId: string; items: any[] }) => {
    const response = await api.post('/prescriptions', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/prescriptions/${id}`, data);
    return response.data;
  },

  getPendingPayment: async () => {
    const response = await api.get('/prescriptions/pending-payment');
    return response.data;
  },

  getPendingDispense: async () => {
    const response = await api.get('/prescriptions/pending-dispense');
    return response.data;
  },

  dispense: async (id: string) => {
    const response = await api.post(`/prescriptions/${id}/dispense`);
    return response.data;
  },

  markAsPaid: async (id: string, paymentMethod: string) => {
    const response = await api.patch(`/prescriptions/${id}/mark-paid`, { paymentMethod });
    return response.data;
  },
};

export const adminAPI = {
  getDashboard: async (date?: string) => {
    const response = await api.get('/admin/dashboard', { params: date ? { date } : {} });
    return response.data;
  },
  getManagementKpis: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/management-kpis', { params: { startDate, endDate } });
    return response.data;
  },
  getRevenueReport: async (startDate: string, endDate: string) => {
    const response = await api.get('/admin/revenue', { params: { startDate, endDate } });
    return response.data;
  },
  getStaffReport: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/staff-report', { params: { startDate, endDate } });
    return response.data;
  },
  getPatientStats: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/admin/patient-stats', { params: { startDate, endDate } });
    return response.data;
  },
  clearTestDataPreview: async () => {
    const response = await api.get('/admin/clear-test-data/preview');
    return response.data as Record<string, number>;
  },
  clearTestData: async (confirmation: string) => {
    const response = await api.post('/admin/clear-test-data', { confirmation });
    return response.data;
  },
};

export const admissionsAPI = {
  getAll: async (params?: { status?: string; wardType?: string; nurseId?: string }) => {
    const response = await api.get('/admissions', { params });
    return response.data;
  },
  getActive: async () => {
    const response = await api.get('/admissions/active');
    return response.data;
  },
  getDashboard: async (mine = false) => {
    const response = await api.get('/admissions/dashboard', { params: mine ? { mine: 'true' } : {} });
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/admissions/stats');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/admissions/${id}`);
    return response.data;
  },
  getByPatient: async (patientId: string) => {
    const response = await api.get(`/admissions/patient/${patientId}`);
    return response.data;
  },
  create: async (data: {
    patientId: string;
    visitId?: string;
    doctorId?: string;
    primaryNurseId?: string;
    wardType?: string;
    bedNumber?: string;
    admissionReason: string;
    diagnosis?: string;
    allergies?: string[];
    dietaryRestrictions?: string[];
    precautions?: string[];
    codeStatus?: string;
    notes?: string;
  }) => {
    const response = await api.post('/admissions', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/admissions/${id}`, data);
    return response.data;
  },
  // Vitals
  recordVitals: async (id: string, vitals: any) => {
    const response = await api.post(`/admissions/${id}/vitals`, vitals);
    return response.data;
  },
  // Medications
  recordMedication: async (id: string, med: { medicationName: string; dosage: string; route?: string; prescriptionId?: string; medicationId?: string; refused?: boolean; refusalReason?: string; notes?: string }) => {
    const response = await api.post(`/admissions/${id}/medications`, med);
    return response.data;
  },
  // Fluids
  recordFluid: async (id: string, entry: { direction: 'intake' | 'output'; fluidType: string; volumeMl: number; route?: string; notes?: string }) => {
    const response = await api.post(`/admissions/${id}/fluids`, entry);
    return response.data;
  },
  getFluidBalance: async (id: string, startDate?: string, endDate?: string) => {
    const response = await api.get(`/admissions/${id}/fluid-balance`, { params: { startDate, endDate } });
    return response.data;
  },
  // Nursing notes (SOAP)
  addNursingNote: async (id: string, note: { subjective?: string; objective?: string; assessment?: string; plan?: string; narrative?: string }) => {
    const response = await api.post(`/admissions/${id}/nursing-notes`, note);
    return response.data;
  },
  // Shift handover
  addShiftHandover: async (id: string, handover: {
    shift: string;
    conditionSummary?: string;
    latestVitalsSummary?: string;
    pendingLabs?: string;
    medicationsDue?: string;
    fluidBalanceConcern?: string;
    risksAndAllergies?: string;
    tasksForNextShift?: string;
    receivingNurse?: string;
    notes?: string;
  }) => {
    const response = await api.post(`/admissions/${id}/shift-handovers`, handover);
    return response.data;
  },
  // Care plan
  addCarePlanItem: async (id: string, item: { problem: string; goal?: string; interventions?: string[]; evaluation?: string; status?: string }) => {
    const response = await api.post(`/admissions/${id}/care-plan`, item);
    return response.data;
  },
  resolveCarePlanItem: async (id: string, index: number, evaluation?: string) => {
    const response = await api.patch(`/admissions/${id}/care-plan/${index}/resolve`, { evaluation });
    return response.data;
  },
  // Incidents
  reportIncident: async (id: string, incident: { incidentType: string; description: string; severity?: string; actionTaken?: string; witnessesOrStaff?: string[]; occurredAt?: string }) => {
    const response = await api.post(`/admissions/${id}/incidents`, incident);
    return response.data;
  },
  // Transfer / Discharge
  transfer: async (id: string, data: { wardType?: string; bedNumber?: string; notes?: string }) => {
    const response = await api.patch(`/admissions/${id}/transfer`, data);
    return response.data;
  },
  discharge: async (id: string, data: { dischargeNotes?: string; dischargeDiagnosis?: string; dischargeInstructions?: string }) => {
    const response = await api.patch(`/admissions/${id}/discharge`, data);
    return response.data;
  },
};

export const inventoryAPI = {
  getDashboard: async () => {
    const response = await api.get('/inventory/dashboard');
    return response.data;
  },
  getLowStock: async () => {
    const response = await api.get('/inventory/low-stock');
    return response.data;
  },
  getExpiringSoon: async (days?: number) => {
    const response = await api.get('/inventory/expiring-soon', { params: days ? { days } : {} });
    return response.data;
  },
  getMovements: async (params?: { medicationId?: string; movementType?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const response = await api.get('/inventory/movements', { params });
    return response.data;
  },
  receiveStock: async (data: {
    medicationId: string;
    quantity: number;
    batchNumber?: string;
    expiryDate?: string;
    unitCost?: number;
    supplierId?: string;
    supplierName?: string;
    invoiceNumber?: string;
    notes?: string;
  }) => {
    const response = await api.post('/inventory/receipts', data);
    return response.data;
  },
  adjustStock: async (data: { medicationId: string; quantity: number; reason: string; notes?: string }) => {
    const response = await api.post('/inventory/adjustments', data);
    return response.data;
  },
  removeExpired: async (data: { medicationId: string; quantity: number; reason: string }) => {
    const response = await api.post('/inventory/expired', data);
    return response.data;
  },
  listSuppliers: async (activeOnly: boolean = true) => {
    const response = await api.get('/inventory/suppliers', { params: { activeOnly: String(activeOnly) } });
    return response.data;
  },
  createSupplier: async (data: { name: string; contactPerson?: string; phone?: string; email?: string; address?: string }) => {
    const response = await api.post('/inventory/suppliers', data);
    return response.data;
  },
  updateSupplier: async (id: string, data: any) => {
    const response = await api.patch(`/inventory/suppliers/${id}`, data);
    return response.data;
  },
};

export const roomsAPI = {
  getAll: async (params?: { roomType?: string; status?: string }) => {
    const response = await api.get('/rooms', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/rooms/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/rooms', data);
    return response.data;
  },
  update: async (id: string, data: any) => {
    const response = await api.patch(`/rooms/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/rooms/${id}`);
  },
  assignRoom: async (roomId: string, visitId: string) => {
    const response = await api.post(`/rooms/${roomId}/assign/${visitId}`);
    return response.data;
  },
  releaseRoom: async (id: string) => {
    const response = await api.post(`/rooms/${id}/release`);
    return response.data;
  },
  autoAssign: async (visitId: string, preferredType?: string) => {
    const response = await api.post(`/rooms/auto-assign/${visitId}`, null, { params: { preferredType } });
    return response.data;
  },
  seed: async () => {
    const response = await api.post('/rooms/seed');
    return response.data;
  },
};

export default api;
