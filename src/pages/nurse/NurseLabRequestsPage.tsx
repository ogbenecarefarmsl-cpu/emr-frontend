import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ordersAPI, visitsAPI } from '@/services/api';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, FlaskConical, Loader2, RefreshCw, Search, Send, X } from 'lucide-react';

interface LisOrderable {
  _id?: string;
  code: string;
  name: string;
  price: number;
  isPanel?: boolean;
  category?: string;
  panelComponents?: Array<{ testCode: string; testName: string }>;
}

const patientName = (visit: any) => {
  const patient = visit?.patientId || visit?.patient;
  const name = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim();
  return name || 'Unnamed patient';
};

const patientId = (visit: any) => {
  const patient = visit?.patientId || visit?.patient;
  return typeof patient === 'string' ? patient : patient?._id || patient?.id || '';
};

export default function NurseLabRequestsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [visitId, setVisitId] = useState('');
  const [visitPickerOpen, setVisitPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [notes, setNotes] = useState('');
  const [selectedTests, setSelectedTests] = useState<LisOrderable[]>([]);

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['visits', 'nurse-lab-request-candidates'],
    queryFn: () => visitsAPI.getNurseOrderCandidates(),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

  const {
    data: lisCatalog = [],
    isLoading: catalogLoading,
    isError: catalogError,
    error: catalogLoadError,
  } = useQuery({
    queryKey: ['orders', 'lis-catalog'],
    queryFn: () => ordersAPI.getLisCatalog(),
    staleTime: 5 * 60 * 1000,
  });

  const activeVisits = useMemo(() => {
    const list = Array.isArray(visits) ? visits : visits?.data || [];
    return [...list].sort(
      (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }, [visits]);

  const selectedVisit = activeVisits.find((visit: any) => (visit._id || visit.id) === visitId);
  const selectedPatientId = patientId(selectedVisit);

  // Fetch existing orders for the selected visit
  const { data: existingOrders = [] } = useQuery({
    queryKey: ['orders', 'visit', visitId],
    queryFn: () => ordersAPI.getAll({ visitId, limit: 50 }),
    enabled: !!visitId,
    staleTime: 10 * 1000,
  });

  const filteredCatalog = useMemo(() => {
    const list = Array.isArray(lisCatalog) ? lisCatalog : [];
    const query = search.trim().toLowerCase();
    if (!query) return list.slice(0, 40);
    return list
      .filter((item: LisOrderable) =>
        item.code?.toLowerCase().includes(query) ||
        item.name?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query),
      )
      .slice(0, 80);
  }, [lisCatalog, search]);

  const subtotal = selectedTests.reduce((sum, test) => sum + Number(test.price || 0), 0);

  const createLabOrder = useMutation({
    mutationFn: async () => {
      if (!selectedVisit || !selectedPatientId) {
        throw new Error('Select a patient visit before creating the test order');
      }
      if (selectedTests.length === 0) {
        throw new Error('Select at least one LIS test or panel');
      }

      return ordersAPI.create({
        patientId: selectedPatientId,
        visitId,
        orderType: 'lab',
        priority,
        notes: notes.trim() || undefined,
        tests: selectedTests.map((test) => ({
          testId: test._id || test.code,
          testCode: test.code,
          testName: test.name,
          price: Number(test.price || 0),
          panelCode: test.isPanel ? test.code : undefined,
          panelName: test.isPanel ? test.name : undefined,
        })),
      });
    },
    onSuccess: (order: any) => {
      toast.success(`${order?.orderNumber || 'Order'} sent to reception for payment`);
      setSelectedTests([]);
      setNotes('');
      setPriority('routine');
      queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['visits'], exact: false });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to create test order');
    },
  });

  const retryLisSync = useMutation({
    mutationFn: (orderId: string) => ordersAPI.syncToLis(orderId),
    onSuccess: () => {
      toast.success('LIS sync retry triggered');
      queryClient.invalidateQueries({ queryKey: ['orders', 'visit', visitId], exact: false });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'LIS retry failed');
    },
  });

  const toggleTest = (test: LisOrderable) => {
    setSelectedTests((current) => {
      const exists = current.some((item) => item.code === test.code);
      return exists ? current.filter((item) => item.code !== test.code) : [...current, test];
    });
  };

  const removeTest = (code: string) => {
    setSelectedTests((current) => current.filter((item) => item.code !== code));
  };

  return (
    <RoleLayout
      title="Nurse Test Orders"
      subtitle="Create LIS-backed test orders for active visits; reception completes payment"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Patient Visit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-4">
                <div className="space-y-2">
                  <Label>Active visit</Label>
                  <Popover open={visitPickerOpen} onOpenChange={setVisitPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={visitPickerOpen}
                        className="w-full justify-between font-normal"
                        disabled={visitsLoading}
                      >
                        <span className="truncate">
                          {visitsLoading
                            ? 'Loading eligible visits'
                            : selectedVisit
                              ? `${patientName(selectedVisit)} - ${selectedVisit.visitNumber || 'No visit number'}`
                              : 'Search patient name, ID, or visit number'}
                        </span>
                        {visitsLoading
                          ? <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
                          : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput placeholder="Search patient or visit..." />
                        <CommandList>
                          <CommandEmpty>
                            {activeVisits.length === 0
                              ? 'No paid or insurance-covered active visits in this branch.'
                              : 'No matching patient visit.'}
                          </CommandEmpty>
                          <CommandGroup heading={`${activeVisits.length} eligible visits`}>
                            {activeVisits.map((visit: any) => {
                              const id = visit._id || visit.id;
                              const patient = visit.patientId || visit.patient;
                              const searchableValue = [
                                patientName(visit),
                                patient?.patientId,
                                patient?.phone,
                                visit.visitNumber,
                              ].filter(Boolean).join(' ');

                              return (
                                <CommandItem
                                  key={id}
                                  value={searchableValue}
                                  onSelect={() => {
                                    setVisitId(id);
                                    setVisitPickerOpen(false);
                                  }}
                                  className="items-start gap-2 py-2.5"
                                >
                                  <Check className={cn('mt-0.5 h-4 w-4 shrink-0', visitId === id ? 'opacity-100' : 'opacity-0')} />
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{patientName(visit)}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {[patient?.patientId, visit.visitNumber, (visit.status || '').replace(/_/g, ' ')]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  </div>
                                  {visit.consultationCoverageType === 'insurance' && (
                                    <Badge variant="secondary" className="ml-auto shrink-0">Insurance</Badge>
                                  )}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(value: 'routine' | 'urgent' | 'stat') => setPriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="stat">STAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedVisit && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{patientName(selectedVisit)}</span>
                    <Badge variant="outline">{selectedVisit.visitNumber}</Badge>
                    <Badge variant="secondary" className="capitalize">{(selectedVisit.status || '').replace(/_/g, ' ')}</Badge>
                  </div>
                  {selectedVisit.chiefComplaint && (
                    <p className="mt-2 text-muted-foreground">{selectedVisit.chiefComplaint}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Existing orders for this visit */}
          {visitId && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Existing Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {existingOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders yet for this visit</p>
                ) : (
                  <div className="space-y-2">
                    {existingOrders.map((order: any) => (
                      <div key={order._id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{order.orderNumber}</span>
                            <Badge variant="outline" className="text-xs">{order.orderType}</Badge>
                            <Badge
                              variant={
                                order.status === 'completed' ? 'default'
                                : order.status === 'awaiting_payment' ? 'destructive'
                                : 'secondary'
                              }
                              className="text-xs capitalize"
                            >
                              {order.status?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          {order.order_tests?.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground truncate max-w-[280px]">
                              {order.order_tests.map((t: any) => t.testName).join(', ')}
                            </p>
                          )}
                        </div>
                        {order.priority && order.priority !== 'routine' && (
                          <Badge variant="secondary" className="text-xs uppercase">{order.priority}</Badge>
                        )}
                        {order.lisSyncStatus === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => retryLisSync.mutate(order._id)}
                            disabled={retryLisSync.isPending}
                          >
                            <RefreshCw className={cn('h-3 w-3 mr-1', retryLisSync.isPending && 'animate-spin')} />
                            Retry LIS
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">LIS Tests And Panels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search LIS catalog by code or name"
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[calc(100vh-430px)] min-h-[320px] rounded-lg border">
                {catalogLoading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading LIS catalog
                  </div>
                ) : catalogError ? (
                  <div className="p-4 text-sm text-destructive">
                    {(catalogLoadError as any)?.response?.data?.message || (catalogLoadError as any)?.message || 'Could not load LIS catalog'}
                  </div>
                ) : filteredCatalog.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No matching LIS orderables found</div>
                ) : (
                  <div className="divide-y">
                    {filteredCatalog.map((test: LisOrderable) => {
                      const selected = selectedTests.some((item) => item.code === test.code);
                      return (
                        <button
                          key={test.code}
                          type="button"
                          onClick={() => toggleTest(test)}
                          className={cn(
                            'w-full px-4 py-3 text-left transition-colors hover:bg-muted/60',
                            selected && 'bg-primary/5',
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{test.name}</span>
                                <Badge variant="outline">{test.code}</Badge>
                                {test.isPanel && <Badge variant="secondary">Panel</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {test.category || 'Test'}{test.panelComponents?.length ? ` - ${test.panelComponents.length} component tests` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="text-sm font-semibold">Le {Number(test.price || 0).toLocaleString()}</span>
                              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', selected && 'border-primary bg-primary text-primary-foreground')}>
                                {selected && <Check className="h-3.5 w-3.5" />}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5 text-primary" />
                Request Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Clinical notes</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes for lab and reception"
                  rows={4}
                />
              </div>

              <div className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
                  <span>Selected tests</span>
                  <Badge variant="outline">{selectedTests.length}</Badge>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {selectedTests.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No tests selected</p>
                  ) : (
                    selectedTests.map((test) => (
                      <div key={test.code} className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.code} - Le {Number(test.price || 0).toLocaleString()}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeTest(test.code)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-3">
                <span className="text-sm text-muted-foreground">Patient pays at reception</span>
                <span className="font-semibold">Le {subtotal.toLocaleString()}</span>
              </div>

              <Button
                className="w-full"
                onClick={() => createLabOrder.mutate()}
                disabled={createLabOrder.isPending || !selectedVisit || selectedTests.length === 0}
              >
                {createLabOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send To Reception
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleLayout>
  );
}
