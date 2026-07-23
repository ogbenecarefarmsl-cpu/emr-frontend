import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { insuranceClaimsAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  Shield, Loader2, DollarSign, FileText, CheckCircle, XCircle,
  Clock, Filter, Search, Eye
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  partially_approved: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  partially_approved: 'Partially Approved',
  paid: 'Paid',
  rejected: 'Rejected',
};

export default function AdminInsuranceClaimsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approveAmount, setApproveAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [verificationReference, setVerificationReference] = useState('');
  const queryClient = useQueryClient();

  const { profile } = useAuth();
  const branchId = profile?.branchId;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['insurance-claims-stats', branchId],
    queryFn: () => insuranceClaimsAPI.getStats(branchId),
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ['insurance-claims', statusFilter, programFilter, branchId],
    queryFn: () => insuranceClaimsAPI.list({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      programCode: programFilter !== 'all' ? programFilter : undefined,
      branchId: branchId || undefined,
    }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ claimId, ...data }: any) => insuranceClaimsAPI.updateStatus(claimId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-claims-stats'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['patient-outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-balances'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['daily-income'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
      toast.success('Claim updated');
      setShowDetailDialog(false);
      setShowApproveDialog(false);
      setShowRejectDialog(false);
      setApproveAmount('');
      setRejectionReason('');
      setActionNotes('');
      setVerificationReference('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update claim');
    },
  });

  const filteredClaims = claims.filter((claim: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      claim.memberNumber?.toLowerCase().includes(q) ||
      claim.memberName?.toLowerCase().includes(q) ||
      claim.programCode?.toLowerCase().includes(q)
    );
  });

  const handleApprove = () => {
    if (!selectedClaim) return;
    updateStatusMutation.mutate({
      claimId: selectedClaim._id,
      status: 'approved',
      approvedAmount: approveAmount ? Number(approveAmount) : selectedClaim.claimedAmount,
      notes: actionNotes || undefined,
      verificationReference: verificationReference || undefined,
    });
  };

  const handleSubmitClaim = (claim: any) => {
    updateStatusMutation.mutate({
      claimId: claim._id,
      status: 'submitted',
      notes: 'Submitted for approval',
    });
  };

  const handleReject = () => {
    if (!selectedClaim) return;
    updateStatusMutation.mutate({
      claimId: selectedClaim._id,
      status: 'rejected',
      rejectionReason: rejectionReason || 'Not approved',
      notes: actionNotes || undefined,
    });
  };

  const handleMarkPaid = (claim: any) => {
    updateStatusMutation.mutate({
      claimId: claim._id,
      status: 'paid',
      paidAmount: claim.approvedAmount || claim.claimedAmount,
      notes: 'Payment confirmed',
    });
  };

  if (statsLoading || claimsLoading) {
    return (
      <RoleLayout title="Insurance Claims" subtitle="Manage and process insurance claims" role={profile?.role || 'admin'} userName={profile?.fullName || profile?.email}>
        <div className="space-y-6" aria-busy="true" aria-label="Loading insurance claims">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout title="Insurance Claims" subtitle="Manage and process insurance claims" role={profile?.role || 'admin'} userName={profile?.fullName || profile?.email}>
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totals?.totalClaims || 0}</p>
                <p className="text-xs text-muted-foreground">Total Claims</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Le {(stats?.totals?.totalClaimed || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Claimed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Le {(stats?.totals?.totalPaid || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Le {(stats?.totals?.totalPatient || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Patient Portion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      {stats?.byStatus?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Claims by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.byStatus.map((s: any) => (
                <Badge key={s._id} className={STATUS_COLORS[s._id] || ''}>
                  {STATUS_LABELS[s._id] || s._id}: {s.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="partially_approved">Partially Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectItem value="AIC">AIC - Aureol Insurance</SelectItem>
                <SelectItem value="RHIP">RHIP</SelectItem>
                <SelectItem value="ACTIVA">ACTIVA</SelectItem>
                <SelectItem value="STACO">STACO</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Claims ({filteredClaims.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No insurance claims found</p>
              <p className="text-sm">Claims are created when orders are marked as insurance-covered</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Member #</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Claimed</TableHead>
                    <TableHead className="text-right">Patient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClaims.map((claim: any) => (
                    <TableRow key={claim._id}>
                      <TableCell>
                        <Badge variant="outline">{claim.programCode}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{claim.memberName || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{claim.memberNumber || '-'}</TableCell>
                      <TableCell>{claim.items?.length || 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        Le {(claim.claimedAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        Le {(claim.patientAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[claim.status] || ''}>
                          {STATUS_LABELS[claim.status] || claim.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClaim(claim);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {claim.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={() => handleSubmitClaim(claim)}
                              disabled={updateStatusMutation.isPending}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                          {claim.status === 'submitted' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => {
                                  setSelectedClaim(claim);
                                  setApproveAmount(String(claim.claimedAmount || 0));
                                  setShowApproveDialog(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  setSelectedClaim(claim);
                                  setRejectionReason('');
                                  setShowRejectDialog(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {(claim.status === 'approved' || claim.status === 'partially_approved') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700"
                              onClick={() => handleMarkPaid(claim)}
                              disabled={updateStatusMutation.isPending}
                              title="Mark claim paid by insurer"
                            >
                              <DollarSign className="h-4 w-4" />
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

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Claim Details
            </DialogTitle>
            <DialogDescription>View claim details and line items.</DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Program:</span>
                  <p className="font-medium">{selectedClaim.programCode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sub-Entity:</span>
                  <p className="font-medium">{selectedClaim.subEntityCode || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Member Number:</span>
                  <p className="font-mono">{selectedClaim.memberNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Member Name:</span>
                  <p className="font-medium">{selectedClaim.memberName || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={STATUS_COLORS[selectedClaim.status]}>{STATUS_LABELS[selectedClaim.status]}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p>{new Date(selectedClaim.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Claim Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Covered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedClaim.items?.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{item.itemType}</TableCell>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell className="text-right text-sm">Le {item.totalAmount?.toLocaleString()}</TableCell>
                        <TableCell>
                          {item.coveredByInsurance ? (
                            <Badge className="bg-green-100 text-green-700">Yes</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-700">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <p className="font-bold">Le {(selectedClaim.totalAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Claimed:</span>
                  <p className="font-bold text-blue-600">Le {(selectedClaim.claimedAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Patient Portion:</span>
                  <p className="font-bold text-amber-600">Le {(selectedClaim.patientAmount || 0).toLocaleString()}</p>
                </div>
              </div>

              {selectedClaim.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                  <span className="font-medium text-red-700">Rejection Reason:</span>{' '}
                  <span className="text-red-600">{selectedClaim.rejectionReason}</span>
                </div>
              )}

              {selectedClaim.notes && (
                <div className="bg-gray-50 border rounded p-3 text-sm">
                  <span className="font-medium">Notes:</span> {selectedClaim.notes}
                </div>
              )}
              {selectedClaim.verificationReference ? (
                <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <span className="font-medium">Verified by Reception/Admin:</span>{' '}
                  {selectedClaim.verificationReference}
                  {selectedClaim.verifiedAt ? ` · ${new Date(selectedClaim.verifiedAt).toLocaleString()}` : ''}
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Approve Claim
            </DialogTitle>
            <DialogDescription>Approve this insurance claim for payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Approved Amount (Le)</label>
              <Input
                type="number"
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
                placeholder="Enter approved amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Claimed: Le {selectedClaim?.claimedAmount?.toLocaleString()}
              </p>
              {Number(approveAmount || 0) < Number(selectedClaim?.claimedAmount || 0) ? (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  The difference becomes a patient balance and will reappear in Accounts Receivable.
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium">Verification reference (optional)</label>
              <Input
                value={verificationReference}
                onChange={(e) => setVerificationReference(e.target.value)}
                placeholder="Phone approval, card check, letter or reference"
              />
              <p className="mt-1 text-xs text-muted-foreground">Reception can record reasonable due diligence without waiting for Admin.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              Reject Claim
            </DialogTitle>
            <DialogDescription>Reject this insurance claim.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rejection Reason *</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleReject}
              disabled={!rejectionReason || updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RoleLayout>
  );
}
