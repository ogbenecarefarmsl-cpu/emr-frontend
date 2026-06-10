import { usersAPI, branchesAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Branch {
  _id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  tagline: string;
  website: string;
  footerText: string;
  operatingHours: string;
  isActive: boolean;
}

/**
 * Get the current user's assigned branch, with full letterhead data
 * (name, address, phone, email, logo, footer, etc.) — used by all
 * receipt print paths (lab, prescription, consultation, walk-in).
 *
 * Cached for 5 minutes and refetched on branch-change events.
 */
export function useMyBranch(enabled = true) {
  return useQuery<Branch | null>({
    queryKey: ['my-branch'],
    queryFn: async () => {
      const data = await usersAPI.getMyBranch();
      return data || null;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useAllBranches() {
  return useQuery<Branch[]>({
    queryKey: ['branches', 'all'],
    queryFn: async () => {
      const data = await branchesAPI.getAll();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Branch> }) => {
      return await branchesAPI.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['my-branch'] });
    },
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Branch>) => {
      return await branchesAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useAssignUserBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string | null }) => {
      return await usersAPI.assignBranch(userId, branchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['my-branch'] });
    },
  });
}
