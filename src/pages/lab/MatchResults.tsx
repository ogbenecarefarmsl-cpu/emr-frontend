import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  FlaskConical, 
  CheckCircle, 
  XCircle, 
  Search,
  AlertCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatientAgeDisplay } from '@/utils/orderHelpers';

interface UnmatchedResult {
  machineId: string;
  machineName: string;
  protocol: string;
  parsedResults: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    abnormalFlag?: string;
  }>;
  receivedAt: string;
  position?: number;
  status: 'pending' | 'matched' | 'rejected';
}

export default function MatchResults() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedResult, setSelectedResult] = useState<number | null>(null);
  const [sampleId, setSampleId] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  // Fetch unmatched results
  const { data: unmatchedResults = [], isLoading } = useQuery({
    queryKey: ['unmatched-results'],
    queryFn: async () => {
      const response = await api.get('/hl7/unmatched-results');
      return response.data as UnmatchedResult[];
    },
    refetchInterval: 5000, // Poll every 5 seconds for new results
  });

  // Search for order by sample ID
  const { data: searchedOrder, isLoading: searchLoading } = useQuery({
    queryKey: ['order-search', orderSearch],
    queryFn: async () => {
      if (!orderSearch) return null;
      const response = await api.get(`/orders?search=${orderSearch}`);
      return response.data?.data?.[0] || null;
    },
    enabled: orderSearch.length > 0,
  });

  // Match result mutation
  const matchMutation = useMutation({
    mutationFn: async ({ resultIndex, orderId }: { resultIndex: number; orderId: string }) => {
      const response = await api.post('/hl7/match-result', { resultIndex, orderId });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Results matched successfully!');
      queryClient.invalidateQueries({ queryKey: ['unmatched-results'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setSelectedResult(null);
      setSampleId('');
      setOrderSearch('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to match results');
    },
  });

  // Reject result mutation
  const rejectMutation = useMutation({
    mutationFn: async (resultIndex: number) => {
      const response = await api.post(`/hl7/reject-result/${resultIndex}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Result rejected');
      queryClient.invalidateQueries({ queryKey: ['unmatched-results'] });
      setSelectedResult(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reject result');
    },
  });

  const handleSearch = () => {
    setOrderSearch(sampleId);
  };

  const handleMatch = () => {
    if (selectedResult === null || !searchedOrder) {
      toast.error('Please select a result and search for an order');
      return;
    }

    matchMutation.mutate({
      resultIndex: selectedResult,
      orderId: searchedOrder.id,
    });
  };

  const handleReject = (index: number) => {
    if (confirm('Are you sure you want to reject this result? This cannot be undone.')) {
      rejectMutation.mutate(index);
    }
  };

  const selectedResultData = selectedResult !== null ? unmatchedResults[selectedResult] : null;

  return (
    <RoleLayout
      title="Match Analyzer Results"
      subtitle="Link incoming results to patient samples"
      role="lab_tech"
      userName={profile?.full_name}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Unmatched Results */}
        <div>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FlaskConical className="w-5 h-5" />
                Pending Results
              </h3>
              <Badge variant="secondary">
                {unmatchedResults.length} unmatched
              </Badge>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : unmatchedResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No pending results</p>
                <p className="text-sm">All results have been matched</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {unmatchedResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedResult(index)}
                    className={cn(
                      'w-full text-left p-4 rounded-lg border transition-colors',
                      selectedResult === index
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{result.machineName}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.protocol} • {result.parsedResults.length} tests
                        </p>
                      </div>
                      {result.position && (
                        <Badge variant="outline">Pos {result.position}</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(result.receivedAt).toLocaleString()}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.parsedResults.slice(0, 5).map((test, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {test.testCode}
                        </Badge>
                      ))}
                      {result.parsedResults.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{result.parsedResults.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Matching Interface */}
        <div>
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Match to Sample</h3>

            {selectedResultData ? (
              <div className="space-y-4">
                {/* Selected Result Details */}
                <div className="bg-muted rounded-lg p-4">
                  <p className="font-medium mb-2">{selectedResultData.machineName}</p>
                  <div className="space-y-1 text-sm">
                    {selectedResultData.parsedResults.map((test, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{test.testCode}:</span>
                        <span className="font-medium">
                          {test.value} {test.unit}
                          {test.abnormalFlag && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              {test.abnormalFlag}
                            </Badge>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample ID Search */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Enter Sample ID
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="LAB-YYYYMMDD-####"
                      value={sampleId}
                      onChange={(e) => setSampleId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={searchLoading}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Order Details */}
                {searchedOrder && (
                  <div className="bg-status-normal/10 border border-status-normal rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-status-normal flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">
                          {searchedOrder.patients?.first_name} {searchedOrder.patients?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {searchedOrder.patients?.gender === 'M' ? 'Male' : 'Female'} • 
                          Age: {getPatientAgeDisplay(searchedOrder.patients)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Order: {searchedOrder.order_number}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {searchedOrder.order_tests?.map((test: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {test.test_code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {orderSearch && !searchedOrder && !searchLoading && (
                  <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Order not found</p>
                        <p className="text-sm text-muted-foreground">
                          No order found with Sample ID: {orderSearch}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={handleMatch}
                    disabled={!searchedOrder || matchMutation.isPending}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Match
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleReject(selectedResult)}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a result to match</p>
                <p className="text-sm">Choose from the pending results list</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </RoleLayout>
  );
}
