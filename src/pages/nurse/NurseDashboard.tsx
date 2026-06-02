import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { NurseMetrics } from '@/components/nurse/NurseMetrics';
import { useAwaitingTriage } from '@/hooks/useVisits';
import { useAdmissionsDashboard } from '@/hooks/useAdmissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  ArrowRight,
  BedDouble,
  ClipboardCheck,
  ClipboardList,
  HeartPulse,
  Pill,
  Stethoscope,
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
  const activeAdmissions = dashboard?.activeAdmissions || [];
  const stats = dashboard?.stats || { activeTotal: 0, todayAdmissions: 0, todayDischarges: 0, byWard: [] };

  return (
    <RoleLayout
      title="Nurse Station"
      subtitle="Triage, admissions, medication rounds, observation and procedure workspaces"
      role="nurse"
      userName={profile?.fullName}
    >
      <NurseMetrics triageCount={triageQueue.length} stats={stats} />

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
              <QueueLine label="Active admissions" value={activeAdmissions.length} action={() => navigate('/nurse/admissions')} />
              <QueueLine label="ICU patients" value={stats.byWard?.find((ward: any) => ward._id === 'icu')?.count || 0} action={() => navigate('/nurse/admissions')} tone="critical" />
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
}: {
  label: string;
  value: number;
  action: () => void;
  tone?: 'warning' | 'critical';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{value} patient{value === 1 ? '' : 's'}</p>
      </div>
      <Button size="sm" variant={tone === 'critical' ? 'destructive' : tone === 'warning' ? 'default' : 'outline'} onClick={action}>
        Open
      </Button>
    </div>
  );
}
