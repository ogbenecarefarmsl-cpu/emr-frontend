import { TestResult } from '@/types/lis';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, AlertTriangle, Check } from 'lucide-react';

interface ResultFlagProps {
  flag: TestResult['flag'];
}

export function ResultFlag({ flag }: ResultFlagProps) {
  const config = {
    normal: {
      icon: Check,
      className: 'status-normal',
      label: 'Normal',
    },
    low: {
      icon: ArrowDown,
      className: 'bg-status-warning/10 text-status-warning',
      label: 'Low',
    },
    high: {
      icon: ArrowUp,
      className: 'bg-status-warning/10 text-status-warning',
      label: 'High',
    },
    'critical-low': {
      icon: AlertTriangle,
      className: 'status-critical',
      label: 'Critical Low',
    },
    'critical-high': {
      icon: AlertTriangle,
      className: 'status-critical',
      label: 'Critical High',
    },
  };

  const { icon: Icon, className, label } = config[flag];

  return (
    <span className={cn('status-badge', className)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}
