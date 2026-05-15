import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp } from 'lucide-react';

interface VitalsTrendsProps {
  vitalsHistory?: Array<{
    date: string | Date;
    vitalSigns?: {
      bloodPressure?: string;
      temperature?: number;
      heartRate?: number;
      respiratoryRate?: number;
      weight?: number;
      height?: number;
      oxygenSaturation?: number;
      bmi?: number;
    };
  }>;
}

export function VitalsTrends({ vitalsHistory = [] }: VitalsTrendsProps) {
  if (vitalsHistory.length === 0) return null;

  const sorted = [...vitalsHistory].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latest = sorted[0]?.vitalSigns || {};
  const previous = sorted[1]?.vitalSigns || {};

  const getTrend = (current?: number, prev?: number) => {
    if (!current || !prev) return null;
    if (current > prev) return 'up';
    if (current < prev) return 'down';
    return 'stable';
  };

  const TrendArrow = ({ value, prev }: { value?: number; prev?: number }) => {
    const trend = getTrend(value, prev);
    if (!trend || trend === 'stable') return null;
    return (
      <span className={`text-xs ${trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
        {trend === 'up' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Vitals Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'BP', value: latest.bloodPressure, unit: '', prev: previous.bloodPressure },
            { label: 'Temp', value: latest.temperature, unit: '°C', prev: previous.temperature },
            { label: 'HR', value: latest.heartRate, unit: 'bpm', prev: previous.heartRate },
            { label: 'RR', value: latest.respiratoryRate, unit: '/min', prev: previous.respiratoryRate },
            { label: 'Weight', value: latest.weight, unit: 'kg', prev: previous.weight },
            { label: 'SpO2', value: latest.oxygenSaturation, unit: '%', prev: previous.oxygenSaturation },
          ].map((vital) => (
            <div key={vital.label} className="p-3 bg-muted/30 rounded-lg border">
              <p className="text-xs text-muted-foreground">{vital.label}</p>
              <div className="flex items-center gap-1 mt-1">
                <p className="text-lg font-semibold">
                  {vital.value !== undefined && vital.value !== null ? `${vital.value}${vital.unit}` : '—'}
                </p>
                {typeof vital.value === 'number' && typeof vital.prev === 'number' && (
                  <TrendArrow value={vital.value} prev={vital.prev} />
                )}
              </div>
            </div>
          ))}
        </div>

        {sorted.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Last {Math.min(sorted.length, 5)} readings
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">BP</th>
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Temp</th>
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">HR</th>
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Weight</th>
                    <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">SpO2</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 5).map((v, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="py-1.5 px-2">{new Date(v.date).toLocaleDateString()}</td>
                      <td className="py-1.5 px-2">{v.vitalSigns?.bloodPressure || '—'}</td>
                      <td className="py-1.5 px-2">{v.vitalSigns?.temperature ? `${v.vitalSigns.temperature}°` : '—'}</td>
                      <td className="py-1.5 px-2">{v.vitalSigns?.heartRate || '—'}</td>
                      <td className="py-1.5 px-2">{v.vitalSigns?.weight ? `${v.vitalSigns.weight}kg` : '—'}</td>
                      <td className="py-1.5 px-2">{v.vitalSigns?.oxygenSaturation ? `${v.vitalSigns.oxygenSaturation}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
