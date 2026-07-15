import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { useAllBranches, useUpdateBranch, useAssignUserBranch, useTestBranchCaf, useTestBranchLis, useProvisionBranchCaf } from '@/hooks/useBranch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Building2, MapPin, Phone, Mail, Globe, Clock, Tag, FileText,
  Plus, Pencil, Loader2, Store, Users, FlaskConical, Pill, KeyRound, Link2, PlugZap, Info,
} from 'lucide-react';
import BranchSetupWizard from './BranchSetupWizard';
import { LIS_LOGO_ALT, LIS_LOGO_URL } from '@/lib/branding';

export default function BranchManagementPage() {
  const { profile } = useAuth();
  const { data: branches = [], isLoading: branchesLoading } = useAllBranches();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const updateBranch = useUpdateBranch();
  const assignUserBranch = useAssignUserBranch();
  const testCaf = useTestBranchCaf();
  const testLis = useTestBranchLis();
  const provisionCaf = useProvisionBranchCaf();

  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showWizard, setShowWizard] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
          cafEnabled: !!editForm.cafEnabled,
          cafBaseUrl: editForm.cafBaseUrl,
          cafUsername: editForm.cafUsername,
          cafPassword: editForm.cafPassword,
          cafBranchId: editForm.cafBranchId,
          cafTerminalId: editForm.cafTerminalId,
          lisEnabled: !!editForm.lisEnabled,
          lisBaseUrl: editForm.lisBaseUrl,
          labApiKey: editForm.labApiKey,
          labFacilityId: editForm.labFacilityId,
        },
      });
      toast.success('Branch updated');
      setEditingBranch(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to update branch');
    }
  };

  const runTest = async (kind: 'caf' | 'lis') => {
    if (!editingBranch) return;
    try {
      const result = kind === 'caf'
        ? await testCaf.mutateAsync(editingBranch._id)
        : await testLis.mutateAsync(editingBranch._id);
      if (result?.ok) toast.success(result.message || `${kind.toUpperCase()} connection ok`);
      else toast.error(result?.message || `${kind.toUpperCase()} connection failed`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || `${kind.toUpperCase()} connection failed`);
    }
  };

  const runCafProvision = async () => {
    if (!editingBranch) return;
    try {
      const result = await provisionCaf.mutateAsync({ branchId: editingBranch._id });
      setEditForm({ ...editForm, ...(result?.branch || {}) });
      const passwordNote = result?.generatedPassword ? ` Password: ${result.generatedPassword}` : '';
      toast.success(`CAF provisioned. Username: ${result?.cafUsername || 'saved'}.${passwordNote}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'CAF provisioning failed');
    }
  };

  const cafReady = !!(editForm.cafEnabled && editForm.cafBaseUrl && editForm.cafUsername && (editForm.hasCafPassword || editForm.cafPassword) && editForm.cafBranchId);
  const lisReady = !!(editForm.lisEnabled && editForm.lisBaseUrl && (editForm.hasLabApiKey || editForm.labApiKey));

  const handleAssignUser = async (userId: string, branchId: string | null) => {
    try {
      await assignUserBranch.mutateAsync({ userId, branchId });
      toast.success(branchId ? 'User assigned to branch' : 'User unassigned from branch');
      setSelectedUserId(null);
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
            <Button size="sm" onClick={() => setShowWizard(true)}>
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
                        <img src={LIS_LOGO_URL} alt={LIS_LOGO_ALT} className="w-10 h-10 object-contain" />
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Branch: {editingBranch?.name}</DialogTitle>
            <DialogDescription>
              These fields appear on every receipt printed at this outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 border-b pb-2">
              <p className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Branch Identity</p>
            </div>
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
              <Label>Outlet Logo</Label>
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                <img src={LIS_LOGO_URL} alt={LIS_LOGO_ALT} className="h-10 w-auto object-contain" />
                <span className="text-xs text-muted-foreground">Fixed to the LIS brand mark</span>
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <Label><FileText className="w-3 h-3 inline" /> Custom Footer Text</Label>
              <Input
                placeholder="Thank you for choosing us! | Open 24/7"
                value={editForm.footerText || ''}
                onChange={(e) => setEditForm({ ...editForm, footerText: e.target.value })}
              />
            </div>

            <div className="col-span-2 border-b pb-2 pt-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold flex items-center gap-2"><Pill className="w-4 h-4" /> CAF Pharmacy API</p>
                <Badge variant={cafReady ? 'default' : 'outline'}>{cafReady ? 'CAF Ready' : 'CAF Needs Setup'}</Badge>
              </div>
            </div>
            <Alert className="col-span-2 border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-700" />
              <AlertTitle>CAF setup guide</AlertTitle>
              <AlertDescription className="text-amber-800">
                Use <strong>Provision CAF</strong> when the EMR backend has a CAF admin credential that can create branches. Use the fields below when the CAF branch already exists and you only need to paste its branch manager credentials.
              </AlertDescription>
            </Alert>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enable CAF for this branch</p>
                <p className="text-xs text-muted-foreground">Medication search, stock, shift and dispensing use this branch's CAF config.</p>
              </div>
              <Switch checked={!!editForm.cafEnabled} onCheckedChange={(v) => setEditForm({ ...editForm, cafEnabled: v })} />
            </div>
            <div className="space-y-1">
              <Label><Link2 className="w-3 h-3 inline" /> CAF Base URL</Label>
              <Input value={editForm.cafBaseUrl || ''} onChange={(e) => setEditForm({ ...editForm, cafBaseUrl: e.target.value })} placeholder="https://caf.example.com" />
            </div>
            <div className="space-y-1">
              <Label>CAF Username</Label>
              <Input value={editForm.cafUsername || ''} onChange={(e) => setEditForm({ ...editForm, cafUsername: e.target.value })} placeholder="branch manager username" />
            </div>
            <div className="space-y-1">
              <Label><KeyRound className="w-3 h-3 inline" /> CAF Password</Label>
              <Input type="password" value={editForm.cafPassword || ''} onChange={(e) => setEditForm({ ...editForm, cafPassword: e.target.value })} placeholder={editForm.hasCafPassword ? 'Saved - type to replace' : 'CAF password'} />
            </div>
            <div className="space-y-1">
              <Label>CAF Branch ID</Label>
              <Input value={editForm.cafBranchId || ''} onChange={(e) => setEditForm({ ...editForm, cafBranchId: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>CAF Terminal ID</Label>
              <Input value={editForm.cafTerminalId || ''} onChange={(e) => setEditForm({ ...editForm, cafTerminalId: e.target.value })} />
            </div>
            <div className="flex items-end">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={runCafProvision} disabled={provisionCaf.isPending}>
                  {provisionCaf.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pill className="w-4 h-4 mr-2" />}
                  Provision CAF
                </Button>
                <Button type="button" variant="outline" onClick={() => runTest('caf')} disabled={testCaf.isPending}>
                  {testCaf.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
                  Test CAF
                </Button>
              </div>
            </div>

            <div className="col-span-2 border-b pb-2 pt-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" /> LIS Lab API</p>
                <Badge variant={lisReady ? 'default' : 'outline'}>{lisReady ? 'LIS Ready' : 'LIS Needs Setup'}</Badge>
              </div>
            </div>
            <Alert className="col-span-2 border-cyan-200 bg-cyan-50">
              <Info className="h-4 w-4 text-cyan-700" />
              <AlertTitle>LIS setup guide</AlertTitle>
              <AlertDescription className="text-cyan-800">
                The current LIS external API supports catalog/order/result sync, but does not expose facility or API-key provisioning. Create the facility/API key in LIS, paste it here, then use <strong>Test LIS</strong>.
              </AlertDescription>
            </Alert>
            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enable LIS for this branch</p>
                <p className="text-xs text-muted-foreground">Lab catalog, orders, payment sync and result import use this branch's LIS config.</p>
              </div>
              <Switch checked={!!editForm.lisEnabled} onCheckedChange={(v) => setEditForm({ ...editForm, lisEnabled: v })} />
            </div>
            <div className="space-y-1">
              <Label><Link2 className="w-3 h-3 inline" /> LIS Base URL</Label>
              <Input value={editForm.lisBaseUrl || ''} onChange={(e) => setEditForm({ ...editForm, lisBaseUrl: e.target.value })} placeholder="https://lis.example.com" />
            </div>
            <div className="space-y-1">
              <Label><KeyRound className="w-3 h-3 inline" /> LIS API Key</Label>
              <Input type="password" value={editForm.labApiKey || ''} onChange={(e) => setEditForm({ ...editForm, labApiKey: e.target.value })} placeholder={editForm.hasLabApiKey ? 'Saved - type to replace' : 'LIS API key'} />
            </div>
            <div className="space-y-1">
              <Label>LIS Facility / Branch Code</Label>
              <Input value={editForm.labFacilityId || ''} onChange={(e) => setEditForm({ ...editForm, labFacilityId: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={() => runTest('lis')} disabled={testLis.isPending}>
                {testLis.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
                Test LIS
              </Button>
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

      {/* Branch setup wizard */}
      <BranchSetupWizard open={showWizard} onOpenChange={setShowWizard} />

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

function UserRow({ user, onAssign }: { user: any; onAssign: () => void; branches?: any[] }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium">{user.full_name || user.fullName || user.email}</p>
        <p className="text-xs text-muted-foreground">
          {user.email} · {(user.user_roles || []).map((roleItem: any) => roleItem.role).join(', ') || 'no role'}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onAssign}>
        Reassign
      </Button>
    </div>
  );
}
