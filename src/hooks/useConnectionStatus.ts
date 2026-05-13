import { useState, useEffect } from 'react';
import { connectionManager } from '@/services/connectionManager';

interface ConnectionStatus {
  backend: 'local' | 'cloud' | 'offline';
  url: string;
  latency: number;
  online: boolean;
}

export const useConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    backend: 'offline',
    url: '',
    latency: 0,
    online: false,
  });

  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribe = connectionManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Initial check
    connectionManager.getBestBackend().catch(() => {
      // Ignore error, status will be updated via subscription
    });

    return unsubscribe;
  }, []);

  return status;
};

export const useConnectionConfig = () => {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('connection_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const updateConfig = (newConfig: any) => {
    localStorage.setItem('connection_config', JSON.stringify(newConfig));
    setConfig(newConfig);
    connectionManager.reloadConfiguration();
  };

  const resetConfig = () => {
    localStorage.removeItem('connection_config');
    setConfig(null);
    connectionManager.reloadConfiguration();
  };

  return {
    config,
    updateConfig,
    resetConfig,
  };
};
