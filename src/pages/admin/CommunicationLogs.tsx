import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useCommunicationLogs, useRealtimeCommunicationLogs } from '@/hooks/useCommunicationLogs';
import { useMachines } from '@/hooks/useMachines';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Eye, Radio, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommunicationLogs() {
  const { profile } = useAuth();
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const { data: machines } = useMachines();
  const { data: logs, isLoading, refetch } = useCommunicationLogs(
    selectedMachine === 'all' ? undefined : selectedMachine,
    100
  );
  const { logs: realtimeLogs, isConnected } = useRealtimeCommunicationLogs(
    selectedMachine === 'all' ? undefined : selectedMachine
  );

  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const displayLogs = realtimeLogs.length > 0 ? realtimeLogs : logs;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-status-normal" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-status-critical" />;
      default:
        return <AlertCircle className="w-4 h-4 text-status-warning" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'bg-status-normal/10 text-status-normal border-status-normal/20';
      case 'error':
        return 'bg-status-critical/10 text-status-critical border-status-critical/20';
      default:
        return 'bg-status-warning/10 text-status-warning border-status-warning/20';
    }
  };

  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setShowDetailDialog(true);
  };

  return (
    <RoleLayout 
      title="Communication Logs" 
      subtitle="Analyzer message history and monitoring"
      role="admin"
      userName={profile?.full_name}
    >
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Select value={selectedMachine} onValueChange={setSelectedMachine}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Machines</SelectItem>
              {machines?.map(machine => (
                <SelectItem key={machine.id} value={machine.id}>
                  {machine.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-lg">
            <Radio className={cn('w-4 h-4', isConnected ? 'text-status-normal animate-pulse' : 'text-muted-foreground')} />
            <span className="text-sm">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Messages</p>
          <p className="text-2xl font-bold">{displayLogs?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Processed</p>
          <p className="text-2xl font-bold text-status-normal">
            {displayLogs?.filter(l => l.status === 'processed').length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Errors</p>
          <p className="text-2xl font-bold text-status-critical">
            {displayLogs?.filter(l => l.status === 'error').length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Avg Processing Time</p>
          <p className="text-2xl font-bold">
            {displayLogs?.length 
              ? Math.round(displayLogs.reduce((sum, l) => sum + (l.processing_time_ms || 0), 0) / displayLogs.length)
              : 0}ms
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Machine</th>
                <th>Direction</th>
                <th>Protocol</th>
                <th>Message Type</th>
                <th>Status</th>
                <th>Results</th>
                <th>Processing Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayLogs?.map(log => {
                const machine = machines?.find(m => m.id === log.machine_id);
                return (
                  <tr key={log.id}>
                    <td className="text-sm">
                      {new Date(log.created_at).toLocaleTimeString()}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{machine?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{machine?.model}</p>
                      </div>
                    </td>
                    <td>
                      <Badge variant="outline" className={log.direction === 'inbound' ? 'bg-blue-50' : 'bg-green-50'}>
                        {log.direction}
                      </Badge>
                    </td>
                    <td className="font-mono text-sm">{log.protocol}</td>
                    <td className="font-mono text-sm">{log.message_type || '-'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <Badge variant="outline" className={getStatusColor(log.status)}>
                          {log.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="text-center">{log.results_count || 0}</td>
                    <td className="text-muted-foreground">{log.processing_time_ms || 0}ms</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(log)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(!displayLogs || displayLogs.length === 0) && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground">
                    No communication logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Timestamp</p>
                  <p className="font-medium">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Protocol</p>
                  <p className="font-mono">{selectedLog.protocol}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Message Type</p>
                  <p className="font-mono">{selectedLog.message_type || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Control ID</p>
                  <p className="font-mono">{selectedLog.message_control_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className={getStatusColor(selectedLog.status)}>
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processing Time</p>
                  <p>{selectedLog.processing_time_ms || 0}ms</p>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="bg-status-critical/10 border border-status-critical/20 rounded-lg p-4">
                  <p className="text-sm font-medium text-status-critical mb-1">Error Message</p>
                  <p className="text-sm">{selectedLog.error_message}</p>
                </div>
              )}

              {selectedLog.parsed_summary && (
                <div>
                  <p className="text-sm font-medium mb-2">Parsed Summary</p>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.parsed_summary, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.raw_message && (
                <div>
                  <p className="text-sm font-medium mb-2">Raw Message</p>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-96">
                    {selectedLog.raw_message}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
