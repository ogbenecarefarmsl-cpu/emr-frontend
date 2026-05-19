import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePatient, usePatientResults, useUpdatePatient, usePatientWallet, useWalletTransactions, useDepositWallet, useWithdrawWallet } from '@/hooks/usePatients';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Eye, Loader2, Save, X, Wallet, ArrowDownToLine, ArrowUpFromLine, Clock } from 'lucide-react';
import { PatientNotesPanel } from '@/components/patients/PatientNotesPanel';
import { getPatientAgeDisplay, getPatientFullName } from '@/utils/orderHelpers';

type AgeUnit = 'years' | 'months' | 'weeks' | 'days';

interface FormState {
  firstName: string;
  lastName: string;
  ageValue: string;
  ageUnit: AgeUnit;
  gender: 'M' | 'F' | 'O';
  phone: string;
  email: string;
  address: string;
}

interface NormalizedPatient {
  id: string;
  patientId: string;
  mrn?: string;
  firstName: string;
  lastName: string;
  age: number;
  ageValue: number;
  ageUnit: AgeUnit;
  gender: 'M' | 'F' | 'O';
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
}

const convertAgeToYears = (ageValue: number, ageUnit: AgeUnit): number => {
  switch (ageUnit) {
    case 'months':
      return Number((ageValue / 12).toFixed(2));
    case 'weeks':
      return Number((ageValue / 52.1429).toFixed(2));
    case 'days':
      return Number((ageValue / 365.25).toFixed(2));
    case 'years':
    default:
      return ageValue;
  }
};

const getField = <T,>(record: any, keys: string[], fallback: T): T => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null) {
      return value as T;
    }
  }

  return fallback;
};

const normalizePatient = (patient: any): NormalizedPatient => {
  const age = Number(getField<number | string>(patient, ['age'], 0));
  const ageValue = Number(getField<number | string>(patient, ['ageValue', 'age_value'], age));
  const ageUnit = getField<AgeUnit>(patient, ['ageUnit', 'age_unit'], 'years');

  return {
    id: getField<string>(patient, ['id', '_id'], ''),
    patientId: getField<string>(patient, ['patientId', 'patient_id'], '-'),
    mrn: getField<string | undefined>(patient, ['mrn'], undefined),
    firstName: getField<string>(patient, ['firstName', 'first_name'], ''),
    lastName: getField<string>(patient, ['lastName', 'last_name'], ''),
    age,
    ageValue: Number.isFinite(ageValue) ? ageValue : age,
    ageUnit,
    gender: getField<'M' | 'F' | 'O'>(patient, ['gender'], 'O'),
    phone: getField<string | undefined>(patient, ['phone'], undefined),
    email: getField<string | undefined>(patient, ['email'], undefined),
    address: getField<string | undefined>(patient, ['address'], undefined),
    createdAt: getField<string | undefined>(patient, ['createdAt', 'created_at'], undefined),
  };
};

const resolveOrderPatientId = (order: any): string | undefined => {
  const candidates = [
    typeof order?.patientId === 'string' ? order.patientId : undefined,
    typeof order?.patientId === 'object' ? order.patientId?.id || order.patientId?._id : undefined,
    order?.patient?.id,
    order?.patient?._id,
    order?.patients?.id,
    order?.patients?._id,
    order?.patient_id,
  ];

  return candidates.find((candidate) => typeof candidate === 'string');
};

const getOrderId = (order: any): string | undefined => {
  return order?.id || order?._id;
};

const getOrderNumber = (order: any): string => {
  return order?.orderNumber || order?.order_number || '-';
};

const getOrderDate = (order: any): string | undefined => {
  return order?.createdAt || order?.created_at;
};

const getResultDate = (result: any): string | undefined => {
  return result?.resultedAt || result?.createdAt;
};

const formatDateSafe = (value?: string): string => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return format(parsed, 'MMM dd, yyyy');
};

const formatDateTimeSafe = (value?: string): string => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return format(parsed, 'MMM dd, yyyy HH:mm');
};

const flagLabel = (flag?: string): string => {
  if (!flag) {
    return 'normal';
  }

  return flag.replace(/_/g, ' ');
};

export default function PatientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, primaryRole } = useAuth();
  const currentRole = primaryRole === 'admin' ? 'admin' : primaryRole === 'lab_tech' ? 'lab_tech' : 'receptionist';
  const canEditPatient = currentRole === 'admin' || currentRole === 'receptionist';

  const { data: patient, isLoading } = usePatient(id || '');
  const { data: orders } = useOrders('all');
  const { data: patientResults, isLoading: isLoadingResults } = usePatientResults(id || '');
  const updatePatient = useUpdatePatient();

  const normalizedPatient = useMemo(() => {
    if (!patient) {
      return null;
    }

    return normalizePatient(patient);
  }, [patient]);

  const patientOrders = useMemo(() => {
    if (!id || !orders) {
      return [];
    }

    return orders.filter((order) => resolveOrderPatientId(order) === id);
  }, [id, orders]);

  const groupedResultsByDate = useMemo(() => {
    const map = new Map<string, typeof patientResults>();

    for (const result of patientResults || []) {
      const rawDate = getResultDate(result);
      const date = rawDate ? new Date(rawDate) : null;
      const key = date && !Number.isNaN(date.getTime()) ? format(date, 'yyyy-MM-dd') : 'unknown';

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(result);
    }

    return Array.from(map.entries())
      .sort(([dateA], [dateB]) => {
        if (dateA === 'unknown') {
          return 1;
        }

        if (dateB === 'unknown') {
          return -1;
        }

        return dateB.localeCompare(dateA);
      })
      .map(([dateKey, results]) => {
        const sortedResults = [...results].sort((a, b) => {
          const aTime = new Date(getResultDate(a) || 0).getTime();
          const bTime = new Date(getResultDate(b) || 0).getTime();
          return bTime - aTime;
        });

        const displayDate =
          dateKey === 'unknown'
            ? 'Unknown Date'
            : format(new Date(`${dateKey}T00:00:00`), 'EEEE, MMM dd, yyyy');

        return {
          dateKey,
          displayDate,
          results: sortedResults,
        };
      });
  }, [patientResults]);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    firstName: '',
    lastName: '',
    ageValue: '',
    ageUnit: 'years',
    gender: 'M',
    phone: '',
    email: '',
    address: '',
  });

  const handleEdit = () => {
    if (!normalizedPatient) {
      return;
    }

    setFormData({
      firstName: normalizedPatient.firstName,
      lastName: normalizedPatient.lastName,
      ageValue: String(normalizedPatient.ageValue || normalizedPatient.age || ''),
      ageUnit: normalizedPatient.ageUnit,
      gender: normalizedPatient.gender,
      phone: normalizedPatient.phone || '',
      email: normalizedPatient.email || '',
      address: normalizedPatient.address || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!id) {
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.ageValue.trim()) {
      toast.error('First name, last name, and age are required');
      return;
    }

    const ageValueNumber = Number(formData.ageValue);
    if (Number.isNaN(ageValueNumber) || ageValueNumber < 0) {
      toast.error('Please enter a valid age value');
      return;
    }

    const normalizedAge = convertAgeToYears(ageValueNumber, formData.ageUnit);

    try {
      await updatePatient.mutateAsync({
        id,
        updates: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          age: normalizedAge,
          ageValue: ageValueNumber,
          ageUnit: formData.ageUnit,
          gender: formData.gender,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
        },
      });

      toast.success('Patient details updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update patient details');
    }
  };

  const getReportPath = (orderId: string) => {
    return currentRole === 'lab_tech' ? `/lab/reports/${orderId}` : `/reception/reports/${orderId}`;
  };

  const openOrderReport = (orderId?: string) => {
    if (!orderId) {
      toast.error('No report found for this entry');
      return;
    }

    navigate(getReportPath(orderId));
  };

  const goBackPath = currentRole === 'lab_tech' ? '/lab/patients' : currentRole === 'admin' ? '/admin/patients' : '/reception/patients';

  if (isLoading) {
    return (
      <RoleLayout title="Patient Details" subtitle="Loading..." role={currentRole} userName={profile?.fullName}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </RoleLayout>
    );
  }

  if (!normalizedPatient) {
    return (
      <RoleLayout title="Patient Not Found" subtitle="Patient does not exist" role={currentRole} userName={profile?.fullName}>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Patient not found</p>
          <Button onClick={() => navigate(goBackPath)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Patients
          </Button>
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout
      title={getPatientFullName(normalizedPatient as any)}
      subtitle={normalizedPatient.patientId}
      role={currentRole}
      userName={profile?.fullName}
    >
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(goBackPath)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Patients
        </Button>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="orders">Orders ({patientOrders.length})</TabsTrigger>
          <TabsTrigger value="history">Result History</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Patient Information</h3>
              {canEditPatient && !isEditing && (
                <Button onClick={handleEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}

              {canEditPatient && isEditing && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updatePatient.isPending}>
                    {updatePatient.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(event) => setFormData((prev) => ({ ...prev, firstName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(event) => setFormData((prev) => ({ ...prev, lastName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.ageValue}
                    onChange={(event) => setFormData((prev) => ({ ...prev, ageValue: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age Unit</Label>
                  <Select
                    value={formData.ageUnit}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, ageUnit: value as AgeUnit }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="years">Years</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, gender: value as 'M' | 'F' | 'O' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                      <SelectItem value="O">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Patient ID</p>
                  <p className="font-mono font-semibold">{normalizedPatient.patientId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MRN</p>
                  <p className="font-mono">{normalizedPatient.mrn || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{getPatientFullName(normalizedPatient as any)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p>{normalizedPatient.gender === 'M' ? 'Male' : normalizedPatient.gender === 'F' ? 'Female' : 'Other'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Age</p>
                  <p>{getPatientAgeDisplay(normalizedPatient as any)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p>{normalizedPatient.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p>{normalizedPatient.email || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p>{normalizedPatient.address || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Registered</p>
                  <p>{formatDateSafe(normalizedPatient.createdAt)}</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Tests</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patientOrders.map((order) => {
                  const orderId = getOrderId(order);
                  const orderTests = order.tests || order.order_tests || [];

                  return (
                    <tr key={orderId || getOrderNumber(order)}>
                      <td className="font-mono">{getOrderNumber(order)}</td>
                      <td>{formatDateSafe(getOrderDate(order))}</td>
                      <td>{orderTests.length} test(s)</td>
                      <td>
                        <Badge variant="outline">{String(order.status || '-').replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="font-semibold">Le {Number(order.total || order.totalAmount || 0).toLocaleString()}</td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => openOrderReport(orderId)}>
                          <Eye className="w-4 h-4 mr-1" />
                          View Report
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {patientOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No orders found for this patient
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="bg-card border rounded-lg p-4">
            {isLoadingResults ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : groupedResultsByDate.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No result history available for this patient</p>
            ) : (
              <Accordion type="multiple" className="w-full">
                {groupedResultsByDate.map((group) => (
                  <AccordionItem key={group.dateKey} value={group.dateKey}>
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="text-left">
                          <p className="font-semibold">{group.displayDate}</p>
                          <p className="text-xs text-muted-foreground">{group.results.length} result(s)</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto border rounded-md">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2">Date/Time</th>
                              <th className="text-left px-3 py-2">Test</th>
                              <th className="text-left px-3 py-2">Result</th>
                              <th className="text-left px-3 py-2">Flag</th>
                              <th className="text-left px-3 py-2">Order</th>
                              <th className="text-left px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.results.map((result, index) => (
                              <tr key={result.id || `${result.testCode}-${index}`} className="border-t">
                                <td className="px-3 py-2 text-muted-foreground">{formatDateTimeSafe(getResultDate(result))}</td>
                                <td className="px-3 py-2 font-medium">{result.testName || result.testCode || '-'}</td>
                                <td className="px-3 py-2">{result.value}{result.unit ? ` ${result.unit}` : ''}</td>
                                <td className="px-3 py-2">
                                  <Badge variant={result.flag && result.flag !== 'normal' ? 'destructive' : 'outline'}>
                                    {flagLabel(result.flag)}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">{result.orderNumber || '-'}</td>
                                <td className="px-3 py-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openOrderReport(result.orderId)}
                                    disabled={!result.orderId}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="mt-6">
          <WalletPanel patientId={id || ''} />
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="bg-card border rounded-lg p-6">
            <PatientNotesPanel patientId={id || ''} />
          </div>
        </TabsContent>
      </Tabs>
    </RoleLayout>
  );
}

function WalletPanel({ patientId }: { patientId: string }) {
  const { data: wallet, isLoading: walletLoading } = usePatientWallet(patientId);
  const { data: txData, isLoading: txLoading } = useWalletTransactions(patientId);
  const deposit = useDepositWallet();
  const withdraw = useWithdrawWallet();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleDeposit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) { toast.error('Enter a valid positive amount'); return; }
    await deposit.mutateAsync({ id: patientId, amount: num, notes: notes || undefined });
    toast.success(`Le ${num.toLocaleString()} deposited`);
    setDepositOpen(false); setAmount(''); setNotes('');
  };

  const handleWithdraw = async () => {
    const num = Number(amount);
    if (!num || num <= 0) { toast.error('Enter a valid positive amount'); return; }
    if (wallet && num > (wallet.balance || 0)) { toast.error('Insufficient balance'); return; }
    await withdraw.mutateAsync({ id: patientId, amount: num, notes: notes || undefined });
    toast.success(`Le ${num.toLocaleString()} withdrawn`);
    setWithdrawOpen(false); setAmount(''); setNotes('');
  };

  if (walletLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const transactions = txData?.data || txData || [];
  const txTotal = txData?.total || (Array.isArray(transactions) ? transactions.length : 0);

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p className="text-3xl font-bold">Le {(wallet?.balance || 0).toLocaleString()}</p>
              {wallet?.lastUpdated && (
                <p className="text-xs text-muted-foreground">Last updated: {format(new Date(wallet.lastUpdated), 'MMM dd, yyyy HH:mm')}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
              <DialogTrigger asChild>
                <Button><ArrowDownToLine className="w-4 h-4 mr-2" />Deposit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Deposit to Wallet</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Amount (Le)</Label>
                    <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" />
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Cash deposit at reception" />
                  </div>
                  <Button onClick={handleDeposit} className="w-full" disabled={deposit.isPending}>
                    {deposit.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Deposit Le {Number(amount || 0).toLocaleString()}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><ArrowUpFromLine className="w-4 h-4 mr-2" />Withdraw</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Withdraw from Wallet</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Amount (Le)</Label>
                    <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" />
                    {wallet && <p className="text-xs text-muted-foreground mt-1">Available: Le {wallet.balance.toLocaleString()}</p>}
                  </div>
                  <div>
                    <Label>Reason (optional)</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Payment refund" />
                  </div>
                  <Button onClick={handleWithdraw} className="w-full" variant="destructive" disabled={withdraw.isPending}>
                    {withdraw.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Withdraw Le {Number(amount || 0).toLocaleString()}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-card border rounded-lg">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Transaction History ({txTotal})</h3>
        </div>
        {txLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : !Array.isArray(transactions) || transactions.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance Before</th>
                  <th>Balance After</th>
                  <th>Notes</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx._id || tx.id}>
                    <td className="text-xs">{format(new Date(tx.createdAt), 'MMM dd, HH:mm')}</td>
                    <td>
                      <Badge variant={
                        tx.type === 'deposit' || tx.type === 'refund' ? 'default' :
                        tx.type === 'withdrawal' || tx.type === 'payment' ? 'destructive' :
                        'outline'
                      }>
                        {tx.type}
                      </Badge>
                    </td>
                    <td className={tx.type === 'deposit' || tx.type === 'refund' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {tx.type === 'deposit' || tx.type === 'refund' ? '+' : '-'}Le {Math.abs(tx.amount).toLocaleString()}
                    </td>
                    <td className="font-mono text-sm">Le {tx.balanceBefore?.toLocaleString() || '-'}</td>
                    <td className="font-mono text-sm">Le {tx.balanceAfter?.toLocaleString() || '-'}</td>
                    <td className="text-sm text-muted-foreground max-w-[200px] truncate">{tx.notes || '-'}</td>
                    <td className="text-sm">{tx.performedBy?.fullName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

