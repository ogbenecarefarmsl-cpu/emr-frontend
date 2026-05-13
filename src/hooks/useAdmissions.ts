import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admissionsAPI } from '@/services/api';

export function useAdmissionsDashboard(mine = false) {
  return useQuery({
    queryKey: ['admissions', 'dashboard', mine],
    queryFn: () => admissionsAPI.getDashboard(mine),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });
}

export function useActiveAdmissions() {
  return useQuery({
    queryKey: ['admissions', 'active'],
    queryFn: () => admissionsAPI.getActive(),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });
}

export function useAdmission(id: string | null | undefined) {
  return useQuery({
    queryKey: ['admissions', id],
    queryFn: () => (id ? admissionsAPI.getById(id) : null),
    enabled: !!id,
    staleTime: 10 * 1000,
    refetchInterval: id ? 30 * 1000 : false,
  });
}

export function useFluidBalance(id: string | null | undefined) {
  return useQuery({
    queryKey: ['admissions', id, 'fluid-balance'],
    queryFn: () => (id ? admissionsAPI.getFluidBalance(id) : null),
    enabled: !!id,
    staleTime: 10 * 1000,
  });
}

export function useCreateAdmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: admissionsAPI.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions'] });
      qc.invalidateQueries({ queryKey: ['visits'] });
    },
  });
}

export function useRecordVitals(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vitals: any) => admissionsAPI.recordVitals(admissionId!, vitals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
      qc.invalidateQueries({ queryKey: ['admissions'] });
    },
  });
}

export function useRecordMedication(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (med: any) => admissionsAPI.recordMedication(admissionId!, med),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
    },
  });
}

export function useRecordFluid(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: any) => admissionsAPI.recordFluid(admissionId!, entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
      qc.invalidateQueries({ queryKey: ['admissions', admissionId, 'fluid-balance'] });
    },
  });
}

export function useAddNursingNote(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: any) => admissionsAPI.addNursingNote(admissionId!, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
    },
  });
}

export function useAddCarePlanItem(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: any) => admissionsAPI.addCarePlanItem(admissionId!, item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
    },
  });
}

export function useResolveCarePlanItem(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ index, evaluation }: { index: number; evaluation?: string }) =>
      admissionsAPI.resolveCarePlanItem(admissionId!, index, evaluation),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
    },
  });
}

export function useReportIncident(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incident: any) => admissionsAPI.reportIncident(admissionId!, incident),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions', admissionId] });
    },
  });
}

export function useTransferAdmission(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { wardType?: string; bedNumber?: string; notes?: string }) =>
      admissionsAPI.transfer(admissionId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions'] });
    },
  });
}

export function useDischargeAdmission(admissionId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { dischargeNotes?: string; dischargeDiagnosis?: string; dischargeInstructions?: string }) =>
      admissionsAPI.discharge(admissionId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admissions'] });
      qc.invalidateQueries({ queryKey: ['visits'] });
    },
  });
}
