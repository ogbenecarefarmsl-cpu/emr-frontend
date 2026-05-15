import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface ReportMetadata {
  reportId: string;
  generatedAt: string;
  generatedBy: string;
}

export interface PatientInfo {
  patientId: string;
  fullName: string;
  age: number;
  ageValue?: number;
  ageUnit?: string;
  dateOfBirth: string;
  gender: string;
  mrn?: string;
  phone?: string;
  address?: string;
}

export interface OrderInfo {
  orderNumber: string;
  orderDate: string;
  collectedAt?: string;
  receivedAt?: string;
  reportedAt?: string;
  priority: string;
  orderingPhysician?: string;
}

export interface ResultItem {
  testCode: string;
  testName: string;
  panelCode?: string;
  panelName?: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  resultedAt: string;
  comments?: string;
  isAmended: boolean;
  amendmentReason?: string;
  subcategory?: string;
  menstrualPhase?: string;
  allReferenceRanges?: string;
}

export interface ResultCategory {
  category: string;
  categoryDisplayName: string;
  results: ResultItem[];
}

export interface VerificationInfo {
  performedBy?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface LaboratoryInfo {
  name: string;
  logo?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  licenseNumber?: string;
  accreditation?: string;
}

export interface PanelInterpretationInfo {
  panelCode: string;
  panelName: string;
  wbcMessage?: string;
  rbcMessage?: string;
  pltMessage?: string;
  generalMessage?: string;
  interpretation?: string;
  aiProvider?: string;
  aiGeneratedAt?: string;
}

export interface LabResultReport {
  reportMetadata: ReportMetadata;
  patientInfo: PatientInfo;
  orderInfo: OrderInfo;
  resultsByCategory: ResultCategory[];
  panelInterpretations: PanelInterpretationInfo[];
  verificationInfo: VerificationInfo;
  laboratoryInfo: LaboratoryInfo;
}

async function fetchLabReport(orderId: string): Promise<LabResultReport> {
  if (!orderId) throw new Error('Order ID is required');
  const response = await api.get(`/reports/lab-results/${orderId}`);
  return response.data;
}

export function useLabReport(orderId: string) {
  const { data: reportData, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['lab-report', orderId],
    queryFn: () => fetchLabReport(orderId),
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  return {
    reportData: reportData || null,
    loading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
