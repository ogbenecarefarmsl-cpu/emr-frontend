import { useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, Phone, Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { resultsAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

export function CriticalResultNotificationSystem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch critical results (unverified critical values)
  const { data: criticalResults } = useQuery({
    queryKey: ['critical-results'],
    queryFn: async () => {
      return await resultsAPI.getCritical();
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Show toast for new critical results
  useEffect(() => {
    if (criticalResults && criticalResults.length > 0) {
      // Filter for unverified critical results
      const unverified = criticalResults.filter((r: any) => r.status !== 'verified');
      
      if (unverified.length > 0) {
        const latest = unverified[0];
        const timeSinceCreation = Date.now() - new Date(latest.createdAt).getTime();
        
        // Only show toast if result is less than 1 minute old
        if (timeSinceCreation < 60000) {
          toast.error(
            `Critical Result: ${latest.testCode} - Patient needs immediate attention`,
            {
              duration: 10000,
              action: {
                label: 'View',
                onClick: () => {
                  navigate('/lab/processing');
                }
              }
            }
          );
        }
      }
    }
  }, [criticalResults, navigate]);

  if (!criticalResults || criticalResults.length === 0) {
    return null;
  }

  // Filter for unverified critical results
  const unverifiedCritical = criticalResults.filter((r: any) => r.status !== 'verified');

  if (unverifiedCritical.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {unverifiedCritical.slice(0, 3).map((result: any) => (
        <Alert key={result.id || result._id} variant="destructive" className="shadow-lg">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold">Critical Result Alert</p>
                <p className="text-sm mt-1">
                  Order: {result.orderId?.orderNumber || 'Unknown'}
                </p>
                <p className="text-sm">
                  Test: {result.testCode} = {result.value} {result.unit}
                </p>
                <Badge variant="destructive" className="mt-1">
                  {result.flag?.replace('_', ' ').toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(result.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/lab/processing')}
                className="shrink-0"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Review
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
      {unverifiedCritical.length > 3 && (
        <Alert className="shadow-lg">
          <Bell className="w-4 h-4" />
          <AlertDescription>
            <p className="text-sm">
              +{unverifiedCritical.length - 3} more critical results pending review
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Note: Critical results are handled through the normal verification workflow
// Use resultsAPI.verify(resultId) to acknowledge and verify critical results
