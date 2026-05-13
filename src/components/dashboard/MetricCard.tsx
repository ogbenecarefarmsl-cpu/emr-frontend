import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'critical';
  className?: string;
}

const variantStyles = {
  default: 'bg-card hover:shadow-md',
  primary: 'bg-primary/5 border-primary/20 hover:shadow-md hover:shadow-primary/5',
  warning: 'bg-status-warning/5 border-status-warning/25 hover:shadow-md hover:shadow-status-warning/5',
  critical: 'bg-status-critical/5 border-status-critical/25 hover:shadow-md hover:shadow-status-critical/5',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-status-warning/15 text-status-warning',
  critical: 'bg-status-critical/15 text-status-critical',
};

export function MetricCard({ title, value, icon: Icon, trend, variant = 'default', className }: MetricCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-5 shadow-sm transition-all duration-200',
      variantStyles[variant],
      className,
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-2 truncate">{value}</p>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium mt-2',
              trend.isPositive ? 'text-status-normal' : 'text-status-critical'
            )}>
              {trend.isPositive
                ? <TrendingUp className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />
              }
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              <span className="text-muted-foreground font-normal">vs yesterday</span>
            </div>
          )}
        </div>
        <div className={cn('p-2.5 rounded-xl flex-shrink-0', iconStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
