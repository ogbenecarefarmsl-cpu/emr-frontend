import { useState } from 'react';
import { useDoctorQueue, useAcceptPatient, useCompleteVisit } from '@/hooks/useVisits';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Clock, CheckCircle, User, Activity, Stethoscope } from 'lucide-react';

interface DoctorQueueProps {
  onSelectPatient?: (visit: any) => void;
}

export function DoctorQueue({ onSelectPatient }: DoctorQueueProps) {
  useAuth();
  const { data: queue = [], isLoading, refetch } = useDoctorQueue();
  const acceptPatient = useAcceptPatient();
  const completeVisit = useCompleteVisit();

  const handleAcceptPatient = async (visitId: string) => {
    try {
      await acceptPatient.mutateAsync(visitId);
      toast.success('Patient accepted for consultation');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to accept patient');
    }
  };

  const handleCompleteVisit = async (visitId: string) => {
    try {
      await completeVisit.mutateAsync(visitId);
      toast.success('Visit completed');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete visit');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_queue':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Waiting</Badge>;
      case 'in_consultation':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">In Consultation</Badge>;
      case 'awaiting_lab':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Awaiting Lab</Badge>;
      case 'awaiting_pharmacy':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Awaiting Pharmacy</Badge>;
      case 'results_ready':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Results Ready</Badge>;
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
          <Stethoscope className="h-5 w-5" />
          Doctor Queue
          <Badge variant="secondary" className="ml-auto">
            {queue.length} patients
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No patients in queue</p>
            <p className="text-sm">Patients will appear here after nurse vitals are completed</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((visit: any) => {
              const patient = visit.patientId;
              const patientName = patient
                ? `${patient.firstName} ${patient.lastName}`
                : 'Unknown Patient';

              return (
                <div
                  key={visit._id || visit.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">
                        {new Date(visit.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{patientName}</div>
                      <div className="text-sm text-muted-foreground">
                        {patient?.patientId} • {patient?.age}y • {patient?.gender === 'M' ? 'Male' : 'Female'}
                      </div>
                      {visit.chiefComplaint && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">Complaint:</span> {visit.chiefComplaint}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(visit.status)}
                    {visit.status === 'in_queue' && (
                      <Button
                        size="sm"
                        onClick={() => handleAcceptPatient(visit._id || visit.id)}
                        disabled={acceptPatient.isPending}
                      >
                        {acceptPatient.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Accept'
                        )}
                      </Button>
                    )}
                    {visit.status === 'in_consultation' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectPatient?.(visit)}
                        >
                          <User className="h-4 w-4 mr-1" />
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleCompleteVisit(visit._id || visit.id)}
                          disabled={completeVisit.isPending}
                        >
                          {completeVisit.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Complete'
                          )}
                        </Button>
                      </>
                    )}
                    {(visit.status === 'awaiting_lab' || visit.status === 'awaiting_pharmacy' || visit.status === 'results_ready') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectPatient?.(visit)}
                      >
                        <Activity className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    )}
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
