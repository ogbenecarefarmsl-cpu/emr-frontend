export {};

interface PrintResult {
  success: boolean;
  error?: string;
  filePath?: string;
}

interface PrintOptions {
  copies?: number;
  pageSize?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  margins?: {
    marginType?: 'default' | 'none' | 'printableArea' | 'custom';
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  silent?: boolean;
  printerName?: string;
}

interface DiscoverResult {
  url: string;
  method: 'udp' | 'http-probe' | 'cached';
}

interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

interface UpdateStatusPayload {
  type: 'checking' | 'available' | 'not-available' | 'download-progress' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  message?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;

      // Network
      getOnlineStatus: () => Promise<boolean>;
      discoverBackend: () => Promise<DiscoverResult | null>;
      getLocalIPs: () => Promise<string[]>;
      setServerUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
      getServerUrl: () => Promise<string | null>;
      getUpdateUrl: () => Promise<string | null>;
      setUpdateUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
      checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
      installUpdateNow: () => Promise<{ success: boolean; error?: string }>;
      onUpdateStatus: (callback: (payload: UpdateStatusPayload) => void) => () => void;

      // Printing
      printSilent: (options?: PrintOptions) => Promise<PrintResult>;
      printWithDialog: () => Promise<PrintResult>;
      printHTML: (html: string, options?: PrintOptions) => Promise<PrintResult>;
      printToPDF: (options?: Partial<PrintOptions>) => Promise<PrintResult>;
      getPrinters: () => Promise<PrinterInfo[]>;
    };
  }
}
