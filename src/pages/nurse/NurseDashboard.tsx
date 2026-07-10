import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { NurseMetrics } from '@/components/nurse/NurseMetrics';
import { useAwaitingTriage } from '@/hooks/useVisits';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';
import { prescriptionService } from '@/services/prescriptionService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Pill,
  Stethoscope,
  Clock,
} from 'lucide-react';

const workspaces = [
  {
    title: 'Triage',
    description: 'Vitals, ESI priority, allergies and nurse handoff to doctor queue.',
    to: '/nurse/triage',
    icon: ClipboardCheck,
    accent: 'text-amber-600 bg-amber-500/10',
  },
  {
    title: 'Admissions',
    description: 'Ward board, inpatient chart, vitals, fluids, notes and care plans.',
    to: '/nurse/admissions',
    icon: BedDouble,
    accent: 'text-blue-600 bg-blue-500/10',
  },
  {
    title: 'Test Orders',
    description: 'Order LIS-backed tests and route payment to reception.',
    to: '/nurse/lab-requests',
    icon: FlaskConical,
    accent: 'text-cyan-700 bg-cyan-500/10',
  },
  {
    title: 'Prescriptions',
    description: 'Write medication orders and route payment to reception.',
    to: '/nurse/prescriptions',
    icon: Pill,
    accent: 'text-violet-600 bg-violet-500/10',
  },
  {
    title: 'MAR',
    description: 'Medication administration worklist for admitted patients.',
    to: '/nurse/mar',
    icon: Pill,
    accent: 'text-emerald-600 bg-emerald-500/10',
  },
  {
    title: 'Observation',
    description: 'Short-stay monitoring, repeat vitals and doctor review readiness.',
    to: '/nurse/observation',
    icon: HeartPulse,
    accent: 'text-rose-600 bg-rose-500/10',
  },
  {
    title: 'Procedures',
    description: 'Ordered procedures, room preparation, procedure notes and completion.',
    to: '/nurse/procedures',
    icon: ClipboardList,
    accent: 'text-purple-600 bg-purple-500/10',
  },
];

export default function NurseDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: triageQueue = [] } = useAwaitingTriage();
  const { data: dashboard } = useAdmissionsDashboard(false);
  const { data: marWorklist = [] } = useQuery({
    queryKey: ['prescriptions', 'mar-worklist'],
    queryFn: () => prescriptionService.getMarWorklist(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const stats = dashboard?.stats || { activeTotal: 0, todayAdmissions: 0, todayDischarges: 0, byWard: [] };

  // Alert when ESI 1/2 visits are in the triage queue
  const lastSeenTriageIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!triageQueue.length) return;
    const criticalIds = triageQueue
      .filter((v: any) => {
        const p = (v.triagePriority || '').toLowerCase();
        return p === 'emergency' || p === 'urgent';
      })
      .map((v: any) => v._id);
    const newCritical = triageQueue.filter((v: any) => {
      const p = (v.triagePriority || '').toLowerCase();
      return (p === 'emergency' || p === 'urgent') && !lastSeenTriageIds.current.has(v._id);
    });
    if (newCritical.length > 0) {
      toast.warning(`${newCritical.length} critical patient${newCritical.length === 1 ? '' : 's'} awaiting triage`, {
        description: newCritical.map((v: any) => `${v.visitNumber} (${v.triagePriority})`).join(', '),
        duration: 8000,
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
      });
    }
    lastSeenTriageIds.current = new Set(criticalIds);
  }, [triageQueue]);

  const dueNowMeds = useMemo(() => (
    Array.isArray(marWorklist)
      ? marWorklist.filter((rx: any) => rx.status !== 'completed' && rx.nextDueAt && new Date(rx.nextDueAt) <= new Date())
      : []
  ), [marWorklist]);

  const upcomingMedsCount = useMemo(() => (
    Array.isArray(marWorklist)
      ? marWorklist.filter((rx: any) => rx.status !== 'completed' && rx.nextDueAt && new Date(rx.nextDueAt) > new Date()).length
      : 0
  ), [marWorklist]);

  const dueMedsCount = dueNowMeds.length;

  const abnormalVitalsCount = useMemo(() => {
    let count = 0;
    for (const adm of activeAdmissions) {
      const log = adm.vitalsLog || [];
      const latest = log[log.length - 1];
      if (!latest) continue;
      if (
        (latest.oxygenSaturation != null && latest.oxygenSaturation < 92) ||
        (latest.heartRate != null && (latest.heartRate > 130 || latest.heartRate < 40)) ||
        (latest.temperature != null && (latest.temperature >= 39.5 || latest.temperature < 35)) ||
        (latest.respiratoryRate != null && (latest.respiratoryRate > 30 || latest.respiratoryRate < 8))
      ) {
        count += 1;
      }
    }
    return count;
  }, [activeAdmissions]);

  return (
    <RoleLayout
      title="Nurse Station"
      subtitle="Triage, admissions, medication rounds, observation and procedure workspaces"
      role="nurse"
      userName={profile?.fullName}
    >
      <NurseMetrics triageCount={triageQueue.length} stats={stats} dueMeds={dueMedsCount} abnormalVitals={abnormalVitalsCount} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {workspaces.map((workspace) => (
            <button
              key={workspace.to}
              type="button"
              onClick={() => navigate(workspace.to)}
              className="bg-card border rounded-xl p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${workspace.accent}`}>
                  <workspace.icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mt-4">{workspace.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{workspace.description}</p>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Immediate Work</p>
                <h3 className="font-semibold mt-1">Queue snapshot</h3>
              </div>
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div className="mt-4 space-y-3">
              <QueueLine label="Awaiting triage" value={triageQueue.length} action={() => navigate('/nurse/triage')} tone="warning" />
              <QueueLine label="MAR due now" value={dueMedsCount} action={() => navigate('/nurse/mar')} tone={dueMedsCount > 0 ? 'critical' : undefined} unit="dose" />
              <QueueLine label="Abnormal vitals" value={abnormalVitalsCount} action={() => navigate('/nurse/admissions')} tone={abnormalVitalsCount > 0 ? 'critical' : undefined} />
              <QueueLine label="Active admissions" value={activeAdmissions.length} action={() => navigate('/nurse/admissions')} />
              <QueueLine label="ICU patients" value={stats.byWard?.find((ward: any) => ward._id === 'icu')?.count || 0} action={() => navigate('/nurse/admissions')} tone="critical" />
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Medication Rounds</p>
                <h3 className="font-semibold mt-1">Due now</h3>
              </div>
              <Badge variant={dueMedsCount > 0 ? 'destructive' : 'outline'}>
                {dueMedsCount} due
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {dueNowMeds.slice(0, 3).map((rx: any) => {
                const patient = rx.patientId;
                const firstItem = rx.items?.[0];
                return (
                  <button
                    key={rx._id || rx.id}
                    type="button"
                    onClick={() => navigate('/nurse/mar')}
                    className="w-full rounded-lg border p-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {patient?.firstName} {patient?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {firstItem?.medicationName || 'Medication'} - {firstItem?.strengthPerDose || firstItem?.dosage || 'dose'}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {firstItem?.route || 'route'}
                      </Badge>
                    </div>
                  </button>
                );
              })}
              {dueMedsCount === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <Clock className="mx-auto h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No doses due now. {upcomingMedsCount} upcoming.
                  </p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/nurse/mar')}>
                Open MAR
              </Button>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Ward Load</h3>
            </div>
            <div className="mt-4 space-y-2">
              {(stats.byWard || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active ward load</p>
              ) : (
                stats.byWard.map((ward: any) => (
                  <div key={ward._id} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{ward._id}</span>
                    <Badge variant="outline">{ward.count}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}

function QueueLine({
  label,
  value,
  action,
  tone,
  unit = 'patient',
}: {
  label: string;
  value: number;
  action: () => void;
  tone?: 'warning' | 'critical';
  unit?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{value} {unit}{value === 1 ? '' : 's'}</p>
      </div>
      <Button size="sm" variant={tone === 'critical' ? 'destructive' : tone === 'warning' ? 'default' : 'outline'} onClick={action}>
        Open
      </Button>
    </div>
  );
}
