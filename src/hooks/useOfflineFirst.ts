/**
 * React hooks for offline-first CRUD operations
 * 
 * Provides optimistic updates and automatic sync for create/update/delete.
 * For cached read queries, use hooks from useOfflineData.ts instead.
 */

import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { offlineFirstRequest } from '@/services/offlineFirstApi';
import { useSync } from '@/context/SyncContext';
import { toast } from 'sonner';

interface OfflineFirstMutationOptions<TData, TVariables> extends Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'> {
  optimistic?: boolean;
  invalidateQueries?: string[];
}

/**
 * Offline-first mutation hook with optimistic updates
 */
export function useOfflineMutation<TData = any, TVariables = any>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  urlFn: (variables: TVariables) => string,
  options?: OfflineFirstMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const { isApiReachable, pendingCount } = useSync();
  const { optimistic = true, invalidateQueries = [], ...mutationOptions } = options || {};

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const url = urlFn(variables);
      const data = method !== 'DELETE' ? variables : undefined;

      return offlineFirstRequest<TData>(method, url, data, {
        optimistic: !isApiReachable && optimistic,
      });
    },
    onSuccess: (data, variables, context) => {
      // Invalidate related queries
      invalidateQueries.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      // Show success message
      if (isApiReachable) {
        toast.success('Operation completed successfully');
      } else {
        toast.info(`Operation queued (${pendingCount + 1} pending)`, {
          description: 'Will sync when connection is restored'
        });
      }

      mutationOptions.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error('Operation failed', {
        description: error.message
      });
      mutationOptions.onError?.(error, variables, context);
    },
    ...mutationOptions,
  });
}

/**
 * Hook for creating entities with offline support
 */
export function useOfflineCreate<TData = any, TVariables = any>(
  url: string,
  options?: OfflineFirstMutationOptions<TData, TVariables>
) {
  return useOfflineMutation<TData, TVariables>(
    'POST',
    () => url,
    options
  );
}

/**
 * Hook for updating entities with offline support
 */
export function useOfflineUpdate<TData = any, TVariables = any>(
  urlFn: (variables: TVariables) => string,
  options?: OfflineFirstMutationOptions<TData, TVariables>
) {
  return useOfflineMutation<TData, TVariables>(
    'PATCH',
    urlFn,
    options
  );
}

/**
 * Hook for deleting entities with offline support
 */
export function useOfflineDelete<TData = any, TVariables = any>(
  urlFn: (variables: TVariables) => string,
  options?: OfflineFirstMutationOptions<TData, TVariables>
) {
  return useOfflineMutation<TData, TVariables>(
    'DELETE',
    urlFn,
    options
  );
}

// ── Convenience mutation hooks for common entities ───────────────────────────

/**
 * Create a new patient with offline support
 */
export function useCreatePatientOffline() {
  return useOfflineCreate('/patients', {
    invalidateQueries: ['patients'],
  });
}

/**
 * Update a patient with offline support
 */
export function useUpdatePatientOffline() {
  return useOfflineUpdate(
    (variables: any) => `/patients/${variables.id}`,
    { invalidateQueries: ['patients'] }
  );
}

/**
 * Create a new order with offline support
 */
export function useCreateOrderOffline() {
  return useOfflineCreate('/orders', {
    invalidateQueries: ['orders', 'patients'],
  });
}

/**
 * Update an order with offline support
 */
export function useUpdateOrderOffline() {
  return useOfflineUpdate(
    (variables: any) => `/orders/${variables.id}`,
    { invalidateQueries: ['orders'] }
  );
}
