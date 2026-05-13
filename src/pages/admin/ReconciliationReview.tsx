import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import {
  useReconciliations,
  useReviewReconciliation,
} from '@/hooks/useReconciliation';
import { useExpenditures, useFlagExpenditure, useUnflagExpenditure } from '@/hooks/useExpenditures';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
  Calculator,
  Banknote,
  Smartphone,
  Receipt,
  Flag,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export default function ReconciliationReview() {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRec, setSelectedRec] = useState<any>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);

  // Expenditures for the selected reconciliation date
  const selectedDateStr = selectedRec ? new Date(selectedRec.reconciliationDate).toISOString().split('T')[0] : '';
  const startDate = selectedDateStr ? (() => { const d = new Date(selectedDateStr); d.setHours(0,0,0,0); return d.toISOString(); })() : '';
  const endDate = selectedDateStr ? (() => { const d = new Date(selectedDateStr); d.setHours(23,59,59,999); return d.toISOString(); })() : '';
  
  const { data: expenditures, isLoading: loadingExp } = useExpenditures(
    selectedRec ? { startDate, endDate } : undefined
  );
  
  const flagExpenditure = useFlagExpenditure();
  const unflagExpenditure = useUnflagExpenditure();
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');

  const { data: reconciliations, isLoading } = useReconciliations(statusFilter);
  const reviewReconciliation = useReviewReconciliation();

  const statusStyles = {
    pending: 'bg-status-warning/10 text-status-warning border-status-warning/20',
    approved: 'bg-status-normal/10 text-status-normal border-status-normal/20',
    rejected: 'bg-status-critical/10 text-status-critical border-status-critical/20',
  };

  const allRecs = reconciliations || [];
  const pendingCount = allRecs.filter((r: any) => r.status === 'pending').length;
  const approvedCount = allRecs.filter((r: any) => r.status === 'approved').length;
  const rejectedCount = allRecs.filter((r: any) => r.status === 'rejected').length;
  const totalExpected = allRecs.reduce((s: number, r: any) => s + (r.expectedTotal || 0), 0);
  const totalActual = allRecs.reduce((s: number, r: any) => s + (r.actualTotal || 0), 0);
  const totalVarianceSum = allRecs.reduce((s: number, r: any) => s + (r.totalVariance || 0), 0);
  const varianceCount = allRecs.filter((r: any) => Math.abs(r.totalVariance || 0) > 0.01).length;

  // Helper: check if the per-method breakdown sums match the reported totals
  const getCalcErrors = (rec: any): string[] => {
    const errors: string[] = [];
    const expBreakdown = (rec.expectedCash || 0) + (rec.expectedOrangeMoney || 0) + (rec.expectedAfrimoney || 0);
    const actBreakdown = (rec.actualCash || 0) + (rec.actualOrangeMoney || 0) + (rec.actualAfrimoney || 0);
    if (Math.abs(expBreakdown - (rec.expectedTotal || 0)) > 0.01) {
      errors.push(`Expected breakdown (Le ${expBreakdown.toLocaleString()}) ≠ Expected total (Le ${(rec.expectedTotal || 0).toLocaleString()})`);
    }
    if (Math.abs(actBreakdown - (rec.actualTotal || 0)) > 0.01) {
      errors.push(`Actual breakdown (Le ${actBreakdown.toLocaleString()}) ≠ Actual total (Le ${(rec.actualTotal || 0).toLocaleString()})`);
    }
    // Variance is stored as expected − actual: positive = shortage, negative = surplus
    const computedVariance = (rec.expectedTotal || 0) - (rec.actualTotal || 0);
    if (Math.abs(computedVariance - (rec.totalVariance || 0)) > 0.01) {
      errors.push(`Stored variance (Le ${(rec.totalVariance || 0).toLocaleString()}) ≠ Computed variance (Le ${computedVariance.toLocaleString()})`);
    }
    return errors;
  };
  const calcErrorCount = allRecs.filter((r: any) => getCalcErrors(r).length > 0).length;

  const handleReview = async () => {
    if (!selectedRec || !reviewAction) return;

    try {
      await reviewReconciliation.mutateAsync({
        id: selectedRec._id || selectedRec.id,
        approved: reviewAction === 'approve',
        notes: reviewNotes || undefined,
      });

      toast.success(
        `Reconciliation ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully`
      );
      setShowReviewDialog(false);
      setSelectedRec(null);
      setReviewNotes('');
      setReviewAction(null);
    } catch (error) {
      toast.error('Failed to review reconciliation');
    }
  };

  const openReviewDialog = (rec: any, action: 'approve' | 'reject') => {
    setSelectedRec(rec);
    setReviewAction(action);
    setShowReviewDialog(true);
  };

  const openDetailDialog = (rec: any) => {
    setSelectedRec(rec);
    setShowDetailDialog(true);
  };

  const handleFlag = async (id: string) => {
    if (!flagReason) {
      toast.error('Please provide a reason for flagging');
      return;
    }
    try {
      await flagExpenditure.mutateAsync({ id, reason: flagReason });
      toast.success('Expenditure flagged');
      setFlaggingId(null);
      setFlagReason('');
    } catch {
      toast.error('Failed to flag expenditure');
    }
  };

  const handleUnflag = async (id: string) => {
    try {
      await unflagExpenditure.mutateAsync(id);
      toast.success('Expenditure unflagged');
    } catch {
      toast.error('Failed to unflag expenditure');
    }
  };

  const ExpendituresSection = () => (
    <div className="mt-6 border-t pt-4">
      <h4 className="flex items-center gap-2 font-medium text-sm mb-3">
        <Receipt className="w-4 h-4 text-muted-foreground" />
        Associated Expenditures
      </h4>
      {loadingExp ? (
        <div className="flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : !expenditures || expenditures.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No expenditures logged for this day.</p>
      ) : (
        <div className="space-y-3">
          {expenditures.map((exp: any) => (
            <div key={exp._id || exp.id} className="border rounded-md p-3 text-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{exp.description}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {exp.category} • {exp.paymentMethod?.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-status-critical">Le {Number(exp.amount).toLocaleString()}</p>
                </div>
              </div>
              
              {exp.flagged ? (
                <div className="bg-status-critical/10 border border-status-critical/20 p-2 rounded text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-status-critical flex items-center gap-1">
                      <Flag className="w-3 h-3" /> Flagged by Admin
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleUnflag(exp._id || exp.id)}>
                      Remove Flag
                    </Button>
                  </div>
                  <p className="text-status-critical">{exp.flagReason}</p>
                </div>
              ) : flaggingId === (exp._id || exp.id) ? (
                <div className="flex gap-2 items-center mt-2">
                  <Input 
                    size={20} 
                    className="h-8 text-xs" 
                    placeholder="Reason for flagging..." 
                    value={flagReason}
                    onChange={e => setFlagReason(e.target.value)}
                  />
                  <Button size="sm" className="h-8" variant="destructive" onClick={() => handleFlag(exp._id || exp.id)}>
                    Submit
                  </Button>
                  <Button size="sm" className="h-8" variant="ghost" onClick={() => { setFlaggingId(null); setFlagReason(''); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end mt-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-status-warning" onClick={() => setFlaggingId(exp._id || exp.id)}>
                    <Flag className="w-3 h-3 mr-1" /> Flag Issue
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <RoleLayout
      title="Reconciliation Review"
      subtitle="Review and approve daily cash reconciliations"
      role="admin"
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border-l-4 border-l-primary border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Total Expected (Net)</p>
            <p className="text-3xl font-bold mt-1">
              Le {totalExpected.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              System-calculated from {allRecs.length} reconciliation(s)
            </p>
          </div>
        </div>

        <div className="bg-card border-l-4 border-l-status-normal border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-status-normal/10">
            <Banknote className="w-6 h-6 text-status-normal" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Total Actual Collected</p>
            <p className="text-3xl font-bold text-status-normal mt-1">
              Le {totalActual.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Counted and reported by receptionists
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending Review</p>
          <p className="text-xl font-bold text-status-warning mt-1">{pendingCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Approved</p>
          <p className="text-xl font-bold text-status-normal mt-1">{approvedCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Rejected</p>
          <p className="text-xl font-bold text-status-critical mt-1">{rejectedCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Net Variance Sum
          </p>
          <p className={cn(
            'text-xl font-bold mt-1',
            totalVarianceSum > 0 ? 'text-status-critical' : totalVarianceSum < 0 ? 'text-status-normal' : ''
          )}>
            {totalVarianceSum > 0 ? 'Shortage: ' : totalVarianceSum < 0 ? 'Surplus: ' : ''}Le {Math.abs(totalVarianceSum).toLocaleString()}
          </p>
        </div>
        <div className={cn(
          'border rounded-lg p-4',
          calcErrorCount > 0 ? 'bg-status-critical/10 border-status-critical/30' : 'bg-card'
        )}>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Calculator className="w-3 h-3" />
            Calc Errors
          </p>
          <p className={cn('text-xl font-bold mt-1', calcErrorCount > 0 ? 'text-status-critical' : '')}>
            {calcErrorCount}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Submitted By</th>
                <th>Expected (Net)</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>Orders</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allRecs.map((rec: any) => {
                const hasVariance = Math.abs(rec.totalVariance) > 0.01;
                const calcErrors = getCalcErrors(rec);
                return (
                  <tr key={rec._id || rec.id} className={calcErrors.length > 0 ? 'bg-status-critical/5' : ''}>
                    <td className="font-medium">
                      {format(new Date(rec.reconciliationDate), 'MMM dd, yyyy')}
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{rec.submittedBy?.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(rec.submittedAt), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <p className="font-medium">Le {rec.expectedTotal.toLocaleString()}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                          {rec.expectedCash > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Banknote className="w-3 h-3" />
                              {rec.expectedCash.toLocaleString()}
                            </span>
                          )}
                          {(rec.expectedOrangeMoney > 0 || rec.expectedAfrimoney > 0) && (
                            <span className="inline-flex items-center gap-0.5">
                              <Smartphone className="w-3 h-3 text-orange-500" />
                              {(rec.expectedOrangeMoney + rec.expectedAfrimoney).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <p className="font-medium">Le {rec.actualTotal.toLocaleString()}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                          {rec.actualCash > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <Banknote className="w-3 h-3" />
                              {rec.actualCash.toLocaleString()}
                            </span>
                          )}
                          {(rec.actualOrangeMoney > 0 || rec.actualAfrimoney > 0) && (
                            <span className="inline-flex items-center gap-0.5">
                              <Smartphone className="w-3 h-3 text-orange-500" />
                              {(rec.actualOrangeMoney + rec.actualAfrimoney).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {hasVariance && (
                            <AlertTriangle className="w-4 h-4 text-status-warning" />
                          )}
                          <span
                            className={cn(
                              'font-medium',
                              rec.totalVariance > 0
                                ? 'text-status-critical'
                                : rec.totalVariance < 0
                                ? 'text-status-normal'
                                : ''
                            )}
                          >
                            {rec.totalVariance > 0 ? 'Shortage: ' : rec.totalVariance < 0 ? 'Surplus: ' : ''}Le{' '}
                            {Math.abs(rec.totalVariance).toLocaleString()}
                          </span>
                        </div>
                        {calcErrors.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-status-critical font-medium">
                            <Calculator className="w-3 h-3" /> Calc Error
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        <p>{rec.totalOrders} total</p>
                        <p className="text-xs text-muted-foreground">
                          {rec.paidOrders} paid
                        </p>
                      </div>
                    </td>
                    <td>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', statusStyles[rec.status as keyof typeof statusStyles])}
                      >
                        {rec.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                        {rec.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {rec.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                        {rec.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {rec.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openReviewDialog(rec, 'approve')}
                            >
                              Review
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => openDetailDialog(rec)}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {allRecs.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    No reconciliations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Reconciliation
            </DialogTitle>
          </DialogHeader>

          {selectedRec && (
            <div className="py-2">
              <div className="bg-muted rounded-lg p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {format(new Date(selectedRec.reconciliationDate), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submitted By:</span>
                    <span className="font-medium">{selectedRec.submittedBy?.fullName}</span>
                  </div>

                  <div className="pt-2 border-t mt-2 space-y-1">
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span></span>
                      <span className="text-muted-foreground text-center">Net Expected</span>
                      <span className="text-muted-foreground text-center">Actual</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span className="flex items-center gap-1"><Banknote className="w-3 h-3" /> Cash</span>
                      <span className="text-center">Le {(selectedRec.expectedCash || 0).toLocaleString()}</span>
                      <span className="text-center">Le {(selectedRec.actualCash || 0).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span className="flex items-center gap-1"><Smartphone className="w-3 h-3 text-orange-500" /> Orange M.</span>
                      <span className="text-center">Le {(selectedRec.expectedOrangeMoney || 0).toLocaleString()}</span>
                      <span className="text-center">Le {(selectedRec.actualOrangeMoney || 0).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <span className="flex items-center gap-1"><Smartphone className="w-3 h-3 text-red-500" /> Afrimoney</span>
                      <span className="text-center">Le {(selectedRec.expectedAfrimoney || 0).toLocaleString()}</span>
                      <span className="text-center">Le {(selectedRec.actualAfrimoney || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Net Expected Total:</span>
                    <span className="font-medium">
                      Le {selectedRec.expectedTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual Total:</span>
                    <span className="font-medium">
                      Le {selectedRec.actualTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Variance:</span>
                    <span
                      className={cn(
                        selectedRec.totalVariance > 0
                          ? 'text-status-critical'
                          : selectedRec.totalVariance < 0
                          ? 'text-status-normal'
                          : ''
                      )}
                    >
                      {selectedRec.totalVariance > 0 ? 'Shortage: ' : selectedRec.totalVariance < 0 ? 'Surplus: ' : ''}Le{' '}
                      {Math.abs(selectedRec.totalVariance).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {getCalcErrors(selectedRec).length > 0 && (
                <div className="bg-status-critical/10 border border-status-critical/30 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-status-critical flex items-center gap-2 mb-1">
                    <Calculator className="w-4 h-4" /> Calculation Error Detected
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-status-critical text-xs">
                    {getCalcErrors(selectedRec).map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <ExpendituresSection />

              <div className="mt-6 border-t pt-4">
                <div className="flex justify-end gap-2 mb-4 mt-2">                  <Button
                    onClick={() => setReviewAction('reject')}
                    variant={reviewAction === 'reject' ? 'destructive' : 'outline'}
                    size="sm"
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Make Rejection
                  </Button>
                  <Button
                    onClick={() => setReviewAction('approve')}
                    variant={reviewAction === 'approve' ? 'default' : 'outline'}
                    size="sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Make Approval
                  </Button>
                </div>
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  Review Notes
                </label>
                <Textarea
                  placeholder={`Optional notes for ${reviewAction}...`}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReviewDialog(false);
                setReviewNotes('');
                setFlaggingId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewReconciliation.isPending}
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
            >
              {reviewReconciliation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Confirm {reviewAction === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reconciliation Details</DialogTitle>
          </DialogHeader>
          {selectedRec && (
            <div className="py-2 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedRec.reconciliationDate), 'EEEE, MMM dd, yyyy')}
                </p>
                <Badge
                  variant="outline"
                  className={cn('capitalize', statusStyles[selectedRec.status as keyof typeof statusStyles])}
                >
                  {selectedRec.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {selectedRec.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                  {selectedRec.status}
                </Badge>
              </div>

              {getCalcErrors(selectedRec).length > 0 && (
                <div className="bg-status-critical/10 border border-status-critical/30 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-status-critical flex items-center gap-2 mb-1">
                    <Calculator className="w-4 h-4" /> Calculation Error Detected
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-status-critical text-xs">
                    {getCalcErrors(selectedRec).map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div className="bg-muted rounded-lg p-4">
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground mb-2">
                  <span>Method</span>
                  <span className="text-right">Net Expected</span>
                  <span className="text-right">Actual</span>
                  <span className="text-right">Variance</span>
                </div>
                <div className="space-y-2 text-sm divide-y">
                  <div className="grid grid-cols-4 gap-2 py-1">
                    <span className="flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-status-normal" /> Cash</span>
                    <span className="text-right">Le {(selectedRec.expectedCash || 0).toLocaleString()}</span>
                    <span className="text-right">Le {(selectedRec.actualCash || 0).toLocaleString()}</span>
                    <span className={cn('text-right font-medium',
                      (selectedRec.expectedCash - selectedRec.actualCash) > 0 ? 'text-status-critical' :
                      (selectedRec.expectedCash - selectedRec.actualCash) < 0 ? 'text-status-normal' : ''
                    )}>
                      {(selectedRec.expectedCash - selectedRec.actualCash) > 0 ? 'Short: ' : (selectedRec.expectedCash - selectedRec.actualCash) < 0 ? 'Surp: ' : ''}
                      Le {(Math.abs(selectedRec.expectedCash - selectedRec.actualCash) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 py-1">
                    <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5 text-orange-500" /> Orange</span>
                    <span className="text-right">Le {(selectedRec.expectedOrangeMoney || 0).toLocaleString()}</span>
                    <span className="text-right">Le {(selectedRec.actualOrangeMoney || 0).toLocaleString()}</span>
                    <span className={cn('text-right font-medium',
                      (selectedRec.expectedOrangeMoney - selectedRec.actualOrangeMoney) > 0 ? 'text-status-critical' :
                      (selectedRec.expectedOrangeMoney - selectedRec.actualOrangeMoney) < 0 ? 'text-status-normal' : ''
                    )}>
                      {(selectedRec.expectedOrangeMoney - selectedRec.actualOrangeMoney) > 0 ? 'Short: ' : (selectedRec.expectedOrangeMoney - selectedRec.actualOrangeMoney) < 0 ? 'Surp: ' : ''}
                      Le {(Math.abs(selectedRec.expectedOrangeMoney - selectedRec.actualOrangeMoney) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 py-1">
                    <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5 text-red-500" /> Afri</span>
                    <span className="text-right">Le {(selectedRec.expectedAfrimoney || 0).toLocaleString()}</span>
                    <span className="text-right">Le {(selectedRec.actualAfrimoney || 0).toLocaleString()}</span>
                    <span className={cn('text-right font-medium',
                      (selectedRec.expectedAfrimoney - selectedRec.actualAfrimoney) > 0 ? 'text-status-critical' :
                      (selectedRec.expectedAfrimoney - selectedRec.actualAfrimoney) < 0 ? 'text-status-normal' : ''
                    )}>
                      {(selectedRec.expectedAfrimoney - selectedRec.actualAfrimoney) > 0 ? 'Short: ' : (selectedRec.expectedAfrimoney - selectedRec.actualAfrimoney) < 0 ? 'Surp: ' : ''}
                      Le {(Math.abs(selectedRec.expectedAfrimoney - selectedRec.actualAfrimoney) || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 py-2 font-bold">
                    <span>Total</span>
                    <span className="text-right">Le {selectedRec.expectedTotal.toLocaleString()}</span>
                    <span className="text-right">Le {selectedRec.actualTotal.toLocaleString()}</span>
                    <span className={cn('text-right',
                      selectedRec.totalVariance > 0 ? 'text-status-critical' :
                      selectedRec.totalVariance < 0 ? 'text-status-normal' : ''
                    )}>
                      {selectedRec.totalVariance > 0 ? 'Short: ' : selectedRec.totalVariance < 0 ? 'Surp: ' : ''}
                      Le {Math.abs(selectedRec.totalVariance).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <ExpendituresSection />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDetailDialog(false); setFlaggingId(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
