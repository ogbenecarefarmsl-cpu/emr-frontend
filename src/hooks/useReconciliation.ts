import { reconciliationAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useExpectedAmounts(date: string) {
  return useQuery({
    queryKey: ['reconciliation', 'expected', date],
    queryFn: async () => {
      return await reconciliationAPI.getExpectedAmounts(date);
    },
    enabled: !!date,
  });
}

export function useReconciliations(status?: string) {
  return useQuery({
    queryKey: ['reconciliations', status],
    queryFn: async () => {
      return await reconciliationAPI.getAll(status);
    },
  });
}

export function useReconciliation(id: string) {
  return useQuery({
    queryKey: ['reconciliations', id],
    queryFn: async () => {
      return await reconciliationAPI.getById(id);
    },
    enabled: !!id,
  });
}

export function useCreateReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await reconciliationAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
    },
  });
}

export function useReviewReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      approved,
      notes,
    }: {
      id: string;
      approved: boolean;
      notes?: string;
    }) => {
      return await reconciliationAPI.review(id, approved, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
    },
  });
}

export function usePendingReconciliationCount() {
  return useQuery({
    queryKey: ['reconciliations', 'pending', 'count'],
    queryFn: async () => {
      return await reconciliationAPI.getPendingCount();
    },
  });
}

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: ['daily-report', date],
    queryFn: async () => {
      return await reconciliationAPI.getDailyReport(date);
    },
    enabled: !!date,
  });
}

export function useDoctorReferralReport(params: { startDate?: string; endDate?: string; doctor?: string; doctorId?: string }) {
  return useQuery({
    queryKey: ['doctor-referral-report', params.startDate, params.endDate, params.doctor, params.doctorId],
    queryFn: async () => {
      return await reconciliationAPI.getDoctorReferralReport(params);
    },
  });
}
