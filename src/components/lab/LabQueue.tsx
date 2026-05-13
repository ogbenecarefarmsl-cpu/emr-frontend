import { useLabQueue } from '@/hooks/useVisits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCreatedAt,
  getGroupedTestsByPanel,
  getOrderId,
  getOrderNumber,
  getOrderPriority,
  getOrderStatus,
  getPatientAgeDisplay,
  getPatientId,
  getPatientName,
} from '@/utils/orderHelpers';
import { Loader2, FlaskConical, CheckCircle, Clock, ClipboardCheck } from 'lucide-react';

interface LabQueueProps {
  onStartTest?: (order: any) => void;
}

export function LabQueue({ onStartTest }: LabQueueProps) {
  const { data: queue = [], isLoading } = useLabQueue();

  const getActionLabel = (status: string) => {
    switch (status) {
      case 'paid':
      case 'pending_collection':
        return 'Collect Sample';
      case 'collected':
      case 'processing':
        return 'Enter Results';
      default:
        return 'Open Order';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>;
      case 'pending_collection':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending Collection</Badge>;
      case 'collected':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Collected</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Paid Lab Queue
          <Badge variant="secondary" className="ml-auto">
            {queue.length} orders
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium text-foreground">No paid lab orders waiting</p>
            <p className="text-sm">Doctor lab orders appear here after reception confirms payment.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="hidden md:grid grid-cols-[110px_1.2fr_1.4fr_160px_150px] gap-3 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Time</span>
              <span>Patient</span>
              <span>Tests</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>

            {queue.map((order: any) => {
              const status = getOrderStatus(order);
              const ageDisplay = getPatientAgeDisplay(order.patient || order.patients || order.patientId);
              const createdTime = new Date(getCreatedAt(order)).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={getOrderId(order)}
                  className="grid grid-cols-1 md:grid-cols-[110px_1.2fr_1.4fr_160px_150px] gap-3 border-t px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{createdTime}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">{getPatientName(order)}</p>
                      <Badge variant="outline" className="h-5 text-[10px]">
                        {getOrderPriority(order)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {getPatientId(order)} {ageDisplay !== '-' ? `- ${ageDisplay}` : ''}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm truncate">{getGroupedTestsByPanel(order)}</p>
                    <p className="text-xs text-muted-foreground">{getOrderNumber(order)}</p>
                  </div>

                  <div className="flex items-center">{getStatusBadge(status)}</div>

                  <div className="flex items-center justify-start md:justify-end">
                    <Button
                      size="sm"
                      variant={status === 'processing' || status === 'collected' ? 'default' : 'outline'}
                      onClick={() => onStartTest?.(order)}
                      className="gap-1"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      {getActionLabel(status)}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
