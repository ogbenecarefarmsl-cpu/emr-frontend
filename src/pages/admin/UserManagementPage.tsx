import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useUsers, useAssignRole, useRemoveRole } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Shield, Trash2, Loader2, Mail } from 'lucide-react';
import { usersAPI } from '@/services/api';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export default function UserManagementPage() {
  const { profile } = useAuth();
  const { data: users, isLoading } = useUsers();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('receptionist');
  const [isCreating, setIsCreating] = useState(false);
  
  // Create user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('receptionist');

  const roleColors: Record<AppRole, string> = {
    admin: 'bg-status-critical/10 text-status-critical border-status-critical/20',
    receptionist: 'bg-primary/10 text-primary border-primary/20',
    lab_tech: 'bg-status-normal/10 text-status-normal border-status-normal/20',
    doctor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    specialist: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    nurse: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    pharmacist: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    inventory_manager: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  };

  const roleLabels: Record<AppRole, string> = {
    admin: 'Administrator',
    receptionist: 'Receptionist',
    lab_tech: 'Lab Technician',
    doctor: 'Doctor',
    specialist: 'Specialist',
    nurse: 'Nurse',
    pharmacist: 'Pharmacist',
    inventory_manager: 'Inventory Manager',
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;

    try {
      await assignRole.mutateAsync({
        userId: selectedUser.id,
        role: selectedRole
      });
      toast.success(`Role ${roleLabels[selectedRole]} assigned to ${selectedUser.full_name}`);
      setShowRoleDialog(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('duplicate')) {
        toast.error('User already has this role');
      } else {
        toast.error('Failed to assign role');
      }
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole, userName: string) => {
    if (!confirm(`Remove ${roleLabels[role]} role from ${userName}?`)) return;

    try {
      await removeRole.mutateAsync({ userId, role });
      toast.success(`Role removed from ${userName}`);
    } catch (error) {
      toast.error('Failed to remove role');
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newUserPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsCreating(true);
    try {
      // Step 1: Create user using backend API
      const newUser = await usersAPI.create({
        email: newUserEmail,
        password: newUserPassword,
        fullName: newUserName
      });

      // Step 2: Assign role to the newly created user
      await usersAPI.assignRole(newUser.id, newUserRole);

      toast.success(`User ${newUserName} created successfully with ${roleLabels[newUserRole]} role`);
      
      // Reset form
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('receptionist');
      setShowCreateDialog(false);
      
    } catch (error: unknown) {
      console.error('Error creating user:', error);
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      if (axiosError.response?.data?.message?.includes('duplicate') || axiosError.response?.data?.message?.includes('already exists')) {
        toast.error('A user with this email already exists');
      } else {
        toast.error(axiosError.response?.data?.message || axiosError.message || 'Failed to create user');
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <RoleLayout 
      title="Staff & Roles" 
      subtitle="Manage staff accounts and role-based access"
      role="admin"
      userName={profile?.full_name}
    >
      {/* Header with Create Button */}
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Create User
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
          <p className="text-2xl font-bold text-purple-600">
            {users?.filter(u => u.user_roles.some(r => r.role === 'admin')).length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Receptionists</p>
          <p className="text-2xl font-bold text-blue-600">
            {users?.filter(u => u.user_roles.some(r => r.role === 'receptionist')).length || 0}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Lab Technicians</p>
          <p className="text-2xl font-bold text-green-600">
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
                <th>Email</th>
                <th>Department</th>
                <th>Roles</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        {user.id === profile?.id && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{user.email}</span>
                    </div>
                  </td>
                  <td>{user.department || '-'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {user.user_roles.length > 0 ? (
                        user.user_roles.map(roleItem => (
                          <Badge
                            key={roleItem.id}
                            variant="outline"
                            className={roleColors[roleItem.role]}
                          >
                            {roleLabels[roleItem.role]}
                            <button
                              onClick={() => handleRemoveRole(user.id, roleItem.role, user.full_name)}
                              className="ml-1 hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No roles</span>
                      )}
                    </div>
                  </td>
                  <td className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowRoleDialog(true);
                      }}
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      Assign Role
                    </Button>
                  </td>
                </tr>
              ))}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Role Assignment Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Current Roles:</p>
              <div className="flex flex-wrap gap-2">
                {selectedUser?.user_roles.length > 0 ? (
                  selectedUser.user_roles.map((roleItem: any) => (
                    <Badge
                      key={roleItem.id}
                      variant="outline"
                      className={roleColors[roleItem.role]}
                    >
                      {roleLabels[roleItem.role]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No roles assigned</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Role to Assign</label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-600" />
                      Administrator
                    </div>
                  </SelectItem>
                  <SelectItem value="receptionist">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      Receptionist
                    </div>
                  </SelectItem>
                  <SelectItem value="lab_tech">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-600" />
                      Lab Technician
                    </div>
                  </SelectItem>
                  <SelectItem value="doctor">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      Doctor
                    </div>
                  </SelectItem>
                  <SelectItem value="specialist">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      Specialist
                    </div>
                  </SelectItem>
                  <SelectItem value="nurse">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-pink-500" />
                      Nurse
                    </div>
                  </SelectItem>
                  <SelectItem value="pharmacist">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-600" />
                      Pharmacist
                    </div>
                  </SelectItem>
                  <SelectItem value="inventory_manager">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-600" />
                      Inventory Manager
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Role Permissions:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {selectedRole === 'admin' && (
                  <>
                    <li>• Full system access</li>
                    <li>• User management</li>
                    <li>• Test catalog configuration</li>
                    <li>• Reports and analytics</li>
                  </>
                )}
                {selectedRole === 'receptionist' && (
                  <>
                    <li>• Patient registration</li>
                    <li>• Order creation</li>
                    <li>• Payment processing</li>
                    <li>• View results</li>
                  </>
                )}
                {selectedRole === 'lab_tech' && (
                  <>
                    <li>• Sample collection</li>
                    <li>• Result entry</li>
                    <li>• Result verification</li>
                    <li>• Machine management</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={assignRole.isPending}
            >
              {assignRole.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Shield className="w-4 h-4 mr-2" />
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Full Name</Label>
              <Input
                id="new-user-name"
                placeholder="John Doe"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                type="email"
                placeholder="john@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-password">Password</Label>
              <Input
                id="new-user-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters. User can change it after first login.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Assign Role</Label>
              <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-600" />
                      Administrator
                    </div>
                  </SelectItem>
                  <SelectItem value="receptionist">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      Receptionist
                    </div>
                  </SelectItem>
                  <SelectItem value="lab_tech">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-600" />
                      Lab Technician
                    </div>
                  </SelectItem>
                  <SelectItem value="doctor">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      Doctor
                    </div>
                  </SelectItem>
                  <SelectItem value="specialist">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      Specialist
                    </div>
                  </SelectItem>
                  <SelectItem value="nurse">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-pink-500" />
                      Nurse
                    </div>
                  </SelectItem>
                  <SelectItem value="pharmacist">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-600" />
                      Pharmacist
                    </div>
                  </SelectItem>
                  <SelectItem value="inventory_manager">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-600" />
                      Inventory Manager
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Note:</p>
              <p className="text-xs text-muted-foreground">
                The user will receive an email confirmation and can log in immediately with the provided credentials.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={isCreating}
            >
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <UserPlus className="w-4 h-4 mr-2" />
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
