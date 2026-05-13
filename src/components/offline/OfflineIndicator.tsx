import { useSync } from '@/context/SyncContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const { isOnline, isApiReachable, isSyncing, pendingCount, syncNow, connectionMode } = useSync();

  const handleSync = async () => {
    try {
      await syncNow();
      toast.success('Sync completed successfully');
    } catch (error) {
      toast.error('Sync failed', {
        description: 'Please check your connection and try again'
      });
    }
  };

  // Fully offline
  if (!isOnline) {
    return (
      <Badge variant="destructive" className="gap-2">
        <WifiOff className="w-3 h-3" />
        Offline
        {pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
            {pendingCount}
          </span>
        )}
      </Badge>
    );
  }

  // Online but API not reachable
  if (!isApiReachable) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-2 border-yellow-500 text-yellow-700">
          <CloudOff className="w-3 h-3" />
          Server Unreachable
          {pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 rounded text-xs">
              {pendingCount}
            </span>
          )}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={isSyncing}
          className="h-7 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    );
  }

  // Connected - show connection mode
  const modeConfig = {
    'online': {
      icon: Cloud,
      label: 'Online',
      variant: 'default' as const,
      className: 'bg-green-50 border-green-500 text-green-700'
    },
    'lan-only': {
      icon: Wifi,
      label: 'LAN Only',
      variant: 'outline' as const,
      className: 'border-blue-500 text-blue-700'
    },
    'offline': {
      icon: AlertCircle,
      label: 'Offline',
      variant: 'destructive' as const,
      className: ''
    }
  };

  const config = modeConfig[connectionMode];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant} className={`gap-2 ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
        {isSyncing && <RefreshCw className="w-3 h-3 animate-spin ml-1" />}
        {pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
            {pendingCount}
          </span>
        )}
      </Badge>
      {pendingCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={isSyncing}
          className="h-7 px-2"
          title="Sync pending changes"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}
