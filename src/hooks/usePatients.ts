import { patientsAPI, getAccessToken } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  age: number;
  ageValue?: number;
  ageUnit?: 'years' | 'months' | 'weeks' | 'days';
  gender: 'M' | 'F' | 'O';
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  nationality?: string;
  mrn?: string;
  patientCategory?: 'private' | 'nhis' | 'corporate' | 'family' | 'staff' | 'other';
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  medicalHistory?: string;
  currentMedications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  corporateEmployer?: string;
  corporateStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

interface PatientCreate {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  age: number;
  ageValue?: number;
  ageUnit?: 'years' | 'months' | 'weeks' | 'days';
  gender: 'M' | 'F' | 'O';
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  nationality?: string;
  mrn?: string;
  patientCategory?: 'private' | 'nhis' | 'corporate' | 'family' | 'staff' | 'other';
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  nextOfKinRelationship?: string;
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  medicalHistory?: string;
  currentMedications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  corporateEmployer?: string;
  corporateStaffId?: string;
}

type PatientUpdate = Partial<PatientCreate>;

const isValidResourceId = (id?: string): boolean => {
  if (!id) {
    return false;
  }

  const trimmed = id.trim().toLowerCase();
  return trimmed !== 'undefined' && trimmed !== 'null' && trimmed.length > 0;
};

function normalizePatient(patient: any): Patient {
  const age = Number(patient?.age ?? 0);
  const ageValue = Number(patient?.ageValue ?? patient?.age_value ?? age);

  return {
    ...patient,
    id: patient?.id || patient?._id,
    patientId: patient?.patientId || patient?.patient_id || '-',
    firstName: patient?.firstName || patient?.first_name || '',
    lastName: patient?.lastName || patient?.last_name || '',
    age: Number.isFinite(age) ? age : 0,
    ageValue: Number.isFinite(ageValue) ? ageValue : undefined,
    ageUnit: patient?.ageUnit || patient?.age_unit,
    createdAt: patient?.createdAt || patient?.created_at,
    updatedAt: patient?.updatedAt || patient?.updated_at,
  } as Patient;
}

export interface PatientResult {
  id: string;
  orderId?: string;
  orderNumber?: string;
  testCode: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low';
  status?: 'preliminary' | 'verified' | 'amended';
  resultedAt?: string;
  createdAt?: string;
}

function normalizePatientResult(result: any): PatientResult {
  const orderRef = result.orderId || result.order || result.orders;

  return {
    id: result.id || result._id,
    orderId:
      (typeof orderRef === 'string' ? orderRef : orderRef?.id || orderRef?._id) ||
      result.order_id ||
      result.orderId,
    orderNumber:
      (typeof orderRef === 'object' ? orderRef?.orderNumber || orderRef?.order_number : undefined) ||
      result.orderNumber ||
      result.order_number,
    testCode: result.testCode || result.test_code || '',
    testName: result.testName || result.test_name || result.testCode || result.test_code || '',
    value: result.value ?? '',
    unit: result.unit,
    referenceRange: result.referenceRange || result.reference_range,
    flag: result.flag,
    status: result.status,
    resultedAt: result.resultedAt || result.resulted_at,
    createdAt: result.createdAt || result.created_at,
  };
}

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const response = await patientsAPI.getAll();
      const list = Array.isArray(response) ? response : response?.data || [];
      return list.map((patient: any) => normalizePatient(patient));
    },
    staleTime: 2 * 60 * 1000, // 2 minutes — avoid refetch on every mount
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      const response = await patientsAPI.getById(id);
      const patient = response?.data || response;
      return normalizePatient(patient);
    },
    enabled: isValidResourceId(id),
    staleTime: 2 * 60 * 1000,
  });
}

export function useSearchPatients(searchTerm: string) {
  return useQuery({
    queryKey: ['patients', 'search', searchTerm],
    queryFn: async () => {
      try {
        // If no search term, get all patients
        if (!searchTerm || searchTerm.trim().length === 0) {
          const response = await patientsAPI.getAll();
          const list = Array.isArray(response) ? response : response?.data || [];
          return list.map((patient: any) => normalizePatient(patient));
        }
        
        // If search term is too short, return empty
        if (searchTerm.length < 2) {
          return [];
        }
        
        // Backend returns Patient[] directly for search
        const response = await patientsAPI.search(searchTerm);
        const list = Array.isArray(response) ? response : response?.data || [];
        return list.map((patient: any) => normalizePatient(patient));
      } catch (error) {
        console.error('useSearchPatients error:', error);
        return [];
      }
    },
    enabled: !!getAccessToken(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (patient: PatientCreate) => {
      return await patientsAPI.create(patient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PatientUpdate }) => {
      return await patientsAPI.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useDepositWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, notes, paymentMethod }: { id: string; amount: number; notes?: string; paymentMethod?: string }) => {
      return await patientsAPI.depositWallet(id, amount, notes, paymentMethod);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients', variables.id, 'wallet'] });
      queryClient.invalidateQueries({ queryKey: ['patients', variables.id, 'wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['payments'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['daily-income'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['revenue'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'], exact: false });
    },
  });
}

export function useWithdrawWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, notes }: { id: string; amount: number; notes?: string }) => {
      return await patientsAPI.withdrawWallet(id, amount, notes);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients', variables.id, 'wallet'] });
      queryClient.invalidateQueries({ queryKey: ['patients', variables.id, 'wallet-transactions'] });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await patientsAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function usePatientWallet(id: string) {
  return useQuery({
    queryKey: ['patients', id, 'wallet'],
    queryFn: async () => {
      const response = await patientsAPI.getWallet(id);
      return response;
    },
    enabled: isValidResourceId(id),
    staleTime: 30 * 1000,
  });
}

export function useWalletTransactions(id: string, page?: number, limit?: number) {
  return useQuery({
    queryKey: ['patients', id, 'wallet-transactions', page, limit],
    queryFn: async () => {
      const response = await patientsAPI.getWalletTransactions(id, page, limit);
      return response;
    },
    enabled: isValidResourceId(id),
    staleTime: 30 * 1000,
  });
}

export function usePatientResults(id: string) {
  return useQuery({
    queryKey: ['patients', id, 'results'],
    queryFn: async () => {
      const response = await patientsAPI.getResults(id);
      const results = Array.isArray(response)
        ? response
        : response?.data || response?.results || [];

      return results.map((result: any) => normalizePatientResult(result));
    },
    enabled: isValidResourceId(id) && !!getAccessToken(),
    staleTime: 30 * 1000,
  });
}
