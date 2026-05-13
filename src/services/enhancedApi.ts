/**
 * Enhanced API service with offline-first capabilities
 * Wraps existing API calls with automatic offline queueing and caching
 */

import { offlineAPI } from './offlineFirstApi';
import * as originalAPI from './api';

// Re-export all original API functions
export * from './api';

/**
 * Enhanced test catalog API with offline support
 */
export const testCatalogAPIEnhanced = {
  ...originalAPI.testCatalogAPI,
  
  getAll: () => offlineAPI.get('/test-catalog', {
    cacheResponse: true,
    cacheTable: 'tests',
    retry: { maxRetries: 3, backoffMs: 1000 }
  }),
  
  getPanels: () => offlineAPI.get('/test-catalog/panels', {
    cacheResponse: true,
    cacheTable: 'panels',
    retry: { maxRetries: 3, backoffMs: 1000 }
  }),
};

/**
 * Enhanced patients API with offline support
 */
export const patientsAPIEnhanced = {
  ...originalAPI.patientsAPI,
  
  getAll: (params?: any) => offlineAPI.get(`/patients${params ? `?${new URLSearchParams(params)}` : ''}`, {
    cacheResponse: true,
    cacheTable: 'patients',
    retry: { maxRetries: 3, backoffMs: 1000 }
  }),
  
  getById: (id: string) => offlineAPI.get(`/patients/${id}`, {
    cacheResponse: true,
    cacheTable: 'patients',
  }),
  
  create: (data: any) => offlineAPI.post('/patients', data, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  update: (id: string, data: any) => offlineAPI.patch(`/patients/${id}`, data, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  delete: (id: string) => offlineAPI.delete(`/patients/${id}`, {
    retry: { maxRetries: 3, backoffMs: 1000 }
  }),
};

/**
 * Enhanced orders API with offline support
 */
export const ordersAPIEnhanced = {
  ...originalAPI.ordersAPI,
  
  getAll: (params?: any) => offlineAPI.get(`/orders${params ? `?${new URLSearchParams(params)}` : ''}`, {
    cacheResponse: true,
    cacheTable: 'orders',
    retry: { maxRetries: 3, backoffMs: 1000 }
  }),
  
  getById: (id: string) => offlineAPI.get(`/orders/${id}`, {
    cacheResponse: true,
    cacheTable: 'orders',
  }),
  
  create: (data: any) => offlineAPI.post('/orders', data, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  update: (id: string, data: any) => offlineAPI.patch(`/orders/${id}`, data, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  updateStatus: (id: string, status: string) => offlineAPI.patch(`/orders/${id}/status`, { status }, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  delete: (id: string) => offlineAPI.delete(`/orders/${id}`, {
    retry: { maxRetries: 3, backoffMs: 1000 }
  }),
};

/**
 * Enhanced payments API with offline support
 */
export const paymentsAPIEnhanced = {
  ...originalAPI.paymentsAPI,
  
  create: (data: any) => offlineAPI.post('/payments', data, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  getByOrderId: (orderId: string) => offlineAPI.get(`/payments/order/${orderId}`, {
    retry: { maxRetries: 3, backoffMs: 1000 }
  }),
};

/**
 * Enhanced results API with offline support
 */
export const resultsAPIEnhanced = {
  ...originalAPI.resultsAPI,
  
  create: (data: any) => offlineAPI.post('/results', data, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  update: (id: string, data: any) => offlineAPI.patch(`/results/${id}`, data, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
  
  verify: (id: string) => offlineAPI.patch(`/results/${id}/verify`, {}, {
    optimistic: true,
    retry: { maxRetries: 5, backoffMs: 2000 }
  }),
};
