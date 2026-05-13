import { samplesAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Sample {
  id: string;
  orderId: string;
  sampleId: string;
  sampleType: string;
  status: 'collected' | 'processing' | 'completed' | 'rejected';
  collectedAt?: string;
  collectedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface SampleCreate {
  orderId: string;
  patientId: string;
  sampleType: string;
  collectedBy?: string;
}

interface SampleUpdate {
  status?: 'collected' | 'processing' | 'completed' | 'rejected';
  rejectionReason?: string;
}

export function useSamples(orderId?: string) {
  return useQuery({
    queryKey: ['samples', orderId],
    queryFn: async () => {
      const params: any = {};
      if (orderId) params.orderId = orderId;
      return await samplesAPI.getAll(params);
    },
  });
}

export function useSample(id: string) {
  return useQuery({
    queryKey: ['samples', id],
    queryFn: async () => {
      return await samplesAPI.getById(id);
    },
    enabled: !!id,
  });
}

export function useCreateSample() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sample: SampleCreate) => {
      return await samplesAPI.create(sample);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
  });
}

export function useUpdateSample() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: SampleUpdate }) => {
      return await samplesAPI.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
  });
}

export function useRejectSample() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await samplesAPI.reject(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
    },
  });
}