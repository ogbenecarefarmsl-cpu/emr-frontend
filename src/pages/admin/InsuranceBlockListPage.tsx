import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { insuranceBlocksAPI, insuranceAPI, patientsAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  ShieldOff, Loader2, Plus, Search, Filter, Ban, CheckCircle, Trash2, Eye,
  AlertTriangle, UserCheck, X
} from 'lucide-react';

const REASON_OPTIONS = [
  { value: 'quota_exhausted', label: 'Quota Exhausted' },
  { value: 'no_longer_covered', label: 'No Longer Covered' },
  { value: 'policy_cancelled', label: 'Policy Cancelled' },
  { value: 'deleted_from_system', label: 'Deleted from Insurance System' },
  { value: 'other', label: 'Other' },
];

const REASON_COLORS: Record<string, string> = {
  quota_exhausted: 'bg-orange-100 text-orange-700',
  no_longer_covered: 'bg-red-100 text-red-700',
  policy_cancelled: 'bg-red-100 text-red-700',
  deleted_from_system: 'bg-gray-100 text-gray-700',
  other: 'bg-yellow-100 text-yellow-700',
};

export default function InsuranceBlockListPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showInactive, setShowInactive] = useState(false);
  const queryClient = useQueryClient();
  const { profile, hasRole } = useAuth();

  // Form state
  const [formPatientId, setFormPatientId] = useState('');
  const [formPatientName, setFormPatientName] = useState('');
  const [formMemberNumber, setFormMemberNumber] = useState('');
  const [formProgramCode, setFormProgramCode] = useState('');
  const [formSubEntityCode, setFormSubEntityCode] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formReasonDetail, setFormReasonDetail] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const { data: programs = [] } = useQuery({
    queryKey: ['insurance-programs'],
    queryFn: () => insuranceAPI.getPrograms(),
  });

  const { data: stats } = useQuery({
    queryKey: ['insurance-blocks-stats'],
    queryFn: () => insuranceBlocksAPI.getStats(),
    enabled: hasRole('admin'),
  });

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['insurance-blocks', programFilter, statusFilter, searchQuery],
    queryFn: () => insuranceBlocksAPI.list({
      programCode: programFilter !== 'all' ? programFilter : undefined,
      isActive: statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : undefined,
      search: searchQuery || undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => insuranceBlocksAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks-stats'] });
      toast.success('Patient blocked from insurance billing');
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create block');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => insuranceBlocksAPI.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks-stats'] });
      toast.success('Block removed — patient can use insurance again');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => insuranceBlocksAPI.reactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks-stats'] });
      toast.success('Block reactivated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceBlocksAPI.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-blocks-stats'] });
      toast.success('Block permanently deleted');
      setShowDetailDialog(false);
    },
  });

  const resetForm = () => {
    setFormPatientId('');
    setFormPatientName('');
    setFormMemberNumber('');
    setFormProgramCode('');
    setFormSubEntityCode('');
    setFormReason('');
    setFormReasonDetail('');
    setFormNotes('');
  };

  const handleSubmit = () => {
    if (!formProgramCode || !formReason) {
      toast.error('Insurance program and reason are required');
      return;
    }
    if (!formPatientId && !formPatientName && !formMemberNumber) {
      toast.error('Enter patient ID, name, or member number');
      return;
    }

    createMutation.mutate({
      patientId: formPatientId || undefined,
      patientName: formPatientName || undefined,
      memberNumber: formMemberNumber || undefined,
      programCode: formProgramCode,
      subEntityCode: formSubEntityCode || undefined,
      reason: formReason,
      reasonDetail: formReasonDetail || undefined,
      notes: formNotes || undefined,
    });
  };

  const getReasonLabel = (reason: string) => REASON_OPTIONS.find(r => r.value === reason)?.label || reason;

  const lookupPatient = async (patientId: string) => {
    if (!patientId || patientId.length < 10) return;
    try {
      const patient = await patientsAPI.getById(patientId);
      if (patient) {
        setFormPatientName(`${patient.firstName || ''} ${patient.lastName || ''}`.trim());
        if (patient.insurance?.memberNumber) {
          setFormMemberNumber(patient.insurance.memberNumber);
        }
        if (patient.insurance?.programCode) {
          setFormProgramCode(patient.insurance.programCode);
        }
        toast.success(`Patient found: ${patient.firstName} ${patient.lastName}`);
      }
    } catch {
      // Patient not found — leave fields manual
    }
  };

  return (
    <RoleLayout title="Insurance Block List" subtitle="Manage patients blocked from insurance billing" role={profile?.role || 'admin'} userName={profile?.fullName || profile?.email}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldOff className="h-6 w-6 text-red-600" />
            Insurance Block List
          </h1>
          <p className="text-muted-foreground">Manage patients blocked from insurance billing</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Block
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.activeCount || 0}</p>
                <p className="text-xs text-muted-foreground">Active Blocks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCount || 0}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ShieldOff className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats?.byProgram?.reduce((sum: number, p: any) => sum + p.count, 0) || 0}
                </p>
                <p className="text-xs text-muted-foreground">By Program</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Blocks</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map((p: any) => (
                  <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or member #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-52"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blocks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Blocked Patients ({blocks.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : blocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No blocked patients</p>
              <p className="text-sm">When you receive an insurance letter, add the patient here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Member #</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((block: any) => (
                    <TableRow key={block._id}>
                      <TableCell className="font-medium">
                        {block.patientId ? (
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-4 w-4 text-green-600" />
                            {block.patientId.firstName} {block.patientId.lastName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">{block.patientName || 'Not in system'}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{block.memberNumber || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{block.programCode}</Badge></TableCell>
                      <TableCell>
                        <Badge className={REASON_COLORS[block.reason] || ''}>
                          {getReasonLabel(block.reason)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {block.effectiveDate ? new Date(block.effectiveDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        {block.isActive ? (
                          <Badge className="bg-red-100 text-red-700"><Ban className="h-3 w-3 mr-1" /> Blocked</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Removed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBlock(block);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {block.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => deactivateMutation.mutate(block._id)}
                              title="Remove block (patient reinstated)"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700"
                              onClick={() => reactivateMutation.mutate(block._id)}
                              title="Re-block patient"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Block Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldOff className="h-5 w-5" />
              Block Insurance Billing
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the patient details from the insurance letter. If the patient exists in our system, their insurance will be immediately blocked.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Patient ID (our system)</label>
                <Input
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  onBlur={(e) => lookupPatient(e.target.value)}
                  placeholder="Enter ID to auto-fill..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Patient Name</label>
                <Input
                  value={formPatientName}
                  onChange={(e) => setFormPatientName(e.target.value)}
                  placeholder="Full name from letter"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Member Number</label>
                <Input
                  value={formMemberNumber}
                  onChange={(e) => setFormMemberNumber(e.target.value)}
                  placeholder="Insurance member #"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Insurance Program *</label>
                <Select value={formProgramCode} onValueChange={setFormProgramCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p: any) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Sub-Entity</label>
                <Input
                  value={formSubEntityCode}
                  onChange={(e) => setFormSubEntityCode(e.target.value)}
                  placeholder="Employer/department"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reason *</label>
                <Select value={formReason} onValueChange={setFormReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Reason Detail</label>
              <Textarea
                value={formReasonDetail}
                onChange={(e) => setFormReasonDetail(e.target.value)}
                placeholder="Additional details from the letter..."
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Internal notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowAddDialog(false); }}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              Block Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-red-600" />
              Block Details
            </DialogTitle>
          </DialogHeader>
          {selectedBlock && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Patient:</span>
                  <p className="font-medium">
                    {selectedBlock.patientId
                      ? `${selectedBlock.patientId.firstName} ${selectedBlock.patientId.lastName}`
                      : selectedBlock.patientName || 'Not in system'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Member #:</span>
                  <p className="font-mono">{selectedBlock.memberNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Program:</span>
                  <Badge variant="outline">{selectedBlock.programCode}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Sub-Entity:</span>
                  <p>{selectedBlock.subEntityCode || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reason:</span>
                  <Badge className={REASON_COLORS[selectedBlock.reason]}>
                    {getReasonLabel(selectedBlock.reason)}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  {selectedBlock.isActive ? (
                    <Badge className="bg-red-100 text-red-700">Blocked</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">Removed</Badge>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Effective Date:</span>
                  <p>{selectedBlock.effectiveDate ? new Date(selectedBlock.effectiveDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Added:</span>
                  <p>{new Date(selectedBlock.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {selectedBlock.reasonDetail && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                  <span className="font-medium">Detail:</span> {selectedBlock.reasonDetail}
                </div>
              )}
              {selectedBlock.notes && (
                <div className="bg-gray-50 border rounded p-3 text-sm">
                  <span className="font-medium">Notes:</span> {selectedBlock.notes}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedBlock?.isActive && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Permanently delete this block record?')) {
                    deleteMutation.mutate(selectedBlock._id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RoleLayout>
  );
}
