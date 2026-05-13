import { usePrinterContext } from '@/context/PrinterContext';
import { Badge } from '@/components/ui/badge';
import { Printer, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PrinterStatusBadge() {
  const { settings, thermalConnected, webUsbSupported } = usePrinterContext();

  if (!webUsbSupported) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="w-3 h-3" />
        WebUSB Not Supported
      </Badge>
    );
  }

  if (!settings.thermal.enabled) {
    return (
      <Link to="/admin/printer-settings">
        <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
          <Printer className="w-3 h-3" />
          Thermal Printing Disabled
        </Badge>
      </Link>
    );
  }

  if (!thermalConnected) {
    return (
      <Link to="/reception/printer-setup">
        <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted border-yellow-500 text-yellow-700">
          <AlertCircle className="w-3 h-3" />
          Printer Not Connected
        </Badge>
      </Link>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 bg-green-50 border-green-500 text-green-700">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      USB Printer Ready
    </Badge>
  );
}
