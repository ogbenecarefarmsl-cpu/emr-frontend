import { LabMachine } from '@/types/lis';
import { cn } from '@/lib/utils';
import { Cpu, Clock, Wifi } from 'lucide-react';

interface MachineStatusCardProps {
  machine: LabMachine;
}

export function MachineStatusCard({ machine }: MachineStatusCardProps) {
  const statusClasses = {
    online: 'machine-online',
    offline: 'machine-offline',
    error: 'machine-error',
    processing: 'machine-processing',
  };

  const statusText = {
    online: 'Online',
    offline: 'Offline',
    error: 'Error',
    processing: 'Processing',
  };

  const lastComm = machine.lastCommunication 
    ? new Date(machine.lastCommunication).toLocaleTimeString() 
    : 'Never';

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Cpu className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{machine.name}</h3>
            <p className="text-xs text-muted-foreground">{machine.manufacturer} {machine.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('machine-indicator', statusClasses[machine.status])} />
          <span className="text-xs font-medium">{statusText[machine.status]}</span>
        </div>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5" />
          <span>{machine.ipAddress}:{machine.port}</span>
          <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">{machine.protocol}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>Last communication: {lastComm}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t">
        <p className="text-xs text-muted-foreground mb-1">Supported Tests</p>
        <div className="flex flex-wrap gap-1">
          {machine.testsSupported.slice(0, 4).map(test => (
            <span key={test} className="px-2 py-0.5 bg-accent rounded text-[10px] font-medium">
              {test}
            </span>
          ))}
          {machine.testsSupported.length > 4 && (
            <span className="px-2 py-0.5 bg-muted rounded text-[10px]">
              +{machine.testsSupported.length - 4}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
