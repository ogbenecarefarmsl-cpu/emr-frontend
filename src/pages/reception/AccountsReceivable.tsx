import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ordersAPI } from '@/services/api';
import { Users, DollarSign, Eye, Loader2, Search } from 'lucide-react';

export default function AccountsReceivable() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['patient-outstanding'],
    queryFn: () => ordersAPI.getPatientOutstanding(),
    staleTime: 30_000,
  });

  const patients = data?.patients || [];
  const summary = data?.summary || { totalPatients: 0, totalOutstanding: 0 };

  const filtered = patients.filter((p: any) => {
    const term = search.toLowerCase();
    return (
      p.firstName?.toLowerCase().includes(term) ||
      p.lastName?.toLowerCase().includes(term) ||
      p.patientCode?.toLowerCase().includes(term) ||
      p.phone?.includes(term)
    );
  });

  return (
    <RoleLayout title="Accounts Receivable" subtitle="Patients with outstanding balances" role="receptionist">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Patients Owing</p>
                  <p className="text-2xl font-bold mt-0.5">{summary.totalPatients}</p>
                </div>
                <Users className="w-6 h-6 text-blue-600 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold mt-0.5 text-red-700">Le {summary.totalOutstanding.toLocaleString()}</p>
                </div>
                <DollarSign className="w-6 h-6 text-red-600 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Patient list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patients with Outstanding Balances</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {search ? 'No patients match your search' : 'No outstanding balances'}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((patient: any) => (
                  <div key={patient.patientId} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{patient.firstName} {patient.lastName}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{patient.patientCode}</Badge>
                          {patient.phone && (
                            <span className="text-xs text-muted-foreground">{patient.phone}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {patient.orderCount} unpaid order{patient.orderCount !== 1 ? 's' : ''}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {patient.orders.slice(0, 3).map((order: any) => (
                            <Badge
                              key={order._id}
                              variant="outline"
                              className={`text-[10px] ${order.paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}
                            >
                              {order.orderNumber}: Le {order.total.toLocaleString()}
                              {order.paymentStatus === 'partial' && ` (Bal: Le ${order.balance.toLocaleString()})`}
                            </Badge>
                          ))}
                          {patient.orders.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">+{patient.orders.length - 3} more</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg text-red-700">Le {patient.totalOwed.toLocaleString()}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 text-xs"
                          onClick={() => navigate(`/reception/patients/${patient.patientId}`)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Patient
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleLayout>
  );
}
