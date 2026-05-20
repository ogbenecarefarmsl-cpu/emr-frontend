import { MetricCard } from '@/components/dashboard/MetricCard';
import { Activity, BedDouble, ClipboardCheck, Inbox, LogOut } from 'lucide-react';

interface NurseMetricsProps {
  triageCount: number;
  stats: {
    activeTotal?: number;
    todayAdmissions?: number;
    todayDischarges?: number;
    byWard?: Array<{ _id: string; count: number }>;
  };
}

export function NurseMetrics({ triageCount, stats }: NurseMetricsProps) {
  const icuCount = stats.byWard?.find((ward) => ward._id === 'icu')?.count || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <MetricCard
        title="Awaiting Triage"
        value={triageCount}
        icon={ClipboardCheck}
        variant={triageCount > 0 ? 'warning' : 'default'}
      />
      <MetricCard title="Active Admissions" value={stats.activeTotal || 0} icon={BedDouble} />
      <MetricCard title="ICU Patients" value={icuCount} icon={Activity} variant={icuCount > 0 ? 'critical' : 'default'} />
      <MetricCard title="Admitted Today" value={stats.todayAdmissions || 0} icon={Inbox} />
      <MetricCard title="Discharged Today" value={stats.todayDischarges || 0} icon={LogOut} />
    </div>
  );
}
