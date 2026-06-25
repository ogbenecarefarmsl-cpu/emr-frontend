import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { prescriptionService } from '@/services/prescriptionService';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Pill, Search, ArrowRight, User, Clock, CheckCircle, Loader2 } from 'lucide-react';

const patientName = (p: any) => p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown' : 'Unknown';

export default function ReceptionDispensingQueue() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['prescriptions', 'dispensing-queue'],
    queryFn: () => prescriptionService.findAll(),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const readyToDispense = prescriptions.filter((rx: any) => rx.isPaid && rx.status !== 'dispensed');
  const dispensed = prescriptions.filter((rx: any) => rx.status === 'dispensed');

  const groupedReadyToDispense = Object.values(
    readyToDispense.reduce((acc: Record<string, any>, rx: any) => {
      const patientId = rx.patientId?._id || rx.patientId?.patientId || 'unknown';
      if (!acc[patientId]) {
        acc[patientId] = {
          patientId,
          patient: rx.patientId,
          prescriptions: [],
          itemCount: 0,
          total: 0,
          earliestDate: rx.createdAt,
        };
      }
      acc[patientId].prescriptions.push(rx);
      acc[patientId].itemCount += (rx.items || []).length;
      acc[patientId].total += rx.actualTotalAmount || rx.totalAmount || 0;
      if (rx.createdAt && (!acc[patientId].earliestDate || new Date(rx.createdAt) < new Date(acc[patientId].earliestDate))) {
        acc[patientId].earliestDate = rx.createdAt;
      }
      return acc;
    }, {}),
  ).sort((a: any, b: any) => new Date(a.earliestDate || 0).getTime() - new Date(b.earliestDate || 0).getTime());

  const filtered = searchTerm.trim()
    ? groupedReadyToDispense.filter((group: any) => {
        const q = searchTerm.toLowerCase();
        const name = patientName(group.patient).toLowerCase();
        const num = group.prescriptions.map((rx: any) => rx.prescriptionNumber || '').join(' ').toLowerCase();
        return name.includes(q) || num.includes(q);
      })
    : groupedReadyToDispense;

  return (
    <RoleLayout
      title="Dispensing"
      subtitle="Paid prescriptions ready to dispense"
      role="receptionist"
      userName={profile?.fullName}
    >
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groupedReadyToDispense.length}</p>
                <p className="text-xs text-muted-foreground">Patients Ready</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dispensed.length}</p>
                <p className="text-xs text-muted-foreground">Dispensed Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Pill className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{prescriptions.length}</p>
                <p className="text-xs text-muted-foreground">Total Prescriptions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient name or Rx number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Queue */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {searchTerm ? 'No matching prescriptions found' : 'No prescriptions ready to dispense'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="space-y-2">
              {filtered.map((group: any) => {
                const pName = patientName(group.patient);
                const date = group.earliestDate ? format(new Date(group.earliestDate), 'dd MMM, HH:mm') : '';
                const rxIds = group.prescriptions.map((rx: any) => rx._id).join(',');
                const primaryRx = group.prescriptions[0];

                return (
                  <Card
                    key={group.patientId}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/reception/dispense/${primaryRx._id}?rxIds=${encodeURIComponent(rxIds)}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                            <Pill className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm truncate">{pName}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {group.prescriptions.length} Rx
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{group.itemCount} item{group.itemCount !== 1 ? 's' : ''}</span>
                              <span>Le {group.total.toLocaleString()}</span>
                              <span>{date}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                              {group.prescriptions.map((rx: any) => rx.prescriptionNumber).join(', ')}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="default" className="shrink-0 gap-1">
                          Dispense <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </RoleLayout>
  );
}
