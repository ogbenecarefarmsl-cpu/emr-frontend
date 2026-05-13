import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'sonner';

export interface PanelResults {
  panelCode: string;
  panelName: string;
  results: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  }>;
}

interface AiStatusResponse {
  configured: boolean;
  provider: string;
}

interface AiInterpretationResponse {
  interpretation: string;
}

/**
 * Hook to check AI status
 */
export function useAiStatus() {
  return useQuery<AiStatusResponse>({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const response = await api.get('/panel-interpretations/ai-status');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to generate AI interpretation for a single panel
 */
export function useGenerateAiInterpretation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, panel }: { orderId: string; panel: PanelResults }) => {
      const response = await api.post('/panel-interpretations/ai-generate', {
        orderId,
        panel,
      });
      return response.data as AiInterpretationResponse;
    },
    onSuccess: () => {
      toast.success('AI interpretation generated');
      // Invalidate the lab report query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['lab-report'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to generate interpretation';
      toast.error(message);
    },
  });
}

/**
 * Hook to generate AI interpretations for all panels
 */
export function useGenerateAllAiInterpretations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, panels }: { orderId: string; panels: PanelResults[] }) => {
      const response = await api.post('/panel-interpretations/ai-generate-all', {
        orderId,
        panels,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const successCount = data.filter((d: any) => d.success).length;
      const failCount = data.length - successCount;
      
      if (failCount === 0) {
        toast.success(`Generated ${successCount} AI interpretations`);
      } else {
        toast.warning(`Generated ${successCount} interpretations, ${failCount} failed`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['lab-report'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to generate interpretations';
      toast.error(message);
    },
  });
}

/**
 * Hook to update panel interpretation (for manual edits)
 */
export function useUpdatePanelInterpretation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      orderId, 
      panelCode, 
      interpretation 
    }: { 
      orderId: string; 
      panelCode: string; 
      interpretation: string;
    }) => {
      const response = await api.put(
        `/panel-interpretations/order/${orderId}/panel/${panelCode}`,
        { interpretation }
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Interpretation saved');
      queryClient.invalidateQueries({ queryKey: ['lab-report'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to save interpretation';
      toast.error(message);
    },
  });
}