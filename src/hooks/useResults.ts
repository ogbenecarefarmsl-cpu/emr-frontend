import { resultsAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Result {
  id: string;
  _id?: string;
  orderId: string;
  orderTestId?: string;
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  reference_range?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
  status: 'preliminary' | 'verified' | 'amended';
  enteredBy?: string;
  verifiedBy?: string;
  orders?: any;
  test_code?: string;
  test_name?: string;
  resulted_at?: string;
  createdAt: string;
  updatedAt: string;
}

interface ResultCreate {
  orderId: string;
  orderTestId?: string;
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
}

interface ResultUpdate {
  value?: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
  status?: 'preliminary' | 'verified' | 'amended';
}

export function useResults(orderId?: string) {
  return useQuery({
    queryKey: ['results', orderId],
    queryFn: async () => {
      const params: any = { limit: 1000 }; // Get all results for the order (no pagination)
      if (orderId) params.orderId = orderId;
      return await resultsAPI.getAll(params);
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!orderId, // Only fetch when orderId is provided
  });
}

export function useCriticalResults() {
  return useQuery({
    queryKey: ['results', 'critical'],
    queryFn: async () => {
      return await resultsAPI.getCritical();
    },
    staleTime: 30 * 1000,
  });
}

export function usePendingVerificationResults() {
  return useQuery({
    queryKey: ['results', 'pending_verification'],
    queryFn: async () => {
      return await resultsAPI.getPendingVerification();
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateResult() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (result: ResultCreate) => {
      return await resultsAPI.create({
        ...result,
        orderTestId: result.orderTestId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
    },
  });
}

export function useCreateBulkResults() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (results: ResultCreate[]) => {
      return await resultsAPI.createBulk(results);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
    },
  });
}

export function useVerifyResult() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: string | { id: string }) => {
      const id = typeof payload === 'string' ? payload : payload.id;
      return await resultsAPI.verify(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

export function useUpdateResult() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ResultUpdate }) => {
      return await resultsAPI.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

export function useDeleteResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await resultsAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

export function useAmendResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, newValue, reason }: { id: string; newValue: string; reason: string }) => {
      return await resultsAPI.amend(id, newValue, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}