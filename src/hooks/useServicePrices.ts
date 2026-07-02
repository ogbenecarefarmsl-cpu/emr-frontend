import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicePricesAPI } from '@/services/api';

export function useMyServicePrices() {
  return useQuery({
    queryKey: ['service-prices', 'mine'],
    queryFn: () => servicePricesAPI.getMine(),
    staleTime: 60_000,
  });
}

export function useBranchServicePrices(branchId?: string) {
  return useQuery({
    queryKey: ['service-prices', 'branch', branchId],
    queryFn: () => servicePricesAPI.getForBranch(branchId),
    enabled: !!branchId,
    staleTime: 60_000,
  });
}

export function useUpdateBranchServicePrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, prices }: { branchId: string; prices: Array<{ code: string; label?: string; category?: string; description?: string; amount: number; isActive?: boolean; isCustom?: boolean }> }) =>
      servicePricesAPI.updateForBranch(branchId, prices),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service-prices', 'branch', variables.branchId] });
      queryClient.invalidateQueries({ queryKey: ['service-prices', 'mine'] });
    },
  });
}
