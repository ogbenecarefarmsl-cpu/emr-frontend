/**
 * Offline-First Data Hooks
 * 
 * Canonical hooks for fetching data with automatic IndexedDB fallback.
 * When online → fetches from API (SyncContext caches to IndexedDB).
 * When offline → reads from IndexedDB cache.
 * 
 * NOTE: For generic offline CRUD operations, use hooks from useOfflineFirst.ts.
 *       These hooks are specialized for read-heavy data that needs fast cache access.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useSync } from '@/context/SyncContext';
import { db } from '@/services/offlineDb';
import { testCatalogAPI, patientsAPI, ordersAPI } from '@/services/api';

/**
 * Offline-first hook for test catalog.
 * When online → fetches from API (and sync caches to IndexedDB).
 * When offline → reads from IndexedDB cache.
 */
export function useOfflineTests(options?: Partial<UseQueryOptions<any>>) {
  const { isApiReachable } = useSync();

  return useQuery({
    queryKey: ['tests', 'offline-first'],
    queryFn: async () => {
      if (isApiReachable) {
        try {
          const data = await testCatalogAPI.getAll();
          return Array.isArray(data) ? data : data.data ?? [];
        } catch {
          // fallback to cache
        }
      }
      // Offline: read from IndexedDB
      const cached = await db.tests.toArray();
      return cached.map((c) => c._raw);
    },
    staleTime: isApiReachable ? 30_000 : Infinity,
    ...options,
  });
}

/**
 * Offline-first hook for active tests only.
 */
export function useOfflineActiveTests(options?: Partial<UseQueryOptions<any>>) {
  const { isApiReachable } = useSync();

  return useQuery({
    queryKey: ['tests', 'active', 'offline-first'],
    queryFn: async () => {
      if (isApiReachable) {
        try {
          const data = await testCatalogAPI.getActive();
          return Array.isArray(data) ? data : data.data ?? [];
        } catch {
          // fallback
        }
      }
      const cached = await db.tests.where('isActive').equals(1).toArray();
      return cached.map((c) => c._raw);
    },
    staleTime: isApiReachable ? 30_000 : Infinity,
    ...options,
  });
}

/**
 * Offline-first hook for patients list.
 */
export function useOfflinePatients(options?: Partial<UseQueryOptions<any>>) {
  const { isApiReachable } = useSync();

  return useQuery({
    queryKey: ['patients', 'offline-first'],
    queryFn: async () => {
      if (isApiReachable) {
        try {
          const data = await patientsAPI.getAll();
          return Array.isArray(data) ? data : data.data ?? [];
        } catch {
          // fallback
        }
      }
      const cached = await db.patients.toArray();
      return cached.map((c) => c._raw);
    },
    staleTime: isApiReachable ? 30_000 : Infinity,
    ...options,
  });
}

/**
 * Offline-first hook for orders list.
 */
export function useOfflineOrders(options?: Partial<UseQueryOptions<any>>) {
  const { isApiReachable } = useSync();

  return useQuery({
    queryKey: ['orders', 'offline-first'],
    queryFn: async () => {
      if (isApiReachable) {
        try {
          return await ordersAPI.getAll();
        } catch {
          // fallback
        }
      }
      const cached = await db.orders.toArray();
      return cached.map((c) => c._raw);
    },
    staleTime: isApiReachable ? 15_000 : Infinity,
    ...options,
  });
}

/**
 * Offline-first hook for panels list.
 */
export function useOfflinePanels(options?: Partial<UseQueryOptions<any>>) {
  const { isApiReachable } = useSync();

  return useQuery({
    queryKey: ['panels', 'offline-first'],
    queryFn: async () => {
      if (isApiReachable) {
        try {
          const data = await testCatalogAPI.getPanels();
          return Array.isArray(data) ? data : [];
        } catch {
          // fallback
        }
      }
      const cached = await db.panels.toArray();
      return cached.map((c) => c._raw);
    },
    staleTime: isApiReachable ? 30_000 : Infinity,
    ...options,
  });
}
