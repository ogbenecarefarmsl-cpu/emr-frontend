import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePendingVerificationResults, useVerifyResult } from '@/hooks/useResults';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ResultVerification() {
  const { profile, user } = useAuth();
  const { data: pendingResults, isLoading } = usePendingVerificationResults();
  const verifyResult = useVerifyResult();

  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');

  const criticalResults = pendingResults?.filter(r => 
    r.flag === 'critical_low' || r.flag === 'critical_high'
  );

  const handleVerify = async () => {
    if (!selectedResult || !user) return;

    try {
      await verifyResult.mutateAsync({
        id: selectedResult.id || selectedResult._id
      });

      toast.success('Result verified successfully');
      setShowVerifyDialog(false);
      setSelectedResult(null);
      setVerificationNotes('');
    } catch (error) {
      toast.error('Failed to verify result');
    }
  };

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case 'critical_low':
      case 'critical_high':
        return 'bg-status-critical/10 text-status-critical border-status-critical/20';
      case 'high':
        return 'bg-status-warning/10 text-status-warning border-status-warning/20';
      case 'low':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-status-normal/10 text-status-normal border-status-normal/20';
    }
  };

  const getFlagLabel = (flag: string) => {
    return flag.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <RoleLayout 
      title="Result Verification" 
      subtitle="Review and verify pending results"
      role="lab_tech"
      userName={profile?.full_name}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Pending Verification</p>
          <p className="text-2xl font-bold">{pendingResults?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Critical Results</p>
          <p className="text-2xl font-bold text-status-critical">{criticalResults?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Normal Results</p>
          <p className="text-2xl font-bold text-status-normal">
            {(pendingResults?.length || 0) - (criticalResults?.length || 0)}
          </p>
        </div>
      </div>

      {/* Critical Results Alert */}
      {criticalResults && criticalResults.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <strong>{criticalResults.length} critical result(s)</strong> require immediate attention and verification.
          </AlertDescription>
        </Alert>
      )}

      {/* Results Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Patient</th>
                <th>Test</th>
                <th>Result</th>
                <th>Reference Range</th>
                <th>Flag</th>
                <th>Resulted At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingResults?.map(result => {
                const isCritical = result.flag === 'critical_low' || result.flag === 'critical_high';
                const resultId = result.id || result._id;
                const order = result.orders || result.orderId;
                const orderNumber = order?.orderNumber || order?.order_number;
                const patient = order?.patient || order?.patients;
                const patientFirstName = patient?.firstName || patient?.first_name;
                const patientLastName = patient?.lastName || patient?.last_name;
                const patientCode = patient?.patientId || patient?.patient_id;
                const testCode = result.testCode || result.test_code;
                const testName = result.testName || result.test_name;
                const referenceRange = result.referenceRange || result.reference_range;
                const resultedAt = result.resultedAt || result.resulted_at || result.createdAt;
                return (
                  <tr key={resultId} className={cn(isCritical && 'bg-status-critical/5')}>
                    <td className="font-mono text-sm">
                      {orderNumber || '-'}
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">
                          {patientFirstName} {patientLastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {patientCode}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{testCode}</p>
                        <p className="text-xs text-muted-foreground">{testName}</p>
                      </div>
                    </td>
                    <td>
                      <span className={cn('font-mono font-bold', isCritical && 'text-status-critical')}>
                        {result.value} {result.unit}
                      </span>
                    </td>
                    <td className="text-muted-foreground">
                      {referenceRange || '-'} {result.unit}
                    </td>
                    <td>
                      <Badge variant="outline" className={getFlagColor(result.flag)}>
                        {getFlagLabel(result.flag)}
                      </Badge>
                    </td>
                    <td className="text-sm text-muted-foreground">
                      {resultedAt ? new Date(resultedAt).toLocaleString() : '-'}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedResult(result);
                          setShowVerifyDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(!pendingResults || pendingResults.length === 0) && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No pending results</p>
                    <p className="text-sm">All results have been verified</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Verification Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verify Result</DialogTitle>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="bg-muted rounded-lg p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">
                    {selectedResult.orders?.patient?.firstName || selectedResult.orders?.patients?.first_name} {selectedResult.orders?.patient?.lastName || selectedResult.orders?.patients?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedResult.orders?.patient?.patientId || selectedResult.orders?.patients?.patient_id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order</p>
                  <p className="font-mono">{selectedResult.orders?.orderNumber || selectedResult.orders?.order_number}</p>
                </div>
              </div>

              {/* Result Details */}
              <div className="border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Test</p>
                    <p className="font-semibold">{selectedResult.testCode || selectedResult.test_code}</p>
                    <p className="text-sm">{selectedResult.testName || selectedResult.test_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Result</p>
                    <p className="text-2xl font-bold">
                      {selectedResult.value} <span className="text-base font-normal">{selectedResult.unit}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Reference Range</p>
                    <p>{selectedResult.referenceRange || selectedResult.reference_range || 'Not specified'} {selectedResult.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Flag</p>
                    <Badge variant="outline" className={getFlagColor(selectedResult.flag)}>
                      {getFlagLabel(selectedResult.flag)}
                    </Badge>
                  </div>
                </div>

                {selectedResult.comments && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Comments</p>
                    <p className="text-sm">{selectedResult.comments}</p>
                  </div>
                )}
              </div>

              {/* Critical Warning */}
              {(selectedResult.flag === 'critical_low' || selectedResult.flag === 'critical_high') && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Critical Result:</strong> This result requires immediate physician notification.
                    Ensure proper communication protocols are followed.
                  </AlertDescription>
                </Alert>
              )}

              {/* Verification Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Verification Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about this verification..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Verification Info */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  By verifying this result, you confirm that:
                </p>
                <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                  <li>The result is accurate and complete</li>
                  <li>Quality control checks have passed</li>
                  <li>The result is ready for reporting</li>
                  {(selectedResult.flag === 'critical_low' || selectedResult.flag === 'critical_high') && (
                    <li className="text-status-critical font-medium">Critical result notification will be triggered</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVerifyDialog(false);
                setVerificationNotes('');
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verifyResult.isPending}
              className="bg-status-normal hover:bg-status-normal/90"
            >
              {verifyResult.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle className="w-4 h-4 mr-2" />
              Verify Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}
