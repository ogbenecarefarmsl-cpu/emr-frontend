import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useInsurancePrograms, useInsuranceLookup,
  useCreateInsuranceProgram, useUpdateInsuranceProgram, useDeleteInsuranceProgram,
  useCreateSubEntity, useUpdateSubEntity, useDeleteSubEntity,
  InsuranceProgram, InsuranceSubEntity,
} from '@/hooks/useInsurance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Shield, Building2, Plus, Pencil, Loader2, Phone, Mail, MapPin,
  ChevronRight, ChevronDown, Trash2,
} from 'lucide-react';

export default function InsuranceManagementPage() {
  const { profile } = useAuth();
  const { data: programs = [], isLoading } = useInsurancePrograms();
  const { data: lookup = [] } = useInsuranceLookup();
  const createProgram = useCreateInsuranceProgram();
  const updateProgram = useUpdateInsuranceProgram();
  const deleteProgram = useDeleteInsuranceProgram();
  const createSub = useCreateSubEntity();
  const updateSub = useUpdateSubEntity();
  const deleteSub = useDeleteSubEntity();

  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [editingProgram, setEditingProgram] = useState<InsuranceProgram | null>(null);
  const [programForm, setProgramForm] = useState({ code: '', name: '', contactPerson: '', contactPhone: '', contactEmail: '', address: '', paymentTerms: '' });

  const [showSubDialog, setShowSubDialog] = useState(false);
  const [editingSub, setEditingSub] = useState<InsuranceSubEntity | null>(null);
  const [subForProgram, setSubForProgram] = useState<string>('');
  const [subForm, setSubForm] = useState({ code: '', name: '', contactPerson: '', contactPhone: '', address: '' });

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'program' | 'sub'; id: string; name: string } | null>(null);

  const openCreateProgram = () => {
    setEditingProgram(null);
    setProgramForm({ code: '', name: '', contactPerson: '', contactPhone: '', contactEmail: '', address: '', paymentTerms: '' });
    setShowProgramDialog(true);
  };

  const openEditProgram = (prog: InsuranceProgram) => {
    setEditingProgram(prog);
    setProgramForm({
      code: prog.code,
      name: prog.name,
      contactPerson: prog.contactPerson || '',
      contactPhone: prog.contactPhone || '',
      contactEmail: prog.contactEmail || '',
      address: prog.address || '',
      paymentTerms: prog.paymentTerms || prog.notes || '',
    });
    setShowProgramDialog(true);
  };

  const saveProgram = async () => {
    if (!programForm.code.trim() || !programForm.name.trim()) {
      toast.error('Code and Name are required');
      return;
    }
    const payload = {
      code: programForm.code.trim(),
      name: programForm.name.trim(),
      contactPerson: programForm.contactPerson || undefined,
      contactPhone: programForm.contactPhone || undefined,
      contactEmail: programForm.contactEmail || undefined,
      address: programForm.address || undefined,
      paymentTerms: programForm.paymentTerms || undefined,
    };
    try {
      if (editingProgram) {
        await updateProgram.mutateAsync({ id: editingProgram._id, data: payload });
        toast.success('Program updated');
      } else {
        await createProgram.mutateAsync(payload);
        toast.success('Program created');
      }
      setShowProgramDialog(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save program');
    }
  };

  const openCreateSub = (programId: string) => {
    setEditingSub(null);
    setSubForProgram(programId);
    setSubForm({ code: '', name: '', contactPerson: '', contactPhone: '', address: '' });
    setShowSubDialog(true);
  };

  const openEditSub = (sub: InsuranceSubEntity) => {
    setEditingSub(sub);
    setSubForProgram(sub.programId);
    setSubForm({
      code: sub.code,
      name: sub.name,
      contactPerson: sub.contactPerson || '',
      contactPhone: sub.contactPhone || '',
      address: sub.address || '',
    });
    setShowSubDialog(true);
  };

  const saveSubEntity = async () => {
    if (!subForm.code.trim() || !subForm.name.trim()) {
      toast.error('Code and Name are required');
      return;
    }
    const payload = {
      code: subForm.code.trim(),
      name: subForm.name.trim(),
      contactPerson: subForm.contactPerson || undefined,
      contactPhone: subForm.contactPhone || undefined,
      address: subForm.address || undefined,
    };
    try {
      if (editingSub) {
        await updateSub.mutateAsync({ id: editingSub._id, data: payload });
        toast.success('Sub-entity updated');
      } else {
        await createSub.mutateAsync({ programId: subForProgram, data: payload });
        toast.success('Sub-entity created');
      }
      setShowSubDialog(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save sub-entity');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'program') {
        await deleteProgram.mutateAsync(deleteConfirm.id);
        toast.success('Program deactivated');
      } else {
        await deleteSub.mutateAsync(deleteConfirm.id);
        toast.success('Sub-entity deactivated');
      }
      setDeleteConfirm(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <RoleLayout title="Insurance Management" subtitle="Manage insurance programs and their sub-entities" role="admin" userName={profile?.fullName || profile?.email || ''}>
      <div className="max-w-6xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Insurance Programs</h2>
            <Badge variant="outline" className="text-[10px]">{programs.length}</Badge>
          </div>
          <Button size="sm" onClick={openCreateProgram} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Program
          </Button>
        </div>

        {/* Program List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
            Loading programs...
          </div>
        ) : programs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No insurance programs configured yet.</p>
              <p className="text-sm mt-1">Click "New Program" to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {programs.map((prog) => {
              const isExpanded = expandedProgram === prog._id;
              const subCount = lookup.find(l => l._id === prog._id)?.subEntities?.length || 0;
              return (
                <Card key={prog._id}>
                  <CardContent className="p-0">
                    {/* Program Row */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedProgram(isExpanded ? null : prog._id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{prog.name}</span>
                            <Badge variant="outline" className="text-[10px]">{prog.code}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {subCount > 0 ? `${subCount} sub-entities` : 'No sub-entities'}
                            {prog.contactPerson && ` · Contact: ${prog.contactPerson}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openEditProgram(prog); }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {profile?.role === 'admin' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ type: 'program', id: prog._id, name: prog.name });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        ) : null}
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Sub-Entities (expanded) */}
                    {isExpanded && (
                      <div className="border-t px-3 pb-3">
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm font-medium text-muted-foreground">Sub-Entities</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => openCreateSub(prog._id)}
                          >
                            <Plus className="w-3 h-3" /> Add Sub-Entity
                          </Button>
                        </div>

                        {subCount === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">No sub-entities. Add one if this program has employer/organization subdivisions.</p>
                        ) : (
                          <div className="space-y-1">
                            {(lookup.find(l => l._id === prog._id)?.subEntities || []).map((sub) => (
                              <div key={sub._id} className="flex items-center justify-between border rounded p-2 hover:bg-muted/20">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm font-medium">{sub.name}</span>
                                  <Badge variant="outline" className="text-[10px]">{sub.code}</Badge>
                                  {sub.contactPerson && (
                                    <span className="text-xs text-muted-foreground">· {sub.contactPerson}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEditSub(sub)}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  {profile?.role === 'admin' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteConfirm({ type: 'sub', id: sub._id, name: sub.name })}
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Program Dialog */}
        <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProgram ? 'Edit Program' : 'New Insurance Program'}</DialogTitle>
              <DialogDescription>{editingProgram ? 'Update program details' : 'Add a new insurance program'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Code *</Label>
                  <Input
                    value={programForm.code}
                    onChange={(e) => setProgramForm({ ...programForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. AIC, RHIP, ACTIVA"
                    disabled={!!editingProgram}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    value={programForm.name}
                    onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                    placeholder="e.g. African Insurance Company"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input
                  value={programForm.contactPerson}
                  onChange={(e) => setProgramForm({ ...programForm, contactPerson: e.target.value })}
                  placeholder="Primary contact name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Contact Phone</Label>
                  <Input
                    value={programForm.contactPhone}
                    onChange={(e) => setProgramForm({ ...programForm, contactPhone: e.target.value })}
                    placeholder="+232..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Contact Email</Label>
                  <Input
                    value={programForm.contactEmail}
                    onChange={(e) => setProgramForm({ ...programForm, contactEmail: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input
                  value={programForm.address}
                  onChange={(e) => setProgramForm({ ...programForm, address: e.target.value })}
                  placeholder="Physical address"
                />
              </div>
              <div className="space-y-1">
                <Label>Payment terms</Label>
                <Input
                  value={programForm.paymentTerms}
                  onChange={(e) => setProgramForm({ ...programForm, paymentTerms: e.target.value })}
                  placeholder="e.g. Net 30, monthly batch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProgramDialog(false)}>Cancel</Button>
              <Button onClick={saveProgram} disabled={createProgram.isPending || updateProgram.isPending}>
                {(createProgram.isPending || updateProgram.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingProgram ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sub-Entity Dialog */}
        <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSub ? 'Edit Sub-Entity' : 'New Sub-Entity'}</DialogTitle>
              <DialogDescription>
                {editingSub ? 'Update sub-entity details' : 'Add an employer or organization subdivision'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Code *</Label>
                  <Input
                    value={subForm.code}
                    onChange={(e) => setSubForm({ ...subForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. NRA, Orange, GIZ"
                    disabled={!!editingSub}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    value={subForm.name}
                    onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                    placeholder="e.g. National Revenue Authority"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input
                  value={subForm.contactPerson}
                  onChange={(e) => setSubForm({ ...subForm, contactPerson: e.target.value })}
                  placeholder="Primary contact at this organization"
                />
              </div>
              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input
                  value={subForm.contactPhone}
                  onChange={(e) => setSubForm({ ...subForm, contactPhone: e.target.value })}
                  placeholder="+232..."
                />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input
                  value={subForm.address}
                  onChange={(e) => setSubForm({ ...subForm, address: e.target.value })}
                  placeholder="Organization address"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubDialog(false)}>Cancel</Button>
              <Button onClick={saveSubEntity} disabled={createSub.isPending || updateSub.isPending}>
                {(createSub.isPending || updateSub.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingSub ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Deactivate {deleteConfirm?.type === 'program' ? 'Program' : 'Sub-Entity'}</DialogTitle>
              <DialogDescription>
                This will deactivate "{deleteConfirm?.name}". It will no longer appear in dropdowns. Existing patient records are preserved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteProgram.isPending || deleteSub.isPending}>
                {(deleteProgram.isPending || deleteSub.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleLayout>
  );
}
