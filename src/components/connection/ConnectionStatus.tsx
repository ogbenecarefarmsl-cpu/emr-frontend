import { useEffect, useState } from 'react';
import { connectionManager } from '@/services/connectionManager';
import { Wifi, WifiOff, Cloud, Server, AlertCircle } from 'lucide-react';

interface ConnectionStatus {
  backend: 'local' | 'cloud' | 'offline';
  url: string;
  latency: number;
  online: boolean;
}

export const ConnectionStatusDetailed = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    backend: 'offline',
    url: '',
    latency: 0,
    online: false,
  });

  useEffect(() => {
    const unsubscribe = connectionManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    connectionManager.getBestBackend().catch(() => {});

    return unsubscribe;
  }, []);

  const getStatusColor = () => {
    switch (status.backend) {
      case 'local':
        return 'border-green-500 bg-green-50';
      case 'cloud':
        return 'border-blue-500 bg-blue-50';
      case 'offline':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getStatusIcon = () => {
    switch (status.backend) {
      case 'local':
        return <Server className="w-5 h-5 text-green-600" />;
      case 'cloud':
        return <Cloud className="w-5 h-5 text-blue-600" />;
      case 'offline':
        return <WifiOff className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (status.backend) {
      case 'local':
        return 'Local Network';
      case 'cloud':
        return 'Cloud Server';
      case 'offline':
        return 'Offline Mode';
      default:
        return 'Unknown';
    }
  };

  const getStatusDescription = () => {
    switch (status.backend) {
      case 'local':
        return 'Connected to local network server for fastest performance';
      case 'cloud':
        return 'Connected to cloud server - local network unavailable';
      case 'offline':
        return 'All servers unavailable - operations will be queued and synced when connection is restored';
      default:
        return '';
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor()}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getStatusIcon()}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{getStatusText()}</h3>
            {status.online && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                Online
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{getStatusDescription()}</p>
          {status.url && (
            <p className="text-xs text-gray-500 font-mono">{status.url}</p>
          )}
        </div>
      </div>
    </div>
  );
};
