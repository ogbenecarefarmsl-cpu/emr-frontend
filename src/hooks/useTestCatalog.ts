import { testCatalogAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ReferenceRangeItem {
  ageGroup?: string;
  ageMin?: number;
  ageMax?: number;
  gender?: 'M' | 'F' | 'all';
  pregnancy?: boolean;
  condition?: string;
  range: string;
  unit?: string;
  criticalLow?: string;
  criticalHigh?: string;
}

interface TestCatalog {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  isActive: boolean;
  description?: string;
  sampleType?: string;
  turnaroundTime?: number;
  unit?: string;
  referenceRange?: string;
  referenceRanges?: ReferenceRangeItem[];
  createdAt: string;
  updatedAt: string;
}

interface TestCatalogCreate {
  name: string;
  code: string;
  category: string;
  price: number;
  description?: string;
  sampleType?: string;
  turnaroundTime?: number;
}

interface TestCatalogUpdate {
  name?: string;
  code?: string;
  category?: string;
  price?: number;
  isActive?: boolean;
  description?: string;
  sampleType?: string;
  turnaroundTime?: number;
}

export function useTestCatalog() {
  return useQuery({
    queryKey: ['test-catalog'],
    queryFn: async () => {
      return await testCatalogAPI.getAll();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — test catalog rarely changes
  });
}

export function useActiveTests() {
  return useQuery({
    queryKey: ['test-catalog', 'active'],
    queryFn: async () => {
      return await testCatalogAPI.getActive();
    },
    staleTime: 60 * 1000,
  });
}

// Hook to get ALL tests (including inactive ones) for result entry
export function useAllTests() {
  return useQuery({
    queryKey: ['test-catalog', 'all'],
    queryFn: async () => {
      return await testCatalogAPI.getAll();
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (test: TestCatalogCreate) => {
      return await testCatalogAPI.create(test);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['test-catalog', 'active'] });
    },
  });
}

export function useUpdateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TestCatalogUpdate }) => {
      return await testCatalogAPI.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['test-catalog', 'active'] });
    },
  });
}

export function useDeleteTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await testCatalogAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['test-catalog', 'active'] });
    },
  });
}
