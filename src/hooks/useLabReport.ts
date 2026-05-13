import { useState, useEffect } from 'react';
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

/**
 * Custom hook for fetching lab result report data
 * 
 * Fetches a formatted lab results report from the backend API for a given order ID.
 * Handles loading states, errors, and provides a refetch function for retry logic.
 * 
 * @param orderId - MongoDB ObjectId of the order
 * @returns Object containing report data, loading state, error message, and refetch function
 * 
 * @example
 * ```tsx
 * const { reportData, loading, error, refetch } = useLabReport(orderId);
 * 
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage message={error} onRetry={refetch} />;
 * return <ReportView data={reportData} />;
 * ```
 */
export function useLabReport(orderId: string) {
  const [reportData, setReportData] = useState<LabResultReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    if (!orderId) {
      setError('Order ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/reports/lab-results/${orderId}`);
      setReportData(response.data);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Failed to load report';
      setError(errorMessage);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchReport();
    }
  }, [orderId]);

  return { reportData, loading, error, refetch: fetchReport };
}
