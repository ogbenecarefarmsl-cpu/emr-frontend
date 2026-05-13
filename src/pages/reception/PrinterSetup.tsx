import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePrinterContext } from '@/context/PrinterContext';
import { usbPrinterService } from '@/services/usbPrinterService';
import { buildReceiptESCPOS } from '@/utils/escpos';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Printer,
  Usb,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TestTube2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

const TEST_RECEIPT_DATA = {
  receiptNumber: 'RCP-TEST-001',
  orderNumber: 'ORD-TEST-20260308',
  patientName: 'Test Patient',
  patientId: 'LAB-TEST-001',
  patientPhone: '+232 75 000000',
  tests: [
    { code: 'CBC', name: 'Complete Blood Count', price: 50000 },
    { code: 'LFT', name: 'Liver Function Test', price: 75000 },
  ],
  subtotal: 125000,
  discount: 10,
  discountType: 'percentage' as const,
  total: 112500,
  amountPaid: 120000,
  paymentMethod: 'cash' as const,
  paymentDate: new Date().toISOString(),
  cashier: 'Receptionist',
};

export default function PrinterSetup() {
  const { profile } = useAuth();
  const {
    settings,
    updateThermalSettings,
    thermalDevice,
    thermalConnected,
    webUsbSupported,
    connectThermalPrinter,
    disconnectThermalPrinter,
  } = usePrinterContext();

  const [connectingThermal, setConnectingThermal] = useState(false);
  const [disconnectingThermal, setDisconnectingThermal] = useState(false);
  const [testPrintingThermal, setTestPrintingThermal] = useState(false);
  const [showZadigGuide, setShowZadigGuide] = useState(false);

  const handleConnect = async () => {
    setConnectingThermal(true);
    try {
      await connectThermalPrinter();
      toast.success('Thermal printer connected successfully');
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : null) ?? 'Failed to connect printer';
      if (msg.includes('No device selected')) {
        toast.info('No device was selected');
      } else if (msg.startsWith('ACCESS_DENIED')) {
        setShowZadigGuide(true);
        toast.error(
          'Access denied — the USB driver needs to be replaced. Ask your admin to run the Zadig setup.',
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setConnectingThermal(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectingThermal(true);
    try {
      await disconnectThermalPrinter();
      toast.success('Printer disconnected');
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : null) ?? 'Failed to disconnect printer';
      toast.error(msg);
    } finally {
      setDisconnectingThermal(false);
    }
  };

  const handleTestPrint = async () => {
    setTestPrintingThermal(true);
    try {
      if (!thermalConnected) {
        const ok = await usbPrinterService.autoConnect();
        if (!ok) throw new Error('Printer not connected. Please connect first.');
      }
      const bytes = buildReceiptESCPOS(TEST_RECEIPT_DATA, 'patient');
      await usbPrinterService.print(bytes);
      toast.success('Test receipt sent to printer');
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : null) ?? 'Test print failed';
      toast.error(msg);
    } finally {
      setTestPrintingThermal(false);
    }
  };

  const deviceLabel = thermalDevice
    ? thermalDevice.productName
      ? `${thermalDevice.productName} (${thermalDevice.manufacturerName ?? ''})`.trim().replace(/\s+/g, ' ')
      : `VID:${thermalDevice.vendorId.toString(16).toUpperCase().padStart(4, '0')} PID:${thermalDevice.productId.toString(16).toUpperCase().padStart(4, '0')}`
    : null;

  return (
    <RoleLayout
      title="Printer Setup"
      subtitle="Connect the receipt printer on this computer"
      role="receptionist"
      userName={profile?.full_name}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Usb className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Receipt Printer</CardTitle>
                  <CardDescription>Xprinter · 80 mm USB thermal</CardDescription>
                </div>
              </div>
              <Badge
                variant={thermalConnected ? 'default' : 'secondary'}
                className={thermalConnected ? 'bg-green-600' : ''}
              >
                {thermalConnected ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</>
                ) : (
                  <><XCircle className="w-3 h-3 mr-1" /> Disconnected</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Device info */}
            {deviceLabel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded p-2">
                <Printer className="w-4 h-4 shrink-0" />
                <span>{deviceLabel}</span>
              </div>
            )}

            {/* WebUSB warning */}
            {!webUsbSupported && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  WebUSB is not supported in this browser. Please use{' '}
                  <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
                </AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {!thermalConnected ? (
                <Button onClick={handleConnect} disabled={!webUsbSupported || connectingThermal}>
                  {connectingThermal ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Connecting…</>
                  ) : (
                    <><Usb className="w-4 h-4 mr-2" />Connect Printer</>
                  )}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleDisconnect} disabled={disconnectingThermal}>
                  {disconnectingThermal ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Disconnecting…</>
                  ) : (
                    <><XCircle className="w-4 h-4 mr-2" />Disconnect</>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleTestPrint}
                disabled={testPrintingThermal || !thermalConnected}
              >
                {testPrintingThermal ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Printing…</>
                ) : (
                  <><TestTube2 className="w-4 h-4 mr-2" />Test Print</>
                )}
              </Button>
            </div>

            {/* Current settings (read-only info) */}
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Printer Settings</p>
              
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                <div className="space-y-0.5">
                  <Label htmlFor="thermal-enabled" className="text-sm font-medium">
                    Enable Thermal Printing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Print receipts directly to USB thermal printer
                  </p>
                </div>
                <Switch
                  id="thermal-enabled"
                  checked={settings.thermal.enabled}
                  onCheckedChange={(checked) => updateThermalSettings({ enabled: checked })}
                />
              </div>

              {/* Copies Setting */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                <div className="space-y-0.5">
                  <Label htmlFor="thermal-copies" className="text-sm font-medium">
                    Number of Copies
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    1 = Patient copy only, 2 = Patient + Lab copy
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={settings.thermal.copies === 1 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateThermalSettings({ copies: 1 })}
                  >
                    1
                  </Button>
                  <Button
                    variant={settings.thermal.copies === 2 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateThermalSettings({ copies: 2 })}
                  >
                    2
                  </Button>
                </div>
              </div>

              {/* Auto-print Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                <div className="space-y-0.5">
                  <Label htmlFor="thermal-auto" className="text-sm font-medium">
                    Auto-print on Payment
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically print receipts when payment is confirmed
                  </p>
                </div>
                <Switch
                  id="thermal-auto"
                  checked={settings.thermal.autoPrintOnPayment}
                  onCheckedChange={(checked) => updateThermalSettings({ autoPrintOnPayment: checked })}
                />
              </div>
            </div>

            {/* Zadig driver guide */}
            <Accordion
              type="single"
              collapsible
              value={showZadigGuide ? 'setup' : undefined}
              onValueChange={v => setShowZadigGuide(v === 'setup')}
            >
              <AccordionItem value="setup">
                <AccordionTrigger className={`text-sm ${showZadigGuide ? 'text-destructive' : ''}`}>
                  <span className="flex items-center gap-2">
                    <Info className={`w-4 h-4 ${showZadigGuide ? 'text-destructive' : 'text-blue-500'}`} />
                    {showZadigGuide
                      ? 'Action required: replace the USB driver (see steps below)'
                      : 'Having trouble connecting? See setup instructions'}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm text-muted-foreground space-y-3 pt-1">
                    <p>
                      Windows installs a USB printer driver by default that{' '}
                      <strong>blocks WebUSB access</strong>. The driver must be replaced
                      with WinUSB using the free <strong>Zadig</strong> tool.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 pl-2">
                      <li>Download Zadig from <strong>zadig.akeo.ie</strong></li>
                      <li>Connect the Xprinter via USB and power it on</li>
                      <li>Open Zadig → <em>Options → List All Devices</em></li>
                      <li>Select <strong>Xprinter</strong> from the dropdown</li>
                      <li>In the driver box on the right, choose <strong>WinUSB</strong></li>
                      <li>Click <strong>Replace Driver</strong> and wait ~30 s</li>
                      <li>Return here and click <strong>Connect Printer</strong></li>
                    </ol>
                    <Alert>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        This only needs to be done once per computer. After replacing the
                        driver, the browser can talk directly to the printer — no print
                        dialog needed.
                      </AlertDescription>
                    </Alert>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </RoleLayout>
  );
}
