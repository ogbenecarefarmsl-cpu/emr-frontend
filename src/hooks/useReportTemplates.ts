import { reportTemplatesAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ReportTemplate {
  logo?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    abnormal?: string;
    critical?: string;
    text?: string;
  };
  headerSettings?: {
    showLogo?: boolean;
    labName?: string;
    title?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    showLabName?: boolean;
    showAddress?: boolean;
    showContact?: boolean;
    showWebsite?: boolean;
  };
  header?: {
    showLogo?: boolean;
    logoUrl?: string;
    logoWidth?: number;
    logoHeight?: number;
    labName?: string;
    tagline?: string;
    motto?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    headerBorderColor?: string;
    showHeaderBorder?: boolean;
  };
  patientSettings?: {
    showName?: boolean;
    showPatientId?: boolean;
    showAge?: boolean;
    showGender?: boolean;
    showDOB?: boolean;
    showMRN?: boolean;
    showPhone?: boolean;
  };
  patientInfo?: {
    showDoctor?: boolean;
    showMRN?: boolean;
    showPhone?: boolean;
    showAddress?: boolean;
  };
  patientSection?: {
    showDoctor?: boolean;
    showCopiesTo?: boolean;
    showCollectionDate?: boolean;
    showReceivedDate?: boolean;
    showReportedDate?: boolean;
    showPrintedDate?: boolean;
    backgroundColor?: string;
  };
  resultsSection?: {
    categoryHeaderColor?: string;
    tableHeaderColor?: string;
    abnormalColor?: string;
    criticalColor?: string;
  };
  footerSettings?: {
    showWave?: boolean;
    showDisclaimer?: boolean;
    disclaimerText?: string;
    showCriticalNote?: boolean;
    showCredentials?: boolean;
    endText?: string;
  };
  footer?: {
    showDisclaimer?: boolean;
    disclaimerText?: string;
    showWaveDesign?: boolean;
    waveColor1?: string;
    waveColor2?: string;
    footerText?: string;
    showVerification?: boolean;
    showStamp?: boolean;
    showSignatureLines?: boolean;
    showPageNumbers?: boolean;
  };
  styling?: {
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
  };
  paperSize?: string;
  orientation?: string;
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  paperSettings?: {
    size?: string;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
  };
  [key: string]: any;
}

export function useReportTemplates() {
  return useQuery({
    queryKey: ['report-templates'],
    queryFn: async () => {
      return await reportTemplatesAPI.getAll();
    },
  });
}

export function useDefaultTemplate() {
  return useQuery({
    queryKey: ['report-templates', 'default'],
    queryFn: async () => {
      return await reportTemplatesAPI.getDefault();
    },
  });
}

export function useReportTemplate(id: string) {
  return useQuery({
    queryKey: ['report-templates', id],
    queryFn: async () => {
      return await reportTemplatesAPI.getById(id);
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return await reportTemplatesAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await reportTemplatesAPI.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await reportTemplatesAPI.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
    },
  });
}

export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await reportTemplatesAPI.setDefault(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
    },
  });
}

export function useUploadLogo() {
  return useMutation({
    mutationFn: async (file: File) => {
      return await reportTemplatesAPI.uploadLogo(file);
    },
  });
}
