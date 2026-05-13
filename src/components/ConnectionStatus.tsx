import { useWebSocket } from '@/context/WebSocketContext';
import { useSync } from '@/context/SyncContext';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, CloudOff, RefreshCw, Upload, Network } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

export function ConnectionStatus() {
  const { isConnected } = useWebSocket();
  const { isOnline, isApiReachable, isSyncing, pendingCount, lastSyncedAt, syncNow, connectionMode, lanBackendUrl } = useSync();

  const getStatusInfo = () => {
    if (isSyncing)
      return { label: 'Syncing…', variant: 'secondary' as const, icon: RefreshCw };
    if (connectionMode === 'lan-only')
      return { label: 'LAN Only', variant: 'outline' as const, icon: Network };
    if (!isOnline)
      return { label: 'Offline', variant: 'destructive' as const, icon: WifiOff };
    if (!isApiReachable)
      return { label: 'Server Unreachable', variant: 'destructive' as const, icon: CloudOff };
    if (isConnected)
      return { label: 'Online', variant: 'default' as const, icon: Wifi };
    return { label: 'Online (no realtime)', variant: 'outline' as const, icon: Wifi };
  };

  const { label, variant, icon: Icon } = getStatusInfo();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 no-print">
      {pendingCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 cursor-pointer" onClick={syncNow}>
              <Upload className="w-3 h-3" />
              {pendingCount} pending
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {pendingCount} change{pendingCount > 1 ? 's' : ''} waiting to sync.
            {isApiReachable ? ' Click to sync now.' : ' Will sync when server is reachable.'}
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={`gap-2 cursor-pointer ${isSyncing ? 'animate-pulse' : ''}`}
            onClick={syncNow}
          >
            <Icon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {connectionMode === 'lan-only' && (
            <p className="text-xs font-medium text-blue-600 mb-1">
              Connected via local network{lanBackendUrl ? ` (${lanBackendUrl})` : ''}
            </p>
          )}
          {lastSyncedAt
            ? `Last synced: ${new Date(lastSyncedAt).toLocaleTimeString()}`
            : 'Not synced yet'}
          {connectionMode === 'offline' && (
            <p className="text-xs mt-1">Working offline with cached data</p>
          )}
          {connectionMode === 'lan-only' && (
            <p className="text-xs mt-1">Reception & Lab can communicate on this network</p>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
