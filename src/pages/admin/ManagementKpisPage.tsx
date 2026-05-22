import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Activity, BarChart3, BriefcaseBusiness, CheckCircle2, ClipboardCheck, Cpu, Loader2, Stethoscope, Target, TrendingUp } from 'lucide-react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Kpi = {
  category: string;
  label: string;
  target: string;
  value: number | null;
  unit: string;
  owner: string;
  status: 'green' | 'yellow' | 'red' | 'manual';
  manual?: boolean;
};

const tabConfig = [
  { key: 'overall', label: 'Overall', icon: BarChart3 },
  { key: 'ceo', label: 'CEO', icon: BriefcaseBusiness },
  { key: 'it', label: 'IT', icon: Cpu },
  { key: 'clinical', label: 'Clinical', icon: Stethoscope },
  { key: 'operations', label: 'Operations', icon: ClipboardCheck },
];

function statusClass(status: Kpi['status']) {
  if (status === 'green') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'yellow') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'red') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function displayValue(kpi: Kpi) {
  if (kpi.value === null || kpi.value === undefined) return 'Manual';
  if (kpi.unit === 'Le') return `Le ${Number(kpi.value).toLocaleString()}`;
  if (kpi.unit === '%') return `${kpi.value}%`;
  return `${Number(kpi.value).toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`;
}

function KpiTable({ title, kpis }: { title: string; kpis: Kpi[] }) {
  const grouped = useMemo(() => {
    return kpis.reduce<Record<string, Kpi[]>>((acc, kpi) => {
      acc[kpi.category] = acc[kpi.category] || [];
      acc[kpi.category].push(kpi);
      return acc;
    }, {});
  }, [kpis]);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">{category}</h3>
            <Badge variant="outline">{items.length} KPI(s)</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Target</th>
                  <th>Current</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {items.map((kpi) => (
                  <tr key={`${title}-${kpi.label}`}>
                    <td className="font-medium">{kpi.label}</td>
                    <td>{kpi.target}{kpi.unit === '%' ? '%' : ''}</td>
                    <td className="font-semibold">{displayValue(kpi)}</td>
                    <td>
                      <Badge variant="outline" className={cn('capitalize', statusClass(kpi.status))}>
                        {kpi.status}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground">{kpi.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ManagementKpisPage() {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'management-kpis', startDate, endDate],
    queryFn: () => adminAPI.getManagementKpis(startDate, endDate),
  });

  const summary = data?.summary || {};
  const kpis = data?.kpis || {};

  return (
    <RoleLayout title="Management KPIs" subtitle="Leadership scorecards for clinic growth, quality, digital operations and execution" role="admin" userName={profile?.fullName}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {data?.startDate && data?.endDate ? `${format(new Date(data.startDate), 'MMM dd')} - ${format(new Date(data.endDate), 'MMM dd, yyyy')}` : ''}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" /> Patients Seen</p>
              <p className="text-2xl font-bold mt-1">{summary.totalPatientsSeen || 0}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Revenue</p>
              <p className="text-2xl font-bold mt-1">Le {Number(summary.revenue || 0).toLocaleString()}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> EHR Completion</p>
              <p className="text-2xl font-bold mt-1">{summary.ehrCompletionRate || 0}%</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Billing Collection</p>
              <p className="text-2xl font-bold mt-1">{summary.billingCollectionRate || 0}%</p>
            </div>
          </div>

          <div className="bg-muted/30 border rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-sm mb-2">Themed Clinic Mix</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.themedClinic || {}).length === 0 ? (
                <span className="text-sm text-muted-foreground">No visit data in selected period.</span>
              ) : (
                Object.entries(summary.themedClinic || {}).map(([name, count]) => (
                  <Badge key={name} variant="outline" className="capitalize">{name}: {String(count)}</Badge>
                ))
              )}
            </div>
          </div>

          <Tabs defaultValue="overall" className="w-full">
            <div className="border-b mb-4 overflow-x-auto">
              <TabsList className="bg-transparent h-auto p-0 min-w-max">
                {tabConfig.map(({ key, label, icon: Icon }) => (
                  <TabsTrigger key={key} value={key} className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                    <Icon className="w-4 h-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tabConfig.map(({ key, label }) => (
              <TabsContent key={key} value={key} className="mt-0">
                <KpiTable title={label} kpis={kpis[key] || []} />
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </RoleLayout>
  );
}
