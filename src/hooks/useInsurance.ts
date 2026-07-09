import { insuranceAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface InsuranceProgram {
  _id: string;
  code: string;
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  subEntities?: InsuranceSubEntity[];
  createdAt?: string;
}

export interface InsuranceSubEntity {
  _id: string;
  programId: string;
  code: string;
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface InsurancePatient {
  programCode?: string;
  subEntityCode?: string;
  memberNumber?: string;
  memberName?: string;
  responsiblePerson?: string;
  responsiblePhone?: string;
  responsibleAddress?: string;
  authorizerName?: string;
  authorizerPhone?: string;
}

// ── Programs ──

export function useInsurancePrograms() {
  return useQuery<InsuranceProgram[]>({
    queryKey: ['insurance-programs'],
    queryFn: async () => {
      const data = await insuranceAPI.getPrograms();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
  });
}

export function useInsuranceLookup() {
  return useQuery<(InsuranceProgram & { subEntities: InsuranceSubEntity[] })[]>({
    queryKey: ['insurance-lookup'],
    queryFn: async () => {
      const data = await insuranceAPI.getLookup();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateInsuranceProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<InsuranceProgram>) => {
      return await insuranceAPI.createProgram(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-programs'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-lookup'] });
    },
  });
}

export function useUpdateInsuranceProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsuranceProgram> }) => {
      return await insuranceAPI.updateProgram(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-programs'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-lookup'] });
    },
  });
}

export function useDeleteInsuranceProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await insuranceAPI.deleteProgram(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-programs'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-lookup'] });
    },
  });
}

// ── Sub-Entities ──

export function useSubEntities(programId: string) {
  return useQuery<InsuranceSubEntity[]>({
    queryKey: ['insurance-subs', programId],
    queryFn: async () => {
      const data = await insuranceAPI.getSubEntities(programId);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!programId,
    staleTime: 60 * 1000,
  });
}

export function useCreateSubEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ programId, data }: { programId: string; data: Partial<InsuranceSubEntity> }) => {
      return await insuranceAPI.createSubEntity(programId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-subs'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-programs'] });
    },
  });
}

export function useUpdateSubEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsuranceSubEntity> }) => {
      return await insuranceAPI.updateSubEntity(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-subs'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-programs'] });
    },
  });
}

export function useDeleteSubEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await insuranceAPI.deleteSubEntity(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-subs'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-lookup'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-programs'] });
    },
  });
}
