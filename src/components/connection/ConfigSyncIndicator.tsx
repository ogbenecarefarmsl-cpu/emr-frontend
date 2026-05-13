import { useEffect, useState } from 'react';
import { configSyncService } from '@/services/configSyncService';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export const ConfigSyncIndicator = () => {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Get initial sync time
    const syncTime = configSyncService.getLastSyncTime();
    setLastSync(syncTime);

    // Listen for config updates
    const unsubscribe = configSyncService.onConfigUpdate(() => {
      setLastSync(new Date());
      setSyncing(false);
    });

    // Update sync time every 10 seconds
    const interval = setInterval(() => {
      const syncTime = configSyncService.getLastSyncTime();
      setLastSync(syncTime);
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getTimeSinceSync = () => {
    if (!lastSync) return 'Never';
    
    const seconds = Math.floor((Date.now() - lastSync.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const handleManualSync = async () => {
    setSyncing(true);
    await configSyncService.syncNow();
    setSyncing(false);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      {syncing ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : lastSync ? (
        <CheckCircle className="w-3 h-3 text-green-500" />
      ) : (
        <AlertCircle className="w-3 h-3 text-gray-400" />
      )}
      <span>Config: {getTimeSinceSync()}</span>
      <button
        onClick={handleManualSync}
        disabled={syncing}
        className="text-blue-600 hover:text-blue-700 underline"
        title="Sync configuration now"
      >
        {syncing ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  );
};
