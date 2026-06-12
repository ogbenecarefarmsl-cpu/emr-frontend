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

  const filtered = searchTerm.trim()
    ? readyToDispense.filter((rx: any) => {
        const q = searchTerm.toLowerCase();
        const name = patientName(rx.patientId).toLowerCase();
        const num = (rx.prescriptionNumber || '').toLowerCase();
        return name.includes(q) || num.includes(q);
      })
    : readyToDispense;

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
                <p className="text-2xl font-bold">{readyToDispense.length}</p>
                <p className="text-xs text-muted-foreground">Ready to Dispense</p>
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
              {filtered.map((rx: any) => {
                const pName = patientName(rx.patientId);
                const itemCount = (rx.items || []).length;
                const total = rx.actualTotalAmount || rx.totalAmount || 0;
                const date = rx.createdAt ? format(new Date(rx.createdAt), 'dd MMM, HH:mm') : '';

                return (
                  <Card
                    key={rx._id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/reception/dispense/${rx._id}`)}
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
                                {rx.prescriptionNumber}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                              <span>Le {total.toLocaleString()}</span>
                              <span>{date}</span>
                            </div>
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
