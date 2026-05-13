/**
 * Integrated API Service with Hybrid Sync
 * Combines existing API methods with smart connection management
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { connectionManager } from './connectionManager';

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

// Offline queue for operations when all backends are down
interface QueuedOperation {
  id: string;
  method: string;
  url: string;
  data?: any;
  timestamp: number;
}

class IntegratedApiService {
  private api: AxiosInstance;
  private offlineQueue: QueuedOperation[] = [];
  private isOnline: boolean = true;
  private isRefreshing: boolean = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor() {
    // Create axios instance with dynamic baseURL
    this.api = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Setup interceptors
    this.setupInterceptors();

    // Monitor connection status
    connectionManager.onStatusChange((status) => {
      this.isOnline = status.online;
      console.log(`📡 Connection: ${status.backend} (${status.url})`);

      // Process offline queue when back online
      if (this.isOnline && this.offlineQueue.length > 0) {
        this.processOfflineQueue();
      }
    });

    // Load offline queue from localStorage
    this.loadOfflineQueue();
  }

  private setupInterceptors() {
    // Request interceptor - Set dynamic baseURL and auth token
    this.api.interceptors.request.use(
      async (config) => {
        try {
          // Get best available backend
          const backend = await connectionManager.getBestBackend();
          config.baseURL = backend;

          // Add auth token
          const token = getAccessToken();
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          return config;
        } catch (error) {
          // All backends down - queue operation if it's a write
          if (config.method && config.method !== 'get') {
            this.queueOperation(config);
          }
          throw new Error('Offline - operation queued');
        }
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Handle token refresh and errors
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        // Handle 401 - Token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue this request
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return this.api(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            clearTokens();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return Promise.reject(error);
          }

          try {
            // Get current backend for refresh
            const backend = await connectionManager.getBestBackend();
            
            // Attempt to refresh token
            const response = await axios.post(`${backend}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;
            setTokens(accessToken, newRefreshToken || refreshToken);

            // Update authorization header
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }

            this.processFailedQueue(null, accessToken);
            this.isRefreshing = false;

            return this.api(originalRequest);
          } catch (refreshError) {
            this.processFailedQueue(refreshError, null);
            this.isRefreshing = false;
            clearTokens();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return Promise.reject(refreshError);
          }
        }

        // If request failed due to network, try alternative backend
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          console.warn('⚠️ Backend failed, connection manager will try alternative...');
        }

        return Promise.reject(error);
      }
    );
  }

  private processFailedQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    this.failedQueue = [];
  }

  private queueOperation(config: any) {
    const operation: QueuedOperation = {
      id: `${Date.now()}-${Math.random()}`,
      method: config.method || 'post',
      url: config.url || '',
      data: config.data,
      timestamp: Date.now(),
    };

    this.offlineQueue.push(operation);
    console.log(`📥 Queued operation: ${operation.method.toUpperCase()} ${operation.url}`);

    // Save to localStorage
    this.saveOfflineQueue();
  }

  private async processOfflineQueue() {
    console.log(`📤 Processing ${this.offlineQueue.length} queued operations...`);

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const operation of queue) {
      try {
        await this.api.request({
          method: operation.method,
          url: operation.url,
          data: operation.data,
        });
        console.log(`✅ Processed: ${operation.method.toUpperCase()} ${operation.url}`);
      } catch (error) {
        console.error(`❌ Failed to process: ${operation.url}`, error);
        // Re-queue if still failing
        this.offlineQueue.push(operation);
      }
    }

    // Update localStorage
    this.saveOfflineQueue();
  }

  private saveOfflineQueue() {
    localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
  }

  private loadOfflineQueue() {
    try {
      const saved = localStorage.getItem('offline_queue');
      if (saved) {
        this.offlineQueue = JSON.parse(saved);
        console.log(`📦 Loaded ${this.offlineQueue.length} queued operations from storage`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  // Expose axios instance for use
  getInstance(): AxiosInstance {
    return this.api;
  }

  // Get offline queue status
  getQueueStatus() {
    return {
      count: this.offlineQueue.length,
      operations: this.offlineQueue,
    };
  }

  // Clear offline queue
  clearQueue() {
    this.offlineQueue = [];
    localStorage.removeItem('offline_queue');
  }

  // Get connection status
  getConnectionStatus() {
    return {
      online: this.isOnline,
      backend: connectionManager.getCurrentBackend(),
    };
  }
}

// Singleton instance
const integratedApiService = new IntegratedApiService();
const api = integratedApiService.getInstance();

// Export API methods (same as original api.ts)
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
};

export const ordersAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/orders', { params });
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

export const criticalResultsAPI = {
  getUnacknowledged: async () => {
    const response = await api.get('/results/critical');
    return response.data;
  },
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
    const response = await api.get('/settings/printer');
    return response.data;
  },
  updatePrinterSettings: async (patch: Record<string, any>) => {
    const response = await api.patch('/settings/printer', patch);
    return response.data;
  },
};

// Export service instance for queue management
export const apiService = integratedApiService;

export default api;
