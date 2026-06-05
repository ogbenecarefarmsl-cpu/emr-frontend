import { MetricCard } from '@/components/dashboard/MetricCard';
import { Activity, AlertTriangle, BedDouble, ClipboardCheck, Inbox, LogOut, Pill } from 'lucide-react';

interface NurseMetricsProps {
  triageCount: number;
  stats: {
    activeTotal?: number;
    todayAdmissions?: number;
    todayDischarges?: number;
    byWard?: Array<{ _id: string; count: number }>;
  };
  dueMeds?: number;
  abnormalVitals?: number;
}

export function NurseMetrics({ triageCount, stats, dueMeds = 0, abnormalVitals = 0 }: NurseMetricsProps) {
  const icuCount = stats.byWard?.find((ward) => ward._id === 'icu')?.count || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 mb-6">
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
      <MetricCard
        title="Meds Due"
        value={dueMeds}
        icon={Pill}
        variant={dueMeds > 0 ? 'warning' : 'default'}
      />
      <MetricCard
        title="Abnormal Vitals"
        value={abnormalVitals}
        icon={AlertTriangle}
        variant={abnormalVitals > 0 ? 'critical' : 'default'}
      />
    </div>
  );
}
