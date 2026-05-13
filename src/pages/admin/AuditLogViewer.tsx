import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, Loader2, FileText } from 'lucide-react';
import { auditAPI } from '@/services/api';
import { useQuery } from '@tanstack/react-query';

export default function AuditLogViewer() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', tableFilter, actionFilter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (tableFilter !== 'all') params.tableName = tableFilter;
      if (actionFilter !== 'all') params.action = actionFilter;
      return await auditAPI.getLogs(params);
    }
  });

  const filteredLogs = logs?.filter((log: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.tableName?.toLowerCase().includes(search) ||
      log.action?.toLowerCase().includes(search) ||
      log.user?.fullName?.toLowerCase().includes(search)
    );
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-status-normal/10 text-status-normal border-status-normal/20';
      case 'UPDATE':
        return 'bg-status-warning/10 text-status-warning border-status-warning/20';
      case 'DELETE':
        return 'bg-status-critical/10 text-status-critical border-status-critical/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <RoleLayout 
      title="Audit Log Viewer" 
      subtitle="System activity and change tracking"
      role="admin"
      userName={profile?.full_name}
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tables</SelectItem>
            <SelectItem value="patients">Patients</SelectItem>
            <SelectItem value="orders">Orders</SelectItem>
            <SelectItem value="results">Results</SelectItem>
            <SelectItem value="user_roles">User Roles</SelectItem>
            <SelectItem value="test_catalog">Test Catalog</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="INSERT">Insert</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Logs</p>
          <p className="text-2xl font-bold">{logs?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Inserts</p>
          <p className="text-2xl font-bold text-status-normal">
            {logs?.filter((l: any) => l.action === 'INSERT').length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Updates</p>
          <p className="text-2xl font-bold text-status-warning">
            {logs?.filter((l: any) => l.action === 'UPDATE').length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Deletes</p>
          <p className="text-2xl font-bold text-status-critical">
            {logs?.filter((l: any) => l.action === 'DELETE').length || 0}
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
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Table</th>
                <th>Record ID</th>
                <th>IP Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs?.map((log: any) => (
                <tr key={log.id}>
                  <td className="text-sm">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <div>
                      <p className="font-medium">{log.user?.fullName || 'System'}</p>
                      <p className="text-xs text-muted-foreground">{log.user?.email}</p>
                    </div>
                  </td>
                  <td>
                    <Badge variant="outline" className={getActionColor(log.action)}>
                      {log.action}
                    </Badge>
                  </td>
                  <td className="font-mono text-sm">{log.tableName}</td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {log.recordId?.substring(0, 8)}...
                  </td>
                  <td className="text-sm text-muted-foreground">{log.ipAddress || '-'}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetailDialog(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {(!filteredLogs || filteredLogs.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No audit logs found</p>
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
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Timestamp</p>
                  <p className="font-medium">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-medium">{selectedLog.user?.fullName || 'System'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Action</p>
                  <Badge variant="outline" className={getActionColor(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Table</p>
                  <p className="font-mono">{selectedLog.tableName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Record ID</p>
                  <p className="font-mono text-xs">{selectedLog.recordId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IP Address</p>
                  <p>{selectedLog.ipAddress || 'Not recorded'}</p>
                </div>
              </div>

              {selectedLog.oldData && (
                <div>
                  <p className="text-sm font-medium mb-2">Old Data</p>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.oldData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newData && (
                <div>
                  <p className="text-sm font-medium mb-2">New Data</p>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.newData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <p className="text-sm text-muted-foreground">User Agent</p>
                  <p className="text-xs font-mono">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
