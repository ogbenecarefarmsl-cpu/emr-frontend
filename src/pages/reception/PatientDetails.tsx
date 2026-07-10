import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePatient, usePatientResults, useUpdatePatient, usePatientWallet, useWalletTransactions, useDepositWallet, useWithdrawWallet } from '@/hooks/usePatients';
import { useOrders } from '@/hooks/useOrders';
import { paymentsAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit, Eye, Loader2, Save, X, Wallet, ArrowDownToLine, ArrowUpFromLine,
  Clock, User, FileText, FlaskConical, ShoppingCart, Calendar, AlertTriangle, Phone, Mail, MapPin, Hash, CreditCard
} from 'lucide-react';
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
  allergies?: string[];
  bloodType?: string;
}

const convertAgeToYears = (ageValue: number, ageUnit: AgeUnit): number => {
  switch (ageUnit) {
    case 'months': return Number((ageValue / 12).toFixed(2));
    case 'weeks': return Number((ageValue / 52.1429).toFixed(2));
    case 'days': return Number((ageValue / 365.25).toFixed(2));
    default: return ageValue;
  }
};

const getField = <T,>(record: any, keys: string[], fallback: T): T => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null) return value as T;
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
    allergies: getField<string[] | undefined>(patient, ['allergies'], undefined),
    bloodType: getField<string | undefined>(patient, ['bloodType', 'blood_type'], undefined),
  };
};

const resolveOrderPatientId = (order: any): string | undefined => {
  const candidates = [
    typeof order?.patientId === 'string' ? order.patientId : undefined,
    typeof order?.patientId === 'object' ? order.patientId?.id || order.patientId?._id : undefined,
    order?.patient?.id, order?.patient?._id, order?.patients?.id, order?.patients?._id, order?.patient_id,
  ];
  return candidates.find((c) => typeof c === 'string');
};

const getOrderId = (order: any): string | undefined => order?.id || order?._id;
const getOrderNumber = (order: any): string => order?.orderNumber || order?.order_number || '-';
const getOrderDate = (order: any): string | undefined => order?.createdAt || order?.created_at;
const getResultDate = (result: any): string | undefined => result?.resultedAt || result?.createdAt;

const formatDateSafe = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : format(parsed, 'MMM dd, yyyy');
};

const formatDateTimeSafe = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : format(parsed, 'MMM dd, yyyy HH:mm');
};

const flagLabel = (flag?: string): string => (!flag ? 'normal' : flag.replace(/_/g, ' '));

const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
};

const statusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
    case 'awaiting_payment': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'paid': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending_collection': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'collected': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'processing': return 'bg-orange-50 text-orange-700 border-orange-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
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
  const { data: wallet } = usePatientWallet(id || '');
  const updatePatient = useUpdatePatient();

  const { data: patientPayments = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ['payments', 'patient', id],
    queryFn: () => paymentsAPI.findByPatient(id || ''),
    enabled: !!id,
    staleTime: 30_000,
  });

  const normalizedPatient = useMemo(() => {
    if (!patient) return null;
    return normalizePatient(patient);
  }, [patient]);

  const patientOrders = useMemo(() => {
    if (!id || !orders) return [];
    return orders.filter((order) => resolveOrderPatientId(order) === id);
  }, [id, orders]);

  const totalSpent = useMemo(() => {
    return patientOrders.reduce((sum, o) => sum + Number(o.total || o.totalAmount || 0), 0);
  }, [patientOrders]);

  const lastOrderDate = useMemo(() => {
    if (patientOrders.length === 0) return null;
    const sorted = [...patientOrders].sort((a, b) => {
      const da = new Date(getOrderDate(a) || 0).getTime();
      const db = new Date(getOrderDate(b) || 0).getTime();
      return db - da;
    });
    return getOrderDate(sorted[0]);
  }, [patientOrders]);

  const groupedResultsByDate = useMemo(() => {
    const map = new Map<string, typeof patientResults>();
    for (const result of patientResults || []) {
      const rawDate = getResultDate(result);
      const date = rawDate ? new Date(rawDate) : null;
      const key = date && !Number.isNaN(date.getTime()) ? format(date, 'yyyy-MM-dd') : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(result);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : b.localeCompare(a)))
      .map(([dateKey, results]) => ({
        dateKey,
        displayDate: dateKey === 'unknown' ? 'Unknown Date' : format(new Date(`${dateKey}T00:00:00`), 'EEEE, MMM dd, yyyy'),
        results: [...results].sort((a, b) => new Date(getResultDate(b) || 0).getTime() - new Date(getResultDate(a) || 0).getTime()),
      }));
  }, [patientResults]);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormState>({
    firstName: '', lastName: '', ageValue: '', ageUnit: 'years', gender: 'M', phone: '', email: '', address: '',
  });

  const handleEdit = () => {
    if (!normalizedPatient) return;
    setFormData({
      firstName: normalizedPatient.firstName, lastName: normalizedPatient.lastName,
      ageValue: String(normalizedPatient.ageValue || normalizedPatient.age || ''),
      ageUnit: normalizedPatient.ageUnit, gender: normalizedPatient.gender,
      phone: normalizedPatient.phone || '', email: normalizedPatient.email || '', address: normalizedPatient.address || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!id) return;
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.ageValue.trim()) {
      toast.error('First name, last name, and age are required'); return;
    }
    const ageValueNumber = Number(formData.ageValue);
    if (Number.isNaN(ageValueNumber) || ageValueNumber < 0) {
      toast.error('Please enter a valid age value'); return;
    }
    try {
      await updatePatient.mutateAsync({
        id, updates: {
          firstName: formData.firstName.trim(), lastName: formData.lastName.trim(),
          age: convertAgeToYears(ageValueNumber, formData.ageUnit), ageValue: ageValueNumber,
          ageUnit: formData.ageUnit, gender: formData.gender,
          phone: formData.phone.trim() || undefined, email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
        },
      });
      toast.success('Patient details updated');
      setIsEditing(false);
    } catch { toast.error('Failed to update patient details'); }
  };

  const getReportPath = (orderId: string) =>
    currentRole === 'lab_tech' ? `/lab/reports/${orderId}` : `/reception/reports/${orderId}`;

  const openOrderReport = (orderId?: string) => {
    if (!orderId) { toast.error('No report found for this entry'); return; }
    navigate(getReportPath(orderId));
  };

  const goBackPath = currentRole === 'lab_tech' ? '/lab/patients' : currentRole === 'admin' ? '/admin/patients' : '/reception/patients';

  if (isLoading) {
    return (
      <RoleLayout title="Patient Details" subtitle="Loading..." role={currentRole} userName={profile?.fullName}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </RoleLayout>
    );
  }

  if (!normalizedPatient) {
    return (
      <RoleLayout title="Patient Not Found" subtitle="" role={currentRole} userName={profile?.fullName}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Patient not found</p>
          <Button variant="outline" onClick={() => navigate(goBackPath)}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Patients
          </Button>
        </div>
      </RoleLayout>
    );
  }

  const initials = getInitials(normalizedPatient.firstName, normalizedPatient.lastName);
  const fullName = getPatientFullName(normalizedPatient as any);

  return (
    <RoleLayout title={fullName} subtitle={normalizedPatient.patientId} role={currentRole} userName={profile?.fullName}>
      {/* Back button */}
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate(goBackPath)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" />Back to Patients
      </Button>

      {/* Patient Header Card */}
      <div className="bg-card border rounded-xl overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xl font-bold text-primary">{initials}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold tracking-tight">{fullName}</h2>
                <Badge variant="outline" className="font-mono text-xs">{normalizedPatient.patientId}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {normalizedPatient.gender === 'M' ? 'Male' : normalizedPatient.gender === 'F' ? 'Female' : 'Other'}
                </span>
                <span>{getPatientAgeDisplay(normalizedPatient as any)}</span>
                {normalizedPatient.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{normalizedPatient.phone}</span>
                )}
                {normalizedPatient.email && (
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{normalizedPatient.email}</span>
                )}
              </div>
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {normalizedPatient.bloodType && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-red-50 text-red-700 border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{normalizedPatient.bloodType}
                  </Badge>
                )}
                {normalizedPatient.allergies && normalizedPatient.allergies.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" />Allergies: {normalizedPatient.allergies.join(', ')}
                  </Badge>
                )}
                {normalizedPatient.mrn && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Hash className="w-3 h-3" />MRN: {normalizedPatient.mrn}
                  </Badge>
                )}
                {normalizedPatient.address && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <MapPin className="w-3 h-3" />{normalizedPatient.address}
                  </Badge>
                )}
              </div>
            </div>
            {/* Edit button */}
            {canEditPatient && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleEdit} className="shrink-0">
                <Edit className="w-4 h-4 mr-1.5" />Edit
              </Button>
            )}
            {canEditPatient && isEditing && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-1.5" />Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updatePatient.isPending}>
                  {updatePatient.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  <Save className="w-4 h-4 mr-1.5" />Save
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-t">
          {[
            { label: 'Total Orders', value: patientOrders.length, icon: ShoppingCart, color: 'text-blue-600' },
            { label: 'Total Spent', value: `Le ${totalSpent.toLocaleString()}`, icon: Wallet, color: 'text-emerald-600' },
            { label: 'Wallet Balance', value: `Le ${Number(wallet?.balance || 0).toLocaleString()}`, icon: Wallet, color: 'text-purple-600' },
            { label: 'Last Visit', value: lastOrderDate ? formatDateSafe(lastOrderDate) : 'Never', icon: Calendar, color: 'text-amber-600' },
          ].map((stat, i) => (
            <div key={stat.label} className={`px-5 py-4 ${i < 3 ? 'border-r' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold mt-0.5">{stat.value}</p>
                </div>
                <stat.icon className={`w-5 h-5 ${stat.color} opacity-60`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Form (inline) */}
      {isEditing && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-4">Edit Patient Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name</Label>
                <Input value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Age</Label>
                <Input type="number" min="0" value={formData.ageValue} onChange={(e) => setFormData(prev => ({ ...prev, ageValue: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Age Unit</Label>
                <Select value={formData.ageUnit} onValueChange={(v) => setFormData(prev => ({ ...prev, ageUnit: v as AgeUnit }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="years">Years</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v as 'M' | 'F' | 'O' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="O">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="bg-transparent h-auto p-0 min-w-max border-b mb-0">
          <TabsTrigger value="orders" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
            Orders <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">{patientOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
            Results <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">{patientResults?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="wallet" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
            Wallet
          </TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
            Notes
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5">
            Billing <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">{patientPayments.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          {patientOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShoppingCart className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">No orders yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Orders will appear here once created</p>
            </div>
          ) : (
            <div className="space-y-3">
              {patientOrders.map((order) => {
                const orderId = getOrderId(order);
                const orderTests = order.tests || order.order_tests || [];
                const status = String(order.status || '-');
                return (
                  <div key={orderId || getOrderNumber(order)} className="bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{getOrderNumber(order)}</p>
                          <Badge variant="outline" className={`text-[10px] capitalize ${statusColor(status)}`}>
                            {status.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {order.orderType || order.order_type || 'lab'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateSafe(getOrderDate(order))}</p>
                        {orderTests.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {orderTests.slice(0, 6).map((t: any, i: number) => (
                              <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                                {t.testName || t.test_name || t.testCode || t.test_code}
                              </Badge>
                            ))}
                            {orderTests.length > 6 && (
                              <Badge variant="secondary" className="text-[10px]">+{orderTests.length - 6} more</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">Le {Number(order.total || order.totalAmount || 0).toLocaleString()}</p>
                        <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => openOrderReport(orderId)}>
                          <Eye className="w-3.5 h-3.5 mr-1" />Report
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Result History Tab */}
        <TabsContent value="history" className="mt-4">
          {isLoadingResults ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedResultsByDate.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <FlaskConical className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">No results yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Test results will appear here once available</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {groupedResultsByDate.map((group) => (
                <AccordionItem key={group.dateKey} value={group.dateKey} className="bg-card border rounded-xl overflow-hidden">
                  <AccordionTrigger className="hover:no-underline px-5 py-4">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="text-left">
                        <p className="font-semibold text-sm">{group.displayDate}</p>
                        <p className="text-xs text-muted-foreground">{group.results.length} result(s)</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Time</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Test</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Result</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Flag</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Order</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.results.map((result: any, index: number) => (
                            <tr key={result.id || `${result.testCode}-${index}`} className="hover:bg-muted/30">
                              <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTimeSafe(getResultDate(result))}</td>
                              <td className="px-3 py-2">
                                <p className="font-medium">{result.testName || result.testCode || '-'}</p>
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-semibold">{result.value}</span>
                                {result.unit && <span className="text-muted-foreground ml-1 text-xs">{result.unit}</span>}
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={result.flag && result.flag !== 'normal' ? 'destructive' : 'outline'} className="text-[10px] capitalize">
                                  {flagLabel(result.flag)}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{result.orderNumber || '-'}</td>
                              <td className="px-3 py-2">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openOrderReport(result.orderId)} disabled={!result.orderId}>
                                  <Eye className="w-3.5 h-3.5 mr-1" />View
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
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet" className="mt-4">
          <WalletPanel patientId={id || ''} />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <div className="bg-card border rounded-xl p-5">
            <PatientNotesPanel patientId={id || ''} />
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardContent className="p-5">
              {isLoadingPayments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : patientPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No payment records yet
                </div>
              ) : (
                <div className="space-y-3">
                  {patientPayments.map((payment: any) => (
                    <div key={payment._id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] capitalize bg-green-50 text-green-700">
                            {payment.paymentMethod?.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {payment.paymentType}
                          </Badge>
                          {payment.orderId && (
                            <span className="text-xs text-muted-foreground">Order: {payment.orderId.orderNumber || '-'}</span>
                          )}
                          {payment.treatmentPlanId && (
                            <span className="text-xs text-muted-foreground">Plan: {payment.treatmentPlanId.planNumber || '-'}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTimeSafe(payment.createdAt)}</p>
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">{payment.notes}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-green-700">Le {payment.amount.toLocaleString()}</p>
                        {payment.receivedBy && (
                          <p className="text-[10px] text-muted-foreground">by {payment.receivedBy.fullName || '-'}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3 flex justify-between font-semibold text-sm">
                    <span>Total Payments:</span>
                    <span className="text-green-700">Le {patientPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
  const [depositMethod, setDepositMethod] = useState('cash');

  const handleDeposit = async () => {
    const num = Number(amount);
    if (!num || num <= 0) { toast.error('Enter a valid positive amount'); return; }
    const result = await deposit.mutateAsync({ id: patientId, amount: num, notes: notes || undefined, paymentMethod: depositMethod });
    const applied = Number(result?.autoAppliedAmount || 0);
    toast.success(
      applied > 0
        ? `Le ${num.toLocaleString()} deposited; Le ${applied.toLocaleString()} auto-applied to outstanding bills`
        : `Le ${num.toLocaleString()} deposited`,
    );
    setDepositOpen(false); setAmount(''); setNotes(''); setDepositMethod('cash');
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
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="bg-card border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Wallet Balance</p>
              <p className="text-3xl font-bold">Le {(wallet?.balance || 0).toLocaleString()}</p>
              {wallet?.lastUpdated && (
                <p className="text-xs text-muted-foreground mt-0.5">Updated {format(new Date(wallet.lastUpdated), 'MMM dd, yyyy HH:mm')}</p>
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
                    <Label>Payment Method</Label>
                    <Select value={depositMethod} onValueChange={setDepositMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="orange_money">Orange Money</SelectItem>
                        <SelectItem value="afrimoney">Afrimoney</SelectItem>
                      </SelectContent>
                    </Select>
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
      <div className="bg-card border rounded-xl">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Transaction History</h3>
          <Badge variant="secondary" className="ml-auto h-5 text-[10px]">{txTotal}</Badge>
        </div>
        {txLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : !Array.isArray(transactions) || transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Method</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Notes</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx: any) => (
                  <tr key={tx._id || tx.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-xs">{format(new Date(tx.createdAt), 'MMM dd, HH:mm')}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={
                        tx.type === 'deposit' || tx.type === 'refund' ? 'default' :
                        tx.type === 'withdrawal' || tx.type === 'payment' ? 'destructive' : 'outline'
                      } className="text-[10px] capitalize">{tx.type}</Badge>
                    </td>
                    <td className={`px-4 py-2.5 font-semibold ${tx.type === 'deposit' || tx.type === 'refund' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.type === 'deposit' || tx.type === 'refund' ? '+' : '-'}Le {Math.abs(tx.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">Le {tx.balanceAfter?.toLocaleString() || '-'}</td>
                    <td className="px-4 py-2.5 text-xs capitalize">{tx.paymentMethod?.replace(/_/g, ' ') || '-'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{tx.notes || '-'}</td>
                    <td className="px-4 py-2.5 text-xs">{tx.performedBy?.fullName || '-'}</td>
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
