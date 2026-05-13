/**
 * Offline-First API Wrapper
 * 
 * Provides full CRUD operations with automatic offline queueing and IndexedDB caching.
 * Optimized for poor network conditions with:
 * - Automatic retry with exponential backoff
 * - Request deduplication
 * - Optimistic updates
 * - Background sync
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { db, queueMutation, bulkUpsert } from './offlineDb';
import { getAccessToken } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

// Network timeout for poor connections
const NETWORK_TIMEOUT = 15000; // 15 seconds

interface OfflineFirstOptions extends AxiosRequestConfig {
  /** Skip offline queue and fail immediately if offline */
  skipOfflineQueue?: boolean;
  /** Cache the response in IndexedDB */
  cacheResponse?: boolean;
  /** Cache table name for storing response */
  cacheTable?: 'tests' | 'panels' | 'patients' | 'orders' | 'users';
  /** Enable optimistic update (return immediately with local data) */
  optimistic?: boolean;
  /** Retry configuration */
  retry?: {
    maxRetries?: number;
    backoffMs?: number;
  };
}

/**
 * Generate a unique key for request deduplication
 */
function getRequestKey(method: string, url: string, data?: any): string {
  return `${method}:${url}:${data ? JSON.stringify(data) : ''}`;
}

/**
 * Check if we're online and can reach the API
 */
async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  
  try {
    const token = getAccessToken();
    await axios.get(`${API_BASE_URL}/health`, {
      timeout: 3000,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Perform HTTP request with offline-first capabilities
 */
export async function offlineFirstRequest<T = any>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  data?: any,
  options: OfflineFirstOptions = {}
): Promise<T> {
  const {
    skipOfflineQueue = false,
    cacheResponse = false,
    cacheTable,
    optimistic = false,
    retry = {},
    ...axiosConfig
  } = options;

  const { maxRetries = 3, backoffMs = 1000 } = retry;
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const requestKey = getRequestKey(method, url, data);

  // Request deduplication - return existing promise if same request is in flight
  if (pendingRequests.has(requestKey)) {
    console.log(`[OfflineFirst] Deduplicating request: ${requestKey}`);
    return pendingRequests.get(requestKey)!;
  }

  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...axiosConfig.headers,
  };

  const requestConfig: AxiosRequestConfig = {
    method,
    url: fullUrl,
    data,
    headers,
    timeout: NETWORK_TIMEOUT,
    ...axiosConfig,
  };

  // For GET requests, try cache first
  if (method === 'GET' && cacheTable) {
    try {
      const cached = await db[cacheTable].toArray();
      if (cached.length > 0) {
        console.log(`[OfflineFirst] Returning ${cached.length} cached items from ${cacheTable}`);
        
        // Return cached data immediately, fetch in background
        if (await isOnline()) {
          performBackgroundFetch(requestConfig, cacheTable).catch(console.error);
        }
        
        return cached.map(item => item._raw) as T;
      }
    } catch (err) {
      console.warn('[OfflineFirst] Cache read failed:', err);
    }
  }

  // Optimistic update for mutations
  if (optimistic && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    console.log('[OfflineFirst] Optimistic update, queueing mutation');
    await queueMutation(url, method as any, data);
    return data as T;
  }

  // Attempt network request with retry logic
  const executeRequest = async (attemptNumber = 0): Promise<T> => {
    try {
      const response: AxiosResponse<T> = await axios(requestConfig);
      
      // Cache successful GET responses
      if (method === 'GET' && cacheResponse && cacheTable && response.data) {
        await cacheResponseData(response.data, cacheTable);
      }
      
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: unknown; code?: string };
      const isNetworkError = !axiosError.response || axiosError.code === 'ECONNABORTED' || axiosError.code === 'ERR_NETWORK';
      
      // Retry logic for network errors
      if (isNetworkError && attemptNumber < maxRetries) {
        const delay = backoffMs * Math.pow(2, attemptNumber);
        console.log(`[OfflineFirst] Retry ${attemptNumber + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeRequest(attemptNumber + 1);
      }
      
      // Queue mutation if offline and not a GET request
      if (isNetworkError && !skipOfflineQueue && method !== 'GET') {
        console.log('[OfflineFirst] Network error, queueing mutation for later sync');
        await queueMutation(url, method as any, data);
        
        // Return optimistic response
        if (method === 'POST') {
          return { ...data, id: `temp_${Date.now()}`, _offline: true } as T;
        }
        return data as T;
      }
      
      throw error;
    }
  };

  const requestPromise = executeRequest();
  pendingRequests.set(requestKey, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    pendingRequests.delete(requestKey);
  }
}

/**
 * Background fetch to update cache without blocking UI
 */
async function performBackgroundFetch(
  config: AxiosRequestConfig,
  cacheTable: string
): Promise<void> {
  try {
    const response = await axios(config);
    if (response.data) {
      await cacheResponseData(response.data, cacheTable as any);
      console.log(`[OfflineFirst] Background cache updated for ${cacheTable}`);
    }
  } catch (err) {
    console.warn('[OfflineFirst] Background fetch failed:', err);
  }
}

/**
 * Cache response data in IndexedDB
 */
async function cacheResponseData(data: any, table: 'tests' | 'panels' | 'patients' | 'orders' | 'users'): Promise<void> {
  const now = Date.now();
  const items = Array.isArray(data) ? data : [data];
  
  const mapped = items.map((item: any) => ({
    id: item.id || item._id || item.code || item.patientId || `temp_${Date.now()}`,
    ...item,
    _raw: item,
    _syncedAt: now,
  }));

  await bulkUpsert(db[table], mapped);
}

// ── Convenience methods for common operations ────────────────────────────────

export const offlineAPI = {
  /**
   * GET request with automatic caching
   */
  get: <T = any>(url: string, options?: OfflineFirstOptions) =>
    offlineFirstRequest<T>('GET', url, undefined, options),

  /**
   * POST request with offline queueing
   */
  post: <T = any>(url: string, data?: any, options?: OfflineFirstOptions) =>
    offlineFirstRequest<T>('POST', url, data, options),

  /**
   * PATCH request with offline queueing
   */
  patch: <T = any>(url: string, data?: any, options?: OfflineFirstOptions) =>
    offlineFirstRequest<T>('PATCH', url, data, options),

  /**
   * PUT request with offline queueing
   */
  put: <T = any>(url: string, data?: any, options?: OfflineFirstOptions) =>
    offlineFirstRequest<T>('PUT', url, data, options),

  /**
   * DELETE request with offline queueing
   */
  delete: <T = any>(url: string, options?: OfflineFirstOptions) =>
    offlineFirstRequest<T>('DELETE', url, undefined, options),
};

// ── Prefetch strategies for common data ──────────────────────────────────────

/**
 * Prefetch and cache test catalog for offline use
 */
export async function prefetchTestCatalog(): Promise<void> {
  try {
    await offlineAPI.get('/test-catalog', {
      cacheResponse: true,
      cacheTable: 'tests',
    });
    console.log('[OfflineFirst] Test catalog prefetched');
  } catch (err) {
    console.warn('[OfflineFirst] Failed to prefetch test catalog:', err);
  }
}

/**
 * Prefetch recent patients for offline use
 */
export async function prefetchPatients(limit = 500): Promise<void> {
  try {
    await offlineAPI.get(`/patients?limit=${limit}`, {
      cacheResponse: true,
      cacheTable: 'patients',
    });
    console.log('[OfflineFirst] Patients prefetched');
  } catch (err) {
    console.warn('[OfflineFirst] Failed to prefetch patients:', err);
  }
}

/**
 * Prefetch recent orders for offline use
 */
export async function prefetchOrders(limit = 200): Promise<void> {
  try {
    await offlineAPI.get(`/orders?limit=${limit}`, {
      cacheResponse: true,
      cacheTable: 'orders',
    });
    console.log('[OfflineFirst] Orders prefetched');
  } catch (err) {
    console.warn('[OfflineFirst] Failed to prefetch orders:', err);
  }
}

/**
 * Prefetch all critical data for offline operation
 */
export async function prefetchAllCriticalData(): Promise<void> {
  console.log('[OfflineFirst] Starting critical data prefetch...');
  await Promise.allSettled([
    prefetchTestCatalog(),
    prefetchPatients(),
    prefetchOrders(),
  ]);
  console.log('[OfflineFirst] Critical data prefetch complete');
}
