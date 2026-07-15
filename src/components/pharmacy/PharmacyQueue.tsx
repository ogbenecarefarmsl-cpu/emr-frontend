import { useState } from 'react';
import { usePharmacyQueue } from '@/hooks/useVisits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Pill, CheckCircle, Clock, User } from 'lucide-react';
import { InsuranceStatusBadge } from '@/components/insurance/InsuranceStatusBadge';

interface PharmacyQueueProps {
  onDispense?: (order: any) => void;
}

export function PharmacyQueue({ onDispense }: PharmacyQueueProps) {
  const { data: queue = [], isLoading, refetch } = usePharmacyQueue();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Paid</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Processing</Badge>;
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pill className="h-5 w-5" />
          Pharmacy Queue
          <Badge variant="secondary" className="ml-auto">
            {queue.length} prescriptions
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No prescriptions in queue</p>
            <p className="text-sm">Paid prescriptions will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((order: any) => {
              const patient = order.patientId;
              const patientName = patient
                ? `${patient.firstName} ${patient.lastName}`
                : 'Unknown Patient';

              return (
                <div
                  key={order._id || order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {patientName}
                        <InsuranceStatusBadge
                          insurance={order.visitId?.insurance}
                          coverageType={order.visitId?.consultationCoverageType}
                          compact
                          className="h-4 px-1 py-0 text-[9px]"
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {patient?.patientId} • {patient?.age}y • {patient?.gender === 'M' ? 'Male' : 'Female'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Order: {order.orderNumber}
                      </div>
                      {order.notes && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Notes: {order.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(order.status)}
                    <Button
                      size="sm"
                      onClick={() => onDispense?.(order)}
                    >
                      <Pill className="h-4 w-4 mr-1" />
                      Dispense
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
