import { doctorsAPI } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface Doctor {
  _id: string;
  fullName: string;
  phone?: string;
  facility?: string;
  isActive: boolean;
}

export function useDoctors(search?: string) {
  return useQuery({
    queryKey: ['doctors', search],
    queryFn: async () => {
      return await doctorsAPI.getAll({ search, activeOnly: true });
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { fullName: string; phone?: string; facility?: string }) => {
      return await doctorsAPI.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
  });
}
