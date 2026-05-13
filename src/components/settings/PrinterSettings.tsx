import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { printService, PrintMethod } from '@/services/printService';
import { usePrinterContext } from '@/context/PrinterContext';
import { qzTrayService } from '@/services/qzTrayService';
import { Printer, Usb, Globe, CheckCircle, XCircle, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function PrinterSettings() {
  const { qzTrayConnected, qzTrayPrinter, connectQZTray, disconnectQZTray } = usePrinterContext();
  const [printMethod, setPrintMethod] = useState<PrintMethod>('auto');
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSerialSupported, setIsSerialSupported] = useState(false);
  const [isQzTesting, setIsQzTesting] = useState(false);

  useEffect(() => {
    // Load saved preference
    const saved = printService.getPreferredMethod();
    setPrintMethod(saved);
    
    // Check if Web Serial is supported
    setIsSerialSupported(printService.isSerialSupported());
    
    // Check connection status
    setIsConnected(printService.isSerialPrinterConnected());
  }, []);

  const handleMethodChange = (method: PrintMethod) => {
    setPrintMethod(method);
    printService.setPreferredMethod(method);
    toast.success(`Print method set to: ${method}`);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const success = await printService.connectSerialPrinter();
      setIsConnected(success);
      
      if (success) {
        toast.success('Connected to thermal printer');
      } else {
        toast.error('Failed to connect to printer');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to printer';
      toast.error(errorMessage);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await printService.disconnectSerialPrinter();
      setIsConnected(false);
      toast.success('Disconnected from printer');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect';
      toast.error(errorMessage);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const success = await printService.testPrinter();
      
      if (success) {
        toast.success('Test print sent successfully');
      } else {
        toast.error('Test print failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Test print failed';
      toast.error(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  const handleOpenDrawer = async () => {
    try {
      const success = await printService.openCashDrawer();
      
      if (success) {
        toast.success('Cash drawer opened');
      } else {
        toast.error('Failed to open cash drawer');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open cash drawer';
      toast.error(errorMessage);
    }
  };

  const handleQzConnect = async () => {
    setIsConnecting(true);
    try {
      await connectQZTray();
      if (qzTrayConnected) {
        toast.success('Connected to QZ Tray');
      } else {
        toast.error('Failed to connect to QZ Tray. Make sure QZ Tray is running.');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to QZ Tray';
      toast.error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQzDisconnect = async () => {
    try {
      await disconnectQZTray();
      toast.success('Disconnected from QZ Tray');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect';
      toast.error(errorMessage);
    }
  };

  const handleQzTest = async () => {
    setIsQzTesting(true);
    try {
      const success = await qzTrayService.testPrint();
      if (success) {
        toast.success('QZ Tray test print sent successfully');
      } else {
        toast.error('QZ Tray test print failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'QZ Tray test print failed';
      toast.error(errorMessage);
    } finally {
      setIsQzTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* QZ Tray Card - Recommended Method */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            QZ Tray (Recommended)
          </CardTitle>
          <CardDescription>
            Fully automatic receipt printing without browser dialogs. Best for production use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <Label>QZ Tray Status</Label>
            <Badge variant={qzTrayConnected ? 'default' : 'secondary'} className="flex items-center gap-1">
              {qzTrayConnected ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>

          {qzTrayConnected && qzTrayPrinter && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Printer:</span>
              <span className="font-medium">{qzTrayPrinter}</span>
            </div>
          )}

          {/* Connection Controls */}
          <div className="flex gap-2">
            {!qzTrayConnected ? (
              <Button onClick={handleQzConnect} disabled={isConnecting} className="flex-1">
                {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Zap className="w-4 h-4 mr-2" />
                Connect to QZ Tray
              </Button>
            ) : (
              <>
                <Button onClick={handleQzDisconnect} variant="outline" className="flex-1">
                  Disconnect
                </Button>
                <Button onClick={handleQzTest} disabled={isQzTesting} variant="outline">
                  {isQzTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Printer className="w-4 h-4 mr-2" />
                  Test Print
                </Button>
              </>
            )}
          </div>

          {/* Setup Instructions */}
          {!qzTrayConnected && (
            <Alert>
              <AlertDescription>
                <strong>Setup QZ Tray:</strong>
                <ol className="list-decimal list-inside space-y-1 mt-2 ml-2 text-sm">
                  <li>Download QZ Tray from <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer" className="text-primary underline">qz.io/download</a></li>
                  <li>Install and run QZ Tray (check system tray)</li>
                  <li>Install your XPrinter driver in Windows</li>
                  <li>Click "Connect to QZ Tray" button above</li>
                  <li>Receipts will print automatically without dialogs!</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Alternative Print Methods
          </CardTitle>
          <CardDescription>
            Fallback options if QZ Tray is not available
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser Support Alert */}
          {!isSerialSupported && (
            <Alert>
              <AlertDescription>
                <strong>Note:</strong> Direct printer connection (Web Serial API) is not supported in this browser.
                Please use Chrome, Edge, or Opera for direct printing. Browser print dialog will be used as fallback.
              </AlertDescription>
            </Alert>
          )}

          {/* Print Method Selection */}
          <div className="space-y-2">
            <Label htmlFor="print-method">Print Method</Label>
            <Select value={printMethod} onValueChange={handleMethodChange}>
              <SelectTrigger id="print-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <span>Auto (Recommended)</span>
                  </div>
                </SelectItem>
                <SelectItem value="serial" disabled={!isSerialSupported}>
                  <div className="flex items-center gap-2">
                    <Usb className="w-4 h-4" />
                    <span>Direct USB/Serial</span>
                  </div>
                </SelectItem>
                <SelectItem value="browser">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>Browser Print Dialog</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {printMethod === 'auto' && 'Tries direct printing first, falls back to browser dialog'}
              {printMethod === 'serial' && 'Direct ESC/POS printing via USB/Serial (fastest)'}
              {printMethod === 'browser' && 'Uses standard browser print dialog'}
            </p>
          </div>

          {/* Connection Status */}
          {isSerialSupported && (printMethod === 'auto' || printMethod === 'serial') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Printer Connection</Label>
                <Badge variant={isConnected ? 'default' : 'secondary'} className="flex items-center gap-1">
                  {isConnected ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Connected
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Not Connected
                    </>
                  )}
                </Badge>
              </div>

              <div className="flex gap-2">
                {!isConnected ? (
                  <Button onClick={handleConnect} disabled={isConnecting} className="flex-1">
                    {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Usb className="w-4 h-4 mr-2" />
                    Connect Printer
                  </Button>
                ) : (
                  <Button onClick={handleDisconnect} variant="outline" className="flex-1">
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Test Actions */}
          <div className="space-y-2">
            <Label>Test Printer</Label>
            <div className="flex gap-2">
              <Button 
                onClick={handleTest} 
                disabled={isTesting || (!isConnected && printMethod === 'serial')}
                variant="outline"
                className="flex-1"
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Printer className="w-4 h-4 mr-2" />
                Print Test Receipt
              </Button>
              
              {isConnected && (
                <Button 
                  onClick={handleOpenDrawer}
                  variant="outline"
                >
                  Open Drawer
                </Button>
              )}
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="space-y-2 pt-4 border-t">
            <Label>Setup Instructions</Label>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>For Direct USB/Serial Printing:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Connect your XPrinter 80mm to USB port</li>
                <li>Click "Connect Printer" button above</li>
                <li>Select your printer from the browser dialog</li>
                <li>Click "Print Test Receipt" to verify</li>
              </ol>
              
              <p className="mt-3"><strong>For Browser Print Dialog:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Set print method to "Browser Print Dialog"</li>
                <li>Configure your printer in Windows/System settings</li>
                <li>Set paper size to 80mm (3.15 inches) width</li>
                <li>When printing, select your thermal printer</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
