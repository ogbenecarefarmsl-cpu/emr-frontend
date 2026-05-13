/**
 * Smart API Service
 * 
 * Provides an Axios instance that automatically:
 * - Switches between local network and cloud backends via ConnectionManager
 * - Queues write operations when offline (IndexedDB via offlineDb)
 * - Processes the queue when reconnected
 * 
 * For offline-first CRUD with caching, prefer the hooks in
 * useOfflineData.ts (reads) and useOfflineFirst.ts (mutations).
 * This service is the low-level transport layer used by those hooks.
 */

import axios, { AxiosInstance } from 'axios';
import { connectionManager } from './connectionManager';
import { db, queueMutation, getPendingCount } from './offlineDb';

class SmartApiService {
  private api: AxiosInstance;
  private isOnline: boolean = true;

  constructor() {
    this.api = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();

    // Monitor connection status
    connectionManager.onStatusChange((status) => {
      const wasOffline = !this.isOnline;
      this.isOnline = status.online;
      console.log(`📡 Connection: ${status.backend} (${status.url})`);

      // Process offline queue when transitioning to online
      if (wasOffline && this.isOnline) {
        this.processOfflineQueue();
      }
    });
  }

  private setupInterceptors() {
    // Request interceptor - set dynamic baseURL + auth
    this.api.interceptors.request.use(
      async (config) => {
        try {
          const backend = await connectionManager.getBestBackend();
          config.baseURL = backend;
        } catch {
          // All backends down - queue write operations
          if (config.method !== 'get') {
            await this.queueOperation(config);
            return Promise.reject(new Error('Offline – operation queued for later sync'));
          }
          // For reads, let the error propagate so callers can fall back to cache
          return Promise.reject(new Error('Offline – no backend available'));
        }

        // Attach auth token
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          console.warn('⚠️ Backend failed, connection manager will try alternative on next request');
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Queue a failed mutation in IndexedDB for later sync
   */
  private async queueOperation(config: any): Promise<void> {
    const url = config.url || '';
    const method = (config.method || 'POST').toUpperCase() as 'POST' | 'PATCH' | 'DELETE';
    const body = config.data;

    await queueMutation(url, method, body);
    console.log(`📥 Queued operation: ${method} ${url}`);
  }

  /**
   * Flush all pending mutations from IndexedDB
   */
  private async processOfflineQueue(): Promise<void> {
    const pending = await db.pendingMutations
      .where('status')
      .equals('pending')
      .sortBy('createdAt');

    if (pending.length === 0) return;

    console.log(`📤 Processing ${pending.length} queued operations…`);

    for (const mutation of pending) {
      try {
        await db.pendingMutations.update(mutation.id!, { status: 'syncing' });

        await this.api.request({
          method: mutation.method,
          url: mutation.url,
          data: mutation.body,
        });

        await db.pendingMutations.delete(mutation.id!);
        console.log(`✅ Synced: ${mutation.method} ${mutation.url}`);
      } catch (error) {
        const retries = (mutation.retries || 0) + 1;
        if (retries >= 5) {
          await db.pendingMutations.update(mutation.id!, {
            status: 'failed',
            retries,
            error: (error as Error)?.message || 'Max retries exceeded',
          });
          console.error(`❌ Failed after 5 retries: ${mutation.url}`);
        } else {
          await db.pendingMutations.update(mutation.id!, {
            status: 'pending',
            retries,
          });
          console.log(`⏳ Will retry (${retries}/5): ${mutation.url}`);
        }
      }
    }
  }

  /** Expose the underlying Axios instance */
  getInstance(): AxiosInstance {
    return this.api;
  }

  /** Get offline queue status */
  async getQueueStatus() {
    const count = await getPendingCount();
    return { count };
  }

  /** Clear entire offline queue */
  async clearQueue() {
    await db.pendingMutations.clear();
  }
}

// Singleton
export const smartApi = new SmartApiService();
export default smartApi.getInstance();
