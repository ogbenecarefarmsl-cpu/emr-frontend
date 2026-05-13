/// <reference types="vite/client" />

// vite-plugin-pwa virtual module types
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

// Electron API exposed via preload script
interface ElectronAPI {
  isElectron?: boolean;
  getServerUrl?: () => Promise<string | null>;
  setServerUrl?: (url: string) => Promise<{ success: boolean; error?: string }>;
  discoverBackend?: () => Promise<{ url: string } | null>;
}

interface Window {
  electronAPI?: ElectronAPI;
}

