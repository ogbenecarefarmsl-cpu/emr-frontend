import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { usePrinterContext } from '@/context/PrinterContext';
import { usbPrinterService } from '@/services/usbPrinterService';
import { buildReceiptESCPOS } from '@/utils/escpos';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TestTube2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ── Demo receipt data used for test prints ─────────────────────────────────

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
  cashier: 'Admin',
};

// ── Component ──────────────────────────────────────────────────────────────

export default function PrinterSettings() {
  const { profile } = useAuth();
  const {
    settings,
    updateThermalSettings,
    updateA4Settings,
    thermalDevice,
    thermalConnected,
    webUsbSupported,
    connectThermalPrinter,
    disconnectThermalPrinter,
  } = usePrinterContext();

  const [connectingThermal, setConnectingThermal] = useState(false);
  const [disconnectingThermal, setDisconnectingThermal] = useState(false);
  const [testPrintingThermal, setTestPrintingThermal] = useState(false);
  const [testPrintingA4, setTestPrintingA4] = useState(false);
  const [showZadigGuide, setShowZadigGuide] = useState(false);

  // ── Thermal printer actions ──────────────────────────────────────────────

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
        toast.error('Access denied — Windows driver must be replaced. See the Zadig setup guide below.', { duration: 8000 });
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
      toast.success('Printer disconnected and pairing removed');
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : null) ?? 'Failed to disconnect printer';
      toast.error(msg);
    } finally {
      setDisconnectingThermal(false);
    }
  };

  const handleThermalTestPrint = async () => {
    setTestPrintingThermal(true);
    try {
      if (!thermalConnected) {
        // Try to reconnect first
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

  // ── A4 printer actions ───────────────────────────────────────────────────

  const handleA4TestPrint = () => {
    setTestPrintingA4(true);
    // Inject dynamic @page rule based on current settings and open print dialog
    const styleId = '__a4_test_print_style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      @media print {
        @page {
          size: ${settings.a4.paperSize} ${settings.a4.orientation};
          margin: 10mm;
        }
        body * { visibility: hidden; }
        #a4-test-content, #a4-test-content * { visibility: visible; }
        #a4-test-content { position: fixed; top: 0; left: 0; width: 100%; }
      }
    `;

    // Show a simple test print page in a popup
    const win = window.open('', '_blank', 'width=794,height=1123');
    if (!win) {
      toast.error('Popup blocked. Please allow popups for this site.');
      setTestPrintingA4(false);
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>A4 Test Print – ${format(new Date(), 'dd/MM/yyyy HH:mm')}</title>
          <style>
            @page { size: ${settings.a4.paperSize} ${settings.a4.orientation}; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 12pt; color: #000; }
            h1 { font-size: 20pt; border-bottom: 2px solid #000; padding-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #000; padding: 6px 10px; text-align: left; }
            th { background: #f0f0f0; font-weight: bold; }
            .footer { margin-top: 40px; font-size: 9pt; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <h1>HARBOUR LABORATORY</h1>
          <p><strong>A4 Printer Test Page</strong></p>
          <p>Paper: ${settings.a4.paperSize} &nbsp;|&nbsp; Orientation: ${settings.a4.orientation}</p>
          <p>Printed: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
          <table>
            <thead>
              <tr><th>Test</th><th>Result</th><th>Reference Range</th><th>Flag</th></tr>
            </thead>
            <tbody>
              <tr><td>Haemoglobin</td><td>13.5 g/dL</td><td>12.0 – 17.5</td><td>Normal</td></tr>
              <tr><td>WBC Count</td><td>9.2 × 10³/µL</td><td>4.0 – 11.0</td><td>Normal</td></tr>
              <tr><td>ALT</td><td>45 U/L</td><td>7 – 40</td><td style="color:red">High</td></tr>
            </tbody>
          </table>
          <p class="footer">This is a test print — HARBOUR Diagnostics, Freetown Sierra Leone</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      setTimeout(() => {
        win.close();
        setTestPrintingA4(false);
        toast.success('A4 test print dialog opened');
      }, 500);
    }, 300);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const deviceLabel = thermalDevice
    ? thermalDevice.productName
      ? `${thermalDevice.productName} (${thermalDevice.manufacturerName ?? ''})`
          .trim()
          .replace(/\s+/g, ' ')
      : `VID:${thermalDevice.vendorId.toString(16).toUpperCase().padStart(4, '0')} PID:${thermalDevice.productId.toString(16).toUpperCase().padStart(4, '0')}`
    : null;

  return (
    <RoleLayout
      title="Printer Configuration"
      subtitle="Configure thermal receipt and A4 report printers"
      role="admin"
      userName={profile?.full_name}
    >
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Thermal Receipt Printer ──────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Usb className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Thermal Receipt Printer</CardTitle>
                  <CardDescription>Xprinter XT-80P · 80mm USB thermal</CardDescription>
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

            {/* WebUSB unsupported warning */}
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
                <Button
                  onClick={handleConnect}
                  disabled={!webUsbSupported || connectingThermal}
                >
                  {connectingThermal ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Connecting…</>
                  ) : (
                    <><Usb className="w-4 h-4 mr-2" />Connect Printer</>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnectingThermal}
                >
                  {disconnectingThermal ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Disconnecting…</>
                  ) : (
                    <><XCircle className="w-4 h-4 mr-2" />Disconnect</>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleThermalTestPrint}
                disabled={testPrintingThermal || !thermalConnected}
              >
                {testPrintingThermal ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Printing…</>
                ) : (
                  <><TestTube2 className="w-4 h-4 mr-2" />Test Print</>
                )}
              </Button>
            </div>

            {/* Settings */}
            <div className="space-y-4 pt-2 border-t">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="thermal-enabled" className="flex flex-col gap-1">
                  <span>Enable ESC/POS printing</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Uses direct USB communication. Falls back to browser print if disabled.
                  </span>
                </Label>
                <Switch
                  id="thermal-enabled"
                  checked={settings.thermal.enabled}
                  onCheckedChange={v => updateThermalSettings({ enabled: v })}
                />
              </div>

              {/* Copies */}
              <div className="flex items-center justify-between">
                <Label htmlFor="thermal-copies" className="flex flex-col gap-1">
                  <span>Receipt copies</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    1 = patient copy only · 2 = patient + lab copy
                  </span>
                </Label>
                <Select
                  value={String(settings.thermal.copies)}
                  onValueChange={v =>
                    updateThermalSettings({ copies: Number(v) as 1 | 2 })
                  }
                >
                  <SelectTrigger id="thermal-copies" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 copy</SelectItem>
                    <SelectItem value="2">2 copies</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-print */}
              <div className="flex items-center justify-between">
                <Label htmlFor="thermal-auto" className="flex flex-col gap-1">
                  <span>Auto-print on payment</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Automatically prints receipt when a payment is confirmed
                  </span>
                </Label>
                <Switch
                  id="thermal-auto"
                  checked={settings.thermal.autoPrintOnPayment}
                  onCheckedChange={v => updateThermalSettings({ autoPrintOnPayment: v })}
                />
              </div>
            </div>

            {/* Windows driver setup instructions */}
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
                      : 'Windows driver setup instructions'}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm text-muted-foreground space-y-3 pt-1">
                    <p>
                      Windows installs a USB printer driver by default that{' '}
                      <strong>blocks WebUSB access</strong>. You must replace it
                      with the WinUSB driver using the free{' '}
                      <strong>Zadig</strong> tool.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 pl-2">
                      <li>Download Zadig from <strong>zadig.akeo.ie</strong></li>
                      <li>
                        Connect the Xprinter XT-80P via USB and power it on
                      </li>
                      <li>Open Zadig → <em>Options → List All Devices</em></li>
                      <li>
                        Select <strong>Xprinter XT-80P</strong> from the
                        dropdown
                      </li>
                      <li>
                        In the driver box on the right, choose{' '}
                        <strong>WinUSB</strong>
                      </li>
                      <li>Click <strong>Replace Driver</strong> and wait ~30 s</li>
                      <li>
                        Return here and click <strong>Connect Printer</strong>
                      </li>
                    </ol>
                    <Alert>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        Replacing the driver means Windows will no longer see
                        the printer as a system printer. Only this web app can
                        send raw ESC/POS data to it via WebUSB.
                      </AlertDescription>
                    </Alert>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* ── A4 Result Report Printer ─────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <CardTitle>A4 Result Report Printer</CardTitle>
                <CardDescription>Lab result reports · uses browser print dialog</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            <div className="space-y-4">
              {/* Enable */}
              <div className="flex items-center justify-between">
                <Label htmlFor="a4-enabled" className="flex flex-col gap-1">
                  <span>Enable A4 printing</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Shows print button on result report pages
                  </span>
                </Label>
                <Switch
                  id="a4-enabled"
                  checked={settings.a4.enabled}
                  onCheckedChange={v => updateA4Settings({ enabled: v })}
                />
              </div>

              {/* Paper size */}
              <div className="flex items-center justify-between">
                <Label htmlFor="a4-paper">Paper size</Label>
                <Select
                  value={settings.a4.paperSize}
                  onValueChange={v => updateA4Settings({ paperSize: v as 'A4' | 'Letter' })}
                >
                  <SelectTrigger id="a4-paper" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (210×297 mm)</SelectItem>
                    <SelectItem value="Letter">Letter (8.5×11 in)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Orientation */}
              <div className="flex items-center justify-between">
                <Label htmlFor="a4-orientation">Orientation</Label>
                <Select
                  value={settings.a4.orientation}
                  onValueChange={v =>
                    updateA4Settings({ orientation: v as 'portrait' | 'landscape' })
                  }
                >
                  <SelectTrigger id="a4-orientation" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Copies (informational) */}
              <div className="flex items-center justify-between">
                <Label htmlFor="a4-copies" className="flex flex-col gap-1">
                  <span>Default copies</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Reference only — set final count in the browser print dialog
                  </span>
                </Label>
                <Select
                  value={String(settings.a4.copies)}
                  onValueChange={v => updateA4Settings({ copies: Number(v) })}
                >
                  <SelectTrigger id="a4-copies" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'copy' : 'copies'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-print */}
              <div className="flex items-center justify-between">
                <Label htmlFor="a4-auto" className="flex flex-col gap-1">
                  <span>Auto-print on result verification</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Opens print dialog automatically when a result is verified
                  </span>
                </Label>
                <Switch
                  id="a4-auto"
                  checked={settings.a4.autoPrintOnResult}
                  onCheckedChange={v => updateA4Settings({ autoPrintOnResult: v })}
                />
              </div>
            </div>

            {/* Test print */}
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                onClick={handleA4TestPrint}
                disabled={testPrintingA4}
              >
                {testPrintingA4 ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Opening…</>
                ) : (
                  <><TestTube2 className="w-4 h-4 mr-2" />Test Print (A4)</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Opens a sample result report in a new window with the configured
                paper size and orientation. Select your A4 printer in the browser
                print dialog.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </RoleLayout>
  );
}
