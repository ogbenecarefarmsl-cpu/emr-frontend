import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useUsers, useUpdateUser } from '@/hooks/useUsers';
import { useAllBranches, useUpdateBranch, useAssignUserBranch, useCreateBranch } from '@/hooks/useBranch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Building2, MapPin, Phone, Mail, Globe, Clock, Tag, FileText,
  Plus, Pencil, Loader2, Store, Users,
} from 'lucide-react';

export default function BranchManagementPage() {
  const { profile } = useAuth();
  const { data: branches = [], isLoading: branchesLoading } = useAllBranches();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const updateBranch = useUpdateBranch();
  const createBranch = useCreateBranch();
  const assignUserBranch = useAssignUserBranch();
  const updateUser = useUpdateUser();

  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<any>({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: '',
    tagline: '',
    website: '',
    footerText: '',
    operatingHours: '',
  });
  const [showUserBranchDialog, setShowUserBranchDialog] = useState<any | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const openEdit = (branch: any) => {
    setEditingBranch(branch);
    setEditForm({ ...branch });
  };

  const saveEdit = async () => {
    if (!editingBranch) return;
    try {
      await updateBranch.mutateAsync({
        id: editingBranch._id,
        data: {
          name: editForm.name,
          address: editForm.address,
          phone: editForm.phone,
          email: editForm.email,
          logoUrl: editForm.logoUrl,
          tagline: editForm.tagline,
          website: editForm.website,
          footerText: editForm.footerText,
          operatingHours: editForm.operatingHours,
        },
      });
      toast.success('Branch updated');
      setEditingBranch(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to update branch');
    }
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.code) {
      toast.error('Name and Code are required');
      return;
    }
    try {
      await createBranch.mutateAsync(createForm);
      toast.success('Branch created');
      setShowCreate(false);
      setCreateForm({
        name: '', code: '', address: '', phone: '', email: '', logoUrl: '',
        tagline: '', website: '', footerText: '', operatingHours: '',
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to create branch');
    }
  };

  const handleAssignUser = async (userId: string, branchId: string | null) => {
    try {
      await assignUserBranch.mutateAsync({ userId, branchId });
      toast.success(branchId ? 'User assigned to branch' : 'User unassigned from branch');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to assign user');
    }
  };

  // Group users by their branch
  const usersByBranch: Record<string, any[]> = { unassigned: [] };
  for (const b of branches) usersByBranch[b._id] = [];
  for (const u of users) {
    const bid = u.branchId || 'unassigned';
    if (!usersByBranch[bid]) usersByBranch[bid] = [];
    usersByBranch[bid].push(u);
  }

  const filteredUsers = userSearch
    ? users.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email?.toLowerCase().includes(userSearch.toLowerCase()),
      )
    : [];

  return (
    <RoleLayout
      title="Branch Management"
      subtitle="Configure outlet letterhead and assign users to branches"
      role="admin"
      userName={profile?.fullName}
    >
      <div className="max-w-6xl space-y-4">
        {/* Branches list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Outlets ({branches.length})
            </CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Branch
            </Button>
          </CardHeader>
          <CardContent>
            {branchesLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 mx-auto animate-spin" />
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No branches yet. Click "New Branch" to add one.
              </div>
            ) : (
              <div className="space-y-2">
                {branches.map((branch: any) => (
                  <div
                    key={branch._id}
                    className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-lg">
                        {branch.logoUrl ? (
                          <img src={branch.logoUrl} alt="" className="w-10 h-10 object-contain" />
                        ) : (
                          <Store className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{branch.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {branch.code} · {branch.address || 'No address set'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {branch.tagline || 'No tagline'} · {usersByBranch[branch._id]?.length || 0} user(s)
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEdit(branch)}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users per branch */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Users per Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="text-center py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 mx-auto animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Unassigned */}
                {usersByBranch.unassigned.length > 0 && (
                  <div className="border rounded-lg p-3 bg-amber-50">
                    <p className="font-semibold text-amber-900 mb-2">⚠ Unassigned ({usersByBranch.unassigned.length})</p>
                    <div className="space-y-1">
                      {usersByBranch.unassigned.map((u: any) => (
                        <UserRow key={u.id} user={u} onAssign={() => setSelectedUserId(u.id)} branches={branches} />
                      ))}
                    </div>
                  </div>
                )}
                {branches.map((branch: any) => (
                  <div key={branch._id} className="border rounded-lg p-3">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <Store className="w-4 h-4 text-primary" />
                      {branch.name}
                      <Badge variant="outline" className="text-[10px]">
                        {usersByBranch[branch._id]?.length || 0} user(s)
                      </Badge>
                    </p>
                    {(usersByBranch[branch._id] || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No users assigned to this branch.</p>
                    ) : (
                      <div className="space-y-1">
                        {(usersByBranch[branch._id] || []).map((u: any) => (
                          <UserRow
                            key={u.id}
                            user={u}
                            onAssign={() => setSelectedUserId(u.id)}
                            branches={branches}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit branch dialog */}
      <Dialog open={!!editingBranch} onOpenChange={(o) => !o && setEditingBranch(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Branch: {editingBranch?.name}</DialogTitle>
            <DialogDescription>
              These fields appear on every receipt printed at this outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Branch Name *</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input value={editForm.code || ''} disabled />
            </div>
            <div className="space-y-1">
              <Label><Tag className="w-3 h-3 inline" /> Tagline / Motto</Label>
              <Input
                placeholder="e.g. Trusted by clinics & hospitals"
                value={editForm.tagline || ''}
                onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label><MapPin className="w-3 h-3 inline" /> Address</Label>
              <Input
                placeholder="Street, City, Country"
                value={editForm.address || ''}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label><Phone className="w-3 h-3 inline" /> Phone</Label>
              <Input
                placeholder="+232..."
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label><Mail className="w-3 h-3 inline" /> Email</Label>
              <Input
                placeholder="reception@..."
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label><Globe className="w-3 h-3 inline" /> Website</Label>
              <Input
                placeholder="https://..."
                value={editForm.website || ''}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label><Clock className="w-3 h-3 inline" /> Operating Hours</Label>
              <Input
                placeholder="e.g. Mon-Sat 8am-8pm"
                value={editForm.operatingHours || ''}
                onChange={(e) => setEditForm({ ...editForm, operatingHours: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Logo URL</Label>
              <Input
                placeholder="https://...logo.png"
                value={editForm.logoUrl || ''}
                onChange={(e) => setEditForm({ ...editForm, logoUrl: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label><FileText className="w-3 h-3 inline" /> Custom Footer Text</Label>
              <Input
                placeholder="Thank you for choosing us! | Open 24/7"
                value={editForm.footerText || ''}
                onChange={(e) => setEditForm({ ...editForm, footerText: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBranch(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateBranch.isPending}>
              {updateBranch.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create branch dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Branch</DialogTitle>
            <DialogDescription>Add a new outlet. Code must be unique.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Name *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Harbour Medical — Congo Cross"
              />
            </div>
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. HMC-CC"
              />
            </div>
            <div className="space-y-1">
              <Label>Tagline</Label>
              <Input
                value={createForm.tagline}
                onChange={(e) => setCreateForm({ ...createForm, tagline: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address</Label>
              <Input
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Website</Label>
              <Input
                value={createForm.website}
                onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Operating Hours</Label>
              <Input
                value={createForm.operatingHours}
                onChange={(e) => setCreateForm({ ...createForm, operatingHours: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Logo URL</Label>
              <Input
                value={createForm.logoUrl}
                onChange={(e) => setCreateForm({ ...createForm, logoUrl: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Footer Text</Label>
              <Input
                value={createForm.footerText}
                onChange={(e) => setCreateForm({ ...createForm, footerText: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBranch.isPending}>
              {createBranch.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign user to branch dialog */}
      <Dialog open={!!selectedUserId} onOpenChange={(o) => !o && setSelectedUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign user to branch</DialogTitle>
            <DialogDescription>
              The user will be assigned to the selected branch on next login.
              All receipts they print will carry that branch's letterhead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Select onValueChange={(v) => handleAssignUser(selectedUserId!, v === 'unassign' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a branch..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassign">— Unassign —</SelectItem>
                {branches.map((b: any) => (
                  <SelectItem key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUserId(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}

function UserRow({ user, onAssign, branches }: { user: any; onAssign: () => void; branches: any[] }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium">{user.fullName}</p>
        <p className="text-xs text-muted-foreground">
          {user.email} · {user.roles?.join(', ') || 'no role'}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onAssign}>
        Reassign
      </Button>
    </div>
  );
}
