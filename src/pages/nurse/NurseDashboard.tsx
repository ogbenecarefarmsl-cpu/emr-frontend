import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAwaitingTriage } from '@/hooks/useVisits';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';
import { prescriptionService } from '@/services/prescriptionService';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InsuranceStatusBadge } from '@/components/insurance/InsuranceStatusBadge';
import { cn } from '@/lib/utils';

// Nurse Modals & Utilities
import { TriageDialog } from '@/components/nurse/TriageDialog';
import { RapidTestResultDialog } from '@/components/nurse/RapidTestResultDialog';
import { MarDialog } from '@/components/nurse/MarDialog';
import { DoctorLabOrderModal, TestItem } from '@/components/doctor/modals/DoctorLabOrderModal';
import { DoctorPrescriptionModal, PrescriptionModalItem } from '@/components/doctor/modals/DoctorPrescriptionModal';
import { patientName } from '@/components/nurse/nurseUtils';
import { ordersAPI } from '@/services/api';
import { medicationService } from '@/services/medicationService';

// Icons
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FlaskConical,
  HeartPulse,
  Pill,
  Plus,
  Search,
  ShieldAlert,
  Stethoscope,
  TestTube,
  User,
  Users,
  Zap,
  Droplet,
} from 'lucide-react';

const ESI_PRIORITY_RANK: Record<string, number> = {
  emergency: 0,
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

const SERVICE_META: Record<string, { label: string; tone: string }> = {
  normal_consultation: { label: 'Consultation', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
  specialist_consultation: { label: 'Specialist', tone: 'border-purple-200 bg-purple-50 text-purple-700' },
  observation_4h: { label: 'Observation', tone: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  procedure: { label: 'Procedure', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
};

export default function NurseDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Queries
  const { data: triageQueue = [], isLoading: triageLoading } = useAwaitingTriage();
  const { data: dashboard, isLoading: admissionsLoading } = useAdmissionsDashboard(false);
  const { data: marWorklist = [], isLoading: marLoading } = useQuery({
    queryKey: ['prescriptions', 'mar-worklist'],
    queryFn: () => prescriptionService.getMarWorklist(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // LIS Catalog & Pharmacy Queries
  const {
    data: lisCatalog = [],
    isLoading: lisLoading,
    isError: lisError,
    error: lisLoadError,
  } = useQuery({
    queryKey: ['orders', 'lis-catalog'],
    queryFn: () => ordersAPI.getLisCatalog(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: medications = [],
    isLoading: medicationsLoading,
  } = useQuery({
    queryKey: ['medications', 'nurse-order-list'],
    queryFn: () => medicationService.findAll(),
    staleTime: 60 * 1000,
  });

  // Modal states
  const [triageVisit, setTriageVisit] = useState<any>(null);
  const [triageOpen, setTriageOpen] = useState(false);
  const [rapidVisit, setRapidVisit] = useState<any>(null);
  const [rapidOpen, setRapidOpen] = useState(false);
  const [marPrescription, setMarPrescription] = useState<any>(null);
  const [marOpen, setMarOpen] = useState(false);

  // Bedside Lab Order Modal state
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [labVisit, setLabVisit] = useState<any>(null);
  const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
  const [isSubmittingLab, setIsSubmittingLab] = useState(false);

  // Bedside Medication Order Modal state
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [rxVisit, setRxVisit] = useState<any>(null);
  const [rxItems, setRxItems] = useState<PrescriptionModalItem[]>([]);
  const [isSubmittingRx, setIsSubmittingRx] = useState(false);

  // Search & filter
  const [searchQueue, setSearchQueue] = useState('');

  const activeAdmissions = dashboard?.activeAdmissions || [];
  const stats = dashboard?.stats || { activeTotal: 0, todayAdmissions: 0, todayDischarges: 0, byWard: [] };

  // Emergency ESI 1/2 tracking & persistent banner
  const urgentPatients = useMemo(() => {
    return triageQueue.filter((v: any) => {
      const p = (v.triagePriority || '').toLowerCase();
      return p === 'emergency' || p === 'urgent';
    });
  }, [triageQueue]);

  // Audio / toast alert on incoming critical patients
  const lastSeenCriticalIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!triageQueue.length) return;
    const currentCritical = urgentPatients.filter((v: any) => !lastSeenCriticalIds.current.has(v._id));
    if (currentCritical.length > 0) {
      toast.warning(`${currentCritical.length} critical patient${currentCritical.length === 1 ? '' : 's'} awaiting urgent triage`, {
        description: currentCritical.map((v: any) => `${patientName(v.patientId)} (${v.triagePriority})`).join(', '),
        duration: 9000,
        icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
      });
    }
    lastSeenCriticalIds.current = new Set(urgentPatients.map((v: any) => v._id));
  }, [urgentPatients, triageQueue.length]);

  // Sorted and filtered triage queue
  const sortedTriageQueue = useMemo(() => {
    const list = [...triageQueue].sort((a: any, b: any) => {
      const rankA = ESI_PRIORITY_RANK[(a.triagePriority || '').toLowerCase()] ?? 2;
      const rankB = ESI_PRIORITY_RANK[(b.triagePriority || '').toLowerCase()] ?? 2;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    if (!searchQueue.trim()) return list;
    const q = searchQueue.toLowerCase();
    return list.filter((v: any) =>
      patientName(v.patientId).toLowerCase().includes(q) ||
      (v.visitNumber || '').toLowerCase().includes(q) ||
      (v.patientId?.patientId || '').toLowerCase().includes(q) ||
      (v.chiefComplaint || '').toLowerCase().includes(q)
    );
  }, [triageQueue, searchQueue]);

  // MAR Due Now calculations
  const dueNowMeds = useMemo(() => {
    if (!Array.isArray(marWorklist)) return [];
    return marWorklist.filter(
      (rx: any) => rx.status !== 'completed' && rx.nextDueAt && new Date(rx.nextDueAt) <= new Date()
    );
  }, [marWorklist]);

  // Inpatients with abnormal vitals radar
  const abnormalInpatients = useMemo(() => {
    const alerts: Array<{ admission: any; vital: string; value: string | number; isCritical: boolean }> = [];
    for (const adm of activeAdmissions) {
      const log = adm.vitalsLog || [];
      const latest = log[log.length - 1];
      if (!latest) continue;
      if (latest.oxygenSaturation != null && latest.oxygenSaturation < 92) {
        alerts.push({ admission: adm, vital: 'SpO2', value: `${latest.oxygenSaturation}%`, isCritical: true });
      } else if (latest.temperature != null && latest.temperature >= 39.5) {
        alerts.push({ admission: adm, vital: 'Temp', value: `${latest.temperature}°C`, isCritical: true });
      } else if (latest.heartRate != null && (latest.heartRate > 130 || latest.heartRate < 45)) {
        alerts.push({ admission: adm, vital: 'HR', value: `${latest.heartRate} bpm`, isCritical: true });
      } else if (latest.respiratoryRate != null && (latest.respiratoryRate > 30 || latest.respiratoryRate < 8)) {
        alerts.push({ admission: adm, vital: 'RR', value: `${latest.respiratoryRate}/min`, isCritical: true });
      }
    }
    return alerts;
  }, [activeAdmissions]);

  const openTriageModal = (visit: any) => {
    setTriageVisit(visit);
    setTriageOpen(true);
  };

  const openRapidTestModal = (visit: any) => {
    setRapidVisit(visit);
    setRapidOpen(true);
  };

  const openMarModal = (rx: any) => {
    setMarPrescription(rx);
    setMarOpen(true);
  };

  const openLabModal = (visit: any) => {
    setLabVisit(visit);
    setSelectedTests([]);
    setLabModalOpen(true);
  };

  const openRxModal = (visit: any) => {
    setRxVisit(visit);
    setRxItems([]);
    setRxModalOpen(true);
  };

  const handleAddLabTest = (test: TestItem) => {
    if (selectedTests.some((t) => t._id === test._id || t.code === test.code)) {
      toast.info('Test already added');
      return;
    }
    setSelectedTests((prev) => [...prev, test]);
  };

  const handleRemoveLabTest = (testId: string) => {
    setSelectedTests((prev) => prev.filter((t) => t._id !== testId && t.code !== testId));
  };

  const handleLabSubmit = async () => {
    if (!labVisit) return;
    const pId = labVisit.patientId?._id || labVisit.patientId;
    if (!pId) {
      toast.error('Patient record missing from visit');
      return;
    }
    if (selectedTests.length === 0) {
      toast.error('Please select at least one test');
      return;
    }

    setIsSubmittingLab(true);
    try {
      await ordersAPI.create({
        patientId: typeof pId === 'object' ? pId._id : pId,
        visitId: labVisit._id || labVisit.id,
        orderType: 'lab',
        priority: 'routine',
        tests: selectedTests.map((t) => ({
          testId: t._id || t.code,
          testCode: t.code,
          testName: t.name,
          price: Number(t.price || 0),
          panelCode: t.isPanel ? t.code : undefined,
          panelName: t.isPanel ? t.name : undefined,
        })),
      });
      toast.success(`${selectedTests.length} lab test(s) ordered for ${patientName(labVisit.patientId)}`);
      setLabModalOpen(false);
      setSelectedTests([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create lab order');
    } finally {
      setIsSubmittingLab(false);
    }
  };

  const handleSelectMedication = (med: any) => {
    if (rxItems.some((i) => i.medicationId === med._id)) {
      toast.info('Medication already added');
      return;
    }
    const defaultDose = med.strength || '1 tablet';
    setRxItems((prev) => [
      ...prev,
      {
        medicationId: med._id,
        medicationName: med.name,
        dosage: defaultDose,
        strengthPerDose: defaultDose,
        frequency: 'BID',
        dosesPerDay: 2,
        duration: '5 days',
        durationDays: 5,
        route: med.dosageForm === 'injection' ? 'intravenous' : 'oral',
        unitPrice: med.unitPrice || 0,
        quantity: 10,
        computedQuantity: 10,
        isControlled: med.isControlled,
        requiresPrescription: med.requiresPrescription,
        baseUnit: med.unit,
        sellMode: med.sellMode,
      },
    ]);
  };

  const handleUpdateRxItem = (index: number, field: string, value: any) => {
    setRxItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      next[index] = item;
      return next;
    });
  };

  const handleRemoveRxItem = (index: number) => {
    setRxItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRxSubmit = async () => {
    if (!rxVisit) return;
    const pId = rxVisit.patientId?._id || rxVisit.patientId;
    if (!pId) {
      toast.error('Patient record missing from visit');
      return;
    }
    if (rxItems.length === 0) {
      toast.error('Please add at least one medication');
      return;
    }

    setIsSubmittingRx(true);
    try {
      await prescriptionService.create({
        patientId: typeof pId === 'object' ? pId._id : pId,
        visitId: rxVisit._id || rxVisit.id,
        items: rxItems.map((item) => ({
          medicationId: item.medicationId,
          medicationName: item.medicationName,
          dosage: item.dosage || '1 dose',
          strengthPerDose: item.strengthPerDose,
          frequency: item.frequency || 'BID',
          dosesPerDay: item.dosesPerDay || 2,
          duration: item.duration || '5 days',
          durationDays: item.durationDays || 5,
          route: item.route as any || 'oral',
          quantity: item.quantity || 1,
          instructions: item.instructions,
        })),
      });
      toast.success(`Prescription ordered for ${patientName(rxVisit.patientId)}`);
      setRxModalOpen(false);
      setRxItems([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create prescription');
    } finally {
      setIsSubmittingRx(false);
    }
  };

  return (
    <RoleLayout
      title="Nurse Station Workbench"
      subtitle="Arriving vitals triage, inpatient medication rounds, and ward monitoring"
      role="nurse"
      userName={profile?.fullName}
    >
      <div className="space-y-4">
        {/* 1. Top Nurse Station Pulse Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 flex-1">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border",
                triageQueue.length > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-500"
              )}>
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{triageQueue.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Awaiting Vitals</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border",
                dueNowMeds.length > 0 ? "bg-red-50 border-red-200 text-red-700 animate-pulse" : "bg-slate-50 border-slate-200 text-slate-500"
              )}>
                <Pill className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{dueNowMeds.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Meds Due Now</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                <BedDouble className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{activeAdmissions.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Ward Inpatients {stats.byWard?.find((w: any) => w._id === 'icu')?.count ? `(${stats.byWard?.find((w: any) => w._id === 'icu')?.count} in ICU)` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border",
                abnormalInpatients.length > 0 ? "bg-red-50 border-red-200 text-red-700 animate-pulse" : "bg-slate-50 border-slate-200 text-slate-500"
              )}>
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 leading-none">{abnormalInpatients.length}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Vitals Alerts</p>
              </div>
            </div>
          </div>

          {/* Quick Workspaces Pill Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/nurse/admissions')}
              className="h-8 text-xs font-medium bg-white text-slate-700 hover:text-blue-700 hover:border-blue-300 gap-1.5 shrink-0"
            >
              <BedDouble className="h-3.5 w-3.5 text-blue-600" />
              <span>Ward Board</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/nurse/mar')}
              className="h-8 text-xs font-medium bg-white text-slate-700 hover:text-emerald-700 hover:border-emerald-300 gap-1.5 shrink-0"
            >
              <Pill className="h-3.5 w-3.5 text-emerald-600" />
              <span>Full MAR</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/nurse/lab-requests')}
              className="h-8 text-xs font-medium bg-white text-slate-700 hover:text-teal-700 hover:border-teal-300 gap-1.5 shrink-0"
            >
              <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
              <span>Order Lab</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/nurse/prescriptions')}
              className="h-8 text-xs font-medium bg-white text-slate-700 hover:text-indigo-700 hover:border-indigo-300 gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-600" />
              <span>Bedside Med</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/nurse/observation')}
              className="h-8 text-xs font-medium bg-white text-slate-700 hover:text-rose-700 hover:border-rose-300 gap-1.5 shrink-0"
            >
              <HeartPulse className="h-3.5 w-3.5 text-rose-600" />
              <span>Observation</span>
            </Button>
          </div>
        </div>

        {/* 2. Persistent Emergency Triage Callout Banner (if any) */}
        {urgentPatients.length > 0 && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
                <span>Urgent Emergency Attention Required ({urgentPatients.length})</span>
              </div>
              <span className="text-xs text-red-700 font-medium hidden sm:inline">
                Triage immediately before standard queue
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {urgentPatients.map((visit: any) => (
                <div
                  key={visit._id}
                  className="bg-white rounded-lg border border-red-200 p-3 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-950 truncate">{patientName(visit.patientId)}</p>
                    <p className="text-xs text-red-700 font-medium truncate mt-0.5">
                      {visit.chiefComplaint || 'Emergency triage flagged'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openTriageModal(visit)}
                    className="h-8 text-xs font-medium shrink-0 gap-1"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Triage Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Main Workbench Split Layout (60% Triage Queue / 40% Inpatient & MAR Radar) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT 60% (Col span 7): Live Triage Worklist */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Patients Awaiting Vitals ({triageQueue.length})</span>
              </div>

              {/* Quick Filter Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={searchQueue}
                  onChange={(e) => setSearchQueue(e.target.value)}
                  placeholder="Filter name, PID, complaint..."
                  className="h-8 pl-8 text-xs bg-slate-50/70"
                />
              </div>
            </div>

            {triageLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                <Activity className="h-6 w-6 animate-spin text-teal-600" />
                <span>Loading triage queue...</span>
              </div>
            ) : sortedTriageQueue.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-slate-700">All Caught Up</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No patients waiting for vitals. Newly registered patients from reception will appear here immediately.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedTriageQueue.map((visit: any) => {
                  const patient = visit.patientId;
                  const serviceMeta = visit.serviceType ? SERVICE_META[visit.serviceType] : null;
                  const hasRdtResult = (visit.rapidTestResults || []).length > 0;
                  const isRdtRequested = visit.rapidTestsRequested && visit.rapidTestsRequested.length > 0;
                  const allergies = patient?.allergies || [];

                  return (
                    <div
                      key={visit._id}
                      className="py-3.5 px-2 hover:bg-slate-50/80 rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-slate-950 truncate">
                            {patientName(patient)}
                          </p>
                          <span className="text-xs text-slate-500 font-medium">
                            {patient?.age ? `${patient.age}y` : ''} {patient?.gender ? `· ${patient.gender[0].toUpperCase()}` : ''}
                          </span>
                          {serviceMeta && (
                            <Badge variant="outline" className={cn("text-[9px] h-4.5 px-1.5 uppercase font-medium", serviceMeta.tone)}>
                              {serviceMeta.label}
                            </Badge>
                          )}
                          <InsuranceStatusBadge
                            insurance={visit.insurance}
                            coverageType={visit.consultationCoverageType}
                            compact
                            className="h-4 px-1 py-0 text-[9px]"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span>{visit.visitNumber}</span>
                          <span>·</span>
                          <span>{patient?.patientId || 'PID N/A'}</span>
                          {visit.createdAt && (
                            <>
                              <span>·</span>
                              <span className="text-slate-400 font-sans">
                                Arrived {new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>

                        {visit.chiefComplaint && (
                          <p className="text-xs text-slate-700 italic truncate max-w-lg">
                            "{visit.chiefComplaint}"
                          </p>
                        )}

                        {allergies.length > 0 && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.2 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Allergies: {allergies.join(', ')}</span>
                          </div>
                        )}

                        {isRdtRequested && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <Badge variant="outline" className="text-[10px] h-4.5 bg-amber-50 text-amber-700 border-amber-200">
                              RDT Requested: {visit.rapidTestsRequested.join(', ')}
                            </Badge>
                            {hasRdtResult && (
                              <Badge className="text-[10px] h-4.5 bg-emerald-600 text-white gap-1">
                                <Check className="h-3 w-3" /> Result Recorded
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                        {isRdtRequested && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRapidTestModal(visit)}
                            className="h-8 px-2 text-xs font-medium border-slate-300 text-slate-700 hover:bg-slate-100 gap-1"
                            title="Record Bedside Rapid Diagnostic Test"
                          >
                            <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                            <span>{hasRdtResult ? 'Edit RDT' : 'Enter RDT'}</span>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openLabModal(visit)}
                          className="h-8 px-2 text-xs font-medium border-slate-200 text-teal-700 hover:bg-teal-50 gap-1"
                          title="Order Diagnostic Tests from LIS Catalog"
                        >
                          <FlaskConical className="h-3.5 w-3.5 text-teal-600" />
                          <span className="hidden sm:inline">Lab Order</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRxModal(visit)}
                          className="h-8 px-2 text-xs font-medium border-slate-200 text-indigo-700 hover:bg-indigo-50 gap-1"
                          title="Prescribe Inpatient / Bedside Medication"
                        >
                          <Pill className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="hidden sm:inline">Prescribe</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => openTriageModal(visit)}
                          className="h-8 px-3 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white gap-1.5 shadow-2xs"
                        >
                          <Stethoscope className="h-3.5 w-3.5" />
                          <span>Take Vitals</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 40% (Col span 5): Inpatient & Medication Radar */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card 1: Medication Administration Rounds (Due Now) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                  <Pill className="h-4 w-4 text-emerald-600" />
                  <span>Medication Rounds (Due Now)</span>
                </div>
                <Badge variant={dueNowMeds.length > 0 ? 'destructive' : 'outline'} className="text-xs">
                  {dueNowMeds.length} Due
                </Badge>
              </div>

              {dueNowMeds.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs space-y-1">
                  <Clock className="h-5 w-5 text-slate-300 mx-auto" />
                  <p className="font-medium text-slate-600">No medication doses due now</p>
                  <p className="text-[11px] text-slate-400">Next scheduled round will appear here automatically.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dueNowMeds.slice(0, 5).map((rx: any) => {
                    const patient = rx.patientId;
                    const firstItem = rx.items?.[0];
                    return (
                      <div
                        key={rx._id || rx.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-slate-900 truncate">
                            {patientName(patient)}
                          </p>
                          <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                            {firstItem?.medicationName || 'Medication'} · {firstItem?.strengthPerDose || firstItem?.dosage || 'Dose'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                            <span className="uppercase font-semibold">{firstItem?.route || 'oral'}</span>
                            <span>·</span>
                            <span className="text-red-600 font-medium">Due: {new Date(rx.nextDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => openMarModal(rx)}
                          className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        >
                          Administer
                        </Button>
                      </div>
                    );
                  })}
                  {dueNowMeds.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/nurse/mar')}
                      className="w-full h-8 text-xs text-teal-700 hover:text-teal-800"
                    >
                      View all {dueNowMeds.length} due doses on MAR <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Card 2: Ward Inpatients & Abnormal Vitals Feed */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span>Ward Status & Vitals Alerts</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/nurse/admissions')}
                  className="h-6 text-xs text-teal-700 hover:text-teal-800 p-0"
                >
                  Ward Board <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>

              {/* Abnormal Alerts */}
              {abnormalInpatients.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wider block">
                    Critical Vitals Breach
                  </span>
                  {abnormalInpatients.map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-red-200 bg-red-50/70 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {patientName(alert.admission.patientId)}
                          <span className="text-slate-500 font-normal ml-1">
                            ({alert.admission.wardType} · Bed {alert.admission.bedNumber || 'N/A'})
                          </span>
                        </p>
                        <p className="text-red-700 font-semibold mt-0.5">
                          {alert.vital}: {alert.value}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/nurse/admissions`)}
                        className="h-6.5 text-[10px] px-2 border-red-300 text-red-800 bg-white hover:bg-red-50"
                      >
                        Inspect
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Ward Load Summary */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Active Ward Distribution ({activeAdmissions.length} Inpatients)
                </span>
                {(stats.byWard || []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No active ward admissions.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {stats.byWard.map((ward: any) => (
                      <div
                        key={ward._id}
                        className="p-2 rounded-lg border border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs"
                      >
                        <span className="capitalize font-medium text-slate-700">{ward._id}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] h-4.5 px-1.5", ward._id === 'icu' && ward.count > 0 ? "border-red-300 bg-red-50 text-red-700 font-bold" : "bg-white text-slate-800")}
                        >
                          {ward.count} beds
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Modal Dialog */}
      <TriageDialog
        visit={triageVisit}
        open={triageOpen}
        onOpenChange={setTriageOpen}
        onCompleted={() => setTriageVisit(null)}
      />

      {/* Rapid Test Result Dialog */}
      <RapidTestResultDialog
        visit={rapidVisit}
        open={rapidOpen}
        onOpenChange={setRapidOpen}
      />

      {/* MAR Medication Administration Dialog */}
      <MarDialog
        prescription={marPrescription}
        open={marOpen}
        onOpenChange={setMarOpen}
      />

      {/* Bedside Diagnostic Lab Order Modal */}
      <DoctorLabOrderModal
        open={labModalOpen}
        onOpenChange={setLabModalOpen}
        editingOrder={null}
        tests={lisCatalog}
        testsLoading={lisLoading}
        testsError={lisError}
        testsLoadError={lisLoadError}
        selectedTests={selectedTests}
        onAddTest={handleAddLabTest}
        onRemoveTest={handleRemoveLabTest}
        onCancel={() => setLabModalOpen(false)}
        onSubmit={handleLabSubmit}
        isPending={isSubmittingLab}
      />

      {/* Bedside Inpatient Medication Prescription Modal */}
      <DoctorPrescriptionModal
        open={rxModalOpen}
        onOpenChange={setRxModalOpen}
        editingPrescription={null}
        patientName={patientName(rxVisit?.patientId)}
        patientId={rxVisit?.patientId?._id || rxVisit?.patientId}
        allergies={rxVisit?.patientId?.allergies || []}
        medications={medications}
        medicationsLoading={medicationsLoading}
        prescriptionItems={rxItems}
        onSelectMedication={handleSelectMedication}
        onUpdateItem={handleUpdateRxItem}
        onRemoveItem={handleRemoveRxItem}
        onCancel={() => setRxModalOpen(false)}
        onSubmit={handleRxSubmit}
        isPending={isSubmittingRx}
      />
    </RoleLayout>
  );
}
