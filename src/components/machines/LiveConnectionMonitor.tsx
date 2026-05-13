import { useRealtimeCommunicationLogs, useMachineConnectionStatus } from '@/hooks/useCommunicationLogs';
import { cn } from '@/lib/utils';
import { Activity, Check, X, Clock, Radio, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface LiveConnectionMonitorProps {
  machineId?: string;
  compact?: boolean;
}

export function LiveConnectionMonitor({ machineId, compact = false }: LiveConnectionMonitorProps) {
  const { logs, isConnected } = useRealtimeCommunicationLogs(machineId);
  const machineStatuses = useMachineConnectionStatus();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-2 h-2 rounded-full animate-pulse',
          isConnected ? 'bg-status-normal' : 'bg-muted-foreground'
        )} />
        <span className="text-xs text-muted-foreground">
          {isConnected ? 'Live' : 'Connecting...'}
        </span>
        {logs.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {logs.length} recent
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Radio className={cn(
            'w-4 h-4',
            isConnected ? 'text-status-normal animate-pulse' : 'text-muted-foreground'
          )} />
          <h3 className="font-semibold text-sm">Live Communication Monitor</h3>
        </div>
        <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
          {isConnected ? 'Connected' : 'Connecting...'}
        </Badge>
      </div>

      {/* Machine Status Overview */}
      {!machineId && Object.keys(machineStatuses).length > 0 && (
        <div className="p-4 border-b bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">Analyzer Status</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(machineStatuses).map(([id, status]) => (
              <div 
                key={id} 
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                  status.isOnline ? 'bg-status-normal/10 text-status-normal' : 'bg-muted text-muted-foreground'
                )}
              >
                <Wifi className="w-3 h-3" />
                <span className="font-mono">{id.slice(0, 8)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Stream */}
      <ScrollArea className="h-64">
        <div className="p-2 space-y-1">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Waiting for analyzer messages...</p>
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={cn(
                  'flex items-center gap-3 p-2 rounded text-xs hover:bg-muted/50 transition-colors',
                  log.status === 'error' && 'bg-destructive/5'
                )}
              >
                {/* Status Icon */}
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                  log.status === 'processed' ? 'bg-status-normal/10' : 
                  log.status === 'error' ? 'bg-destructive/10' : 'bg-muted'
                )}>
                  {log.status === 'processed' ? (
                    <Check className="w-3 h-3 text-status-normal" />
                  ) : log.status === 'error' ? (
                    <X className="w-3 h-3 text-destructive" />
                  ) : (
                    <Clock className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {log.protocol}
                    </Badge>
                    <span className="font-medium truncate">
                      {log.message_type || 'Unknown'}
                    </span>
                    {log.results_count && log.results_count > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {log.results_count} results
                      </Badge>
                    )}
                  </div>
                  {log.error_message && (
                    <p className="text-destructive truncate mt-0.5">{log.error_message}</p>
                  )}
                </div>

                {/* Timing */}
                <div className="text-right text-muted-foreground flex-shrink-0">
                  <p>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                  {log.processing_time_ms && (
                    <p className="text-[10px]">{log.processing_time_ms}ms</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
