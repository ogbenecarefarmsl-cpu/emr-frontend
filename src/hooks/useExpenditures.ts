import { expendituresAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useExpenditures(filters?: {
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  return useQuery({
    queryKey: ['expenditures', filters],
    queryFn: async () => {
      return await expendituresAPI.getAll(filters);
    },
  });
}

export function useExpenditure(id: string) {
  return useQuery({
    queryKey: ['expenditures', id],
    queryFn: async () => {
      return await expendituresAPI.getById(id);
    },
    enabled: !!id,
  });
}

export function useExpenditureSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['expenditures', 'summary', startDate, endDate],
    queryFn: async () => {
      return await expendituresAPI.getSummary(startDate, endDate);
    },
  });
}

export function useCreateExpenditure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await expendituresAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenditures'] });
    },
  });
}

export function useUpdateExpenditure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await expendituresAPI.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenditures'] });
    },
  });
}

export function useDeleteExpenditure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await expendituresAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenditures'] });
    },
  });
}

export function useFlagExpenditure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await expendituresAPI.flag(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenditures'] });
    },
  });
}

export function useUnflagExpenditure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await expendituresAPI.unflag(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenditures'] });
    },
  });
}
