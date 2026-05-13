import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useUsers, useAssignRole, useRemoveRole } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, UserPlus, Shield, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const roleColors: Record<AppRole, string> = {
  admin: 'bg-status-critical/10 text-status-critical border-status-critical/20',
  receptionist: 'bg-primary/10 text-primary border-primary/20',
  lab_tech: 'bg-status-normal/10 text-status-normal border-status-normal/20',
};

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrator',
  receptionist: 'Receptionist',
  lab_tech: 'Lab Technician',
};

export default function UserManagement() {
  const { profile } = useAuth();
  const { data: users, isLoading } = useUsers();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState<AppRole | ''>('');

  const filteredUsers = users?.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    );
  });

  const handleAssignRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      await assignRole.mutateAsync({ userId: selectedUser, role: newRole });
      toast.success('Role assigned successfully');
      setShowRoleDialog(false);
      setNewRole('');
      setSelectedUser(null);
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      await removeRole.mutateAsync({ userId, role });
      toast.success('Role removed');
    } catch (error) {
      toast.error('Failed to remove role');
    }
  };

  const selectedUserData = users?.find(u => u.id === selectedUser);

  return (
    <RoleLayout 
      title="User Management" 
      subtitle="Manage user accounts and role assignments"
      role="admin"
      userName={profile?.full_name}
    >
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search users..." 
            className="pl-10 w-80"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Button disabled>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold">{users?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Administrators</p>
          <p className="text-2xl font-bold">
            {users?.filter(u => u.user_roles.some(r => r.role === 'admin')).length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Receptionists</p>
          <p className="text-2xl font-bold">
            {users?.filter(u => u.user_roles.some(r => r.role === 'receptionist')).length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Lab Technicians</p>
          <p className="text-2xl font-bold">
            {users?.filter(u => u.user_roles.some(r => r.role === 'lab_tech')).length || 0}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Department</th>
                <th>Roles</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers?.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{user.department || '-'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {user.user_roles.length === 0 ? (
                        <span className="text-muted-foreground text-sm">No roles</span>
                      ) : (
                        user.user_roles.map(role => (
                          <Badge 
                            key={role.id} 
                            variant="outline"
                            className={cn('gap-1', roleColors[role.role])}
                          >
                            {roleLabels[role.role]}
                            <button
                              onClick={() => handleRemoveRole(user.id, role.role)}
                              className="ml-1 hover:bg-background/50 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user.id);
                        setShowRoleDialog(true);
                      }}
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      Add Role
                    </Button>
                  </td>
                </tr>
              ))}
              {(!filteredUsers || filteredUsers.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
          </DialogHeader>
          
          {selectedUserData && (
            <div className="py-4">
              <div className="bg-muted rounded-lg p-4 mb-4">
                <p className="text-sm text-muted-foreground">User</p>
                <p className="font-medium">{selectedUserData.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedUserData.email}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Role</label>
                <Select value={newRole} onValueChange={v => setNewRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(['admin', 'receptionist', 'lab_tech'] as AppRole[]).map(role => {
                      const hasRole = selectedUserData.user_roles.some(r => r.role === role);
                      return (
                        <SelectItem key={role} value={role} disabled={hasRole}>
                          {roleLabels[role]} {hasRole && '(assigned)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={!newRole || assignRole.isPending}>
              {assignRole.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
