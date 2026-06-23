import { usePrinterContext } from '@/context/PrinterContext';
import { Badge } from '@/components/ui/badge';
import { Printer, AlertCircle, Bluetooth, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PrinterStatusBadge() {
  const { settings, thermalConnected, btConnected, btReconnecting, btDevice, webUsbSupported } = usePrinterContext();

  if (!settings.thermal.enabled) {
    return (
      <Link to="/admin/printer-settings">
        <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
          <Printer className="w-3 h-3" />
          Thermal Disabled
        </Badge>
      </Link>
    );
  }

  // BT reconnecting
  if (btReconnecting && !btConnected) {
    return (
      <Badge variant="outline" className="gap-1 border-blue-500 text-blue-600">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Reconnecting…
      </Badge>
    );
  }

  // BT connected
  if (btConnected && btDevice) {
    return (
      <Badge variant="outline" className="gap-1 bg-green-50 border-green-500 text-green-700">
        <Bluetooth className="w-3 h-3" />
        BT Ready
      </Badge>
    );
  }

  // USB connected
  if (thermalConnected) {
    return (
      <Badge variant="outline" className="gap-1 bg-green-50 border-green-500 text-green-700">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        USB Ready
      </Badge>
    );
  }

  // Not connected — link to setup
  return (
    <Link to="/reception/printer-setup">
      <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted border-yellow-500 text-yellow-700">
        <AlertCircle className="w-3 h-3" />
        Printer Offline
      </Badge>
    </Link>
  );
}
