import { visitsAPI, pendingOrdersAPI, prescriptionsAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CreateVisitData {
  patientId: string;
  doctorId?: string;
  visitType?: 'new' | 'follow_up' | 'emergency';
  consultationFee: number;
  chiefComplaint?: string;
  notes?: string;
  temperature?: number;
  serviceType?: 'normal_consultation' | 'specialist_consultation' | 'observation_4h' | 'procedure';
  specialistId?: string;
  procedureType?: string;
  rapidTestsRequested?: ('malaria' | 'typhoid')[];
  selfPayOverride?: boolean;
}

export interface InsuranceEligibility {
  patientId: string;
  hasInsurance: boolean;
  status: 'self_pay' | 'eligible' | 'waiting_period' | 'blocked';
  eligible: boolean;
  reason: string;
  nextEligibleAt?: string;
  lastCoveredVisitAt?: string;
  insurance?: {
    programCode?: string;
    subEntityCode?: string;
    memberNumber?: string;
  };
  block?: any;
}

export function useVisits(status?: string) {
  return useQuery({
    queryKey: ['visits', status],
    queryFn: async () => {
      const params: any = {};
      if (status && status !== 'all') {
        params.status = status;
      }
      return await visitsAPI.getAll(params);
    },
    staleTime: 30 * 1000,
  });
}

export function useVisitsByRoom(roomType: string | null | undefined) {
  return useQuery({
    queryKey: ['visits', 'room', roomType],
    queryFn: async () => {
      return await visitsAPI.getAll({ roomType, status: 'in_progress' });
    },
    enabled: !!roomType,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useRooms(roomType?: string, status?: string) {
  return useQuery({
    queryKey: ['rooms', roomType, status],
    queryFn: async () => {
      return (await import('@/services/api')).roomsAPI.getAll({ roomType, status });
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useVisit(id: string) {
  return useQuery({
    queryKey: ['visits', id],
    queryFn: async () => {
      return await visitsAPI.getById(id);
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useDoctorQueue(doctorId?: string) {
  return useQuery({
    queryKey: ['visits', 'doctor-queue', doctorId],
    queryFn: async () => {
      return await visitsAPI.getDoctorQueue(doctorId);
    },
    staleTime: 10 * 1000, // 10 seconds - refresh more often for live queue
    refetchInterval: 15 * 1000, // Auto-refetch every 15 seconds
  });
}

export function useReceptionDashboard() {
  return useQuery({
    queryKey: ['reception-dashboard'],
    queryFn: async () => visitsAPI.getReceptionDashboard(),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useDoctorDashboard() {
  return useQuery({
    queryKey: ['visits', 'doctor-dashboard'],
    queryFn: async () => {
      return await visitsAPI.getDoctorDashboard();
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useDoctorPatients(params: { page?: number; limit?: number; search?: string; daysBack?: number; enabled?: boolean }) {
  const { enabled = true, ...requestParams } = params;
  return useQuery({
    queryKey: ['visits', 'doctor-patients', requestParams],
    queryFn: async () => {
      return await visitsAPI.getDoctorPatients(requestParams);
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export function usePatientVisits(patientId: string) {
  return useQuery({
    queryKey: ['visits', 'patient', patientId],
    queryFn: async () => {
      return await visitsAPI.getByPatient(patientId);
    },
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useInsuranceEligibility(patientId?: string) {
  return useQuery<InsuranceEligibility>({
    queryKey: ['visits', 'insurance-eligibility', patientId],
    queryFn: () => visitsAPI.getInsuranceEligibility(patientId!),
    enabled: !!patientId,
    staleTime: 30 * 1000,
  });
}

export function useAwaitingLabPayment() {
  return useQuery({
    queryKey: ['visits', 'awaiting-lab-payment'],
    queryFn: async () => {
      return await visitsAPI.getAwaitingLabPayment();
    },
    staleTime: 15 * 1000,
  });
}

export function useAwaitingPharmacyPayment() {
  return useQuery({
    queryKey: ['visits', 'awaiting-pharmacy-payment'],
    queryFn: async () => {
      return await visitsAPI.getAwaitingPharmacyPayment();
    },
    staleTime: 15 * 1000,
  });
}

export function useAwaitingTriage() {
  return useQuery({
    queryKey: ['visits', 'awaiting-triage'],
    queryFn: async () => {
      return await visitsAPI.getAwaitingTriage();
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useCompleteTriage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, data }: { visitId: string; data: any }) => {
      return await visitsAPI.completeTriage(visitId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to complete triage');
    },
  });
}

export function useAddRapidTestResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, data }: {
      visitId: string;
      data: { testType: 'malaria' | 'typhoid'; result: 'positive' | 'negative'; parasiteCount?: number; antigen?: string; notes?: string };
    }) => {
      return await visitsAPI.addRapidTestResult(visitId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['daily-income'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to record rapid test result');
    },
  });
}

export function useReferToSpecialist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ visitId, data }: { visitId: string; data: { specialistId: string; reason: string; notes?: string } }) => {
      return await visitsAPI.referToSpecialist(visitId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to refer to specialist');
    },
  });
}

export function useAcceptReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (visitId: string) => {
      return await visitsAPI.acceptReferral(visitId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to accept referral');
    },
  });
}

export function useVisitStats(date?: string) {
  return useQuery({
    queryKey: ['visits', 'stats', date],
    queryFn: async () => {
      return await visitsAPI.getStats(date);
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateVisitData) => {
      return await visitsAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create visit');
    },
  });
}

export function useMarkConsultationPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, paymentMethod = 'cash' }: { visitId: string; paymentMethod?: string }) => {
      return await visitsAPI.markConsultationPaid(visitId, paymentMethod);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payments'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['outstanding-balances'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['daily-income'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['revenue'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to mark consultation paid');
    },
  });
}

export function useAcceptPatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (visitId: string) => {
      return await visitsAPI.acceptPatient(visitId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to accept patient');
    },
  });
}

export function useCompleteVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, data }: { visitId: string; data: any }) => {
      return await visitsAPI.complete(visitId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to complete visit');
    },
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, data }: { visitId: string; data: any }) => {
      return await visitsAPI.updateClinicalDraft(visitId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update visit');
    },
  });
}

// Pending Orders hooks
export function usePendingClinicalOrders(orderType?: string) {
  return useQuery({
    queryKey: ['orders', 'pending-clinical', orderType],
    queryFn: async () => {
      return await pendingOrdersAPI.getPendingClinical(orderType);
    },
    staleTime: 15 * 1000,
  });
}

export function useLabQueue() {
  return useQuery({
    queryKey: ['orders', 'lab-queue'],
    queryFn: async () => {
      return await pendingOrdersAPI.getLabQueue();
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function usePharmacyQueue() {
  return useQuery({
    queryKey: ['orders', 'pharmacy-queue'],
    queryFn: async () => {
      return await pendingOrdersAPI.getPharmacyQueue();
    },
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}

export function useMarkOrderPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, paymentMethod }: { orderId: string; paymentMethod: string }) => {
      return await pendingOrdersAPI.markAsPaid(orderId, paymentMethod);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['daily-income'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to mark order paid');
    },
  });
}

export function useDeleteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await visitsAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
      toast.success('Visit deleted');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete visit');
    },
  });
}

export function useDeletePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return await prescriptionsAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'], exact: false });
      toast.success('Prescription deleted');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete prescription');
    },
  });
}
