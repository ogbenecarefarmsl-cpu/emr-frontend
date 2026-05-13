import { useState } from 'react';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useMachines, useTestMachineConnection, useUpdateMachine, useCreateMachine, useRestartListener, useListenerStatus, type Machine, type MachineCreate } from '@/hooks/useMachines';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Settings, Wifi, WifiOff, Activity, Send, CheckCircle, XCircle, Loader2, RotateCw, Radio, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LiveConnectionMonitor } from '@/components/machines/LiveConnectionMonitor';

type MachineStatus = Machine['status'];
type MachineProtocol = Machine['protocol'];

export default function Machines() {
  const { profile, primaryRole } = useAuth();
  const { data: machines, isLoading, refetch } = useMachines();
  const testConnection = useTestMachineConnection();
  const updateMachine = useUpdateMachine();
  const createMachine = useCreateMachine();
  const restartListener = useRestartListener();
  const { data: listenerStatuses } = useListenerStatus();
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string; listenerActive?: boolean; analyzerReachable?: boolean }>({ status: 'idle' });

  const statusConfig: Record<MachineStatus, { indicator: string; label: string; icon: typeof Wifi; labelClass: string }> = {
    online: {
      indicator: 'machine-online',
      label: 'Online',
      icon: Wifi,
      labelClass: 'text-status-normal',
    },
    offline: {
      indicator: 'machine-offline',
      label: 'Offline',
      icon: WifiOff,
      labelClass: 'text-muted-foreground',
    },
    error: {
      indicator: 'machine-error',
      label: 'Error',
      icon: WifiOff,
      labelClass: 'text-status-critical',
    },
    processing: {
      indicator: 'machine-processing',
      label: 'Processing',
      icon: Activity,
      labelClass: 'text-primary',
    },
  };

  const handleTestConnection = async (machine: Machine) => {
    setSelectedMachine(machine);
    setIsTestOpen(true);
    setTestResult({ status: 'testing' });
    
    try {
      const result = await testConnection.mutateAsync({ machineId: machine.id });
      if (result.success) {
        setTestResult({ status: 'success', message: result.message, listenerActive: result.listenerActive, analyzerReachable: result.analyzerReachable });
        toast.success(`Connection to ${machine.name} successful`);
      } else {
        setTestResult({ status: 'error', message: result.message, listenerActive: result.listenerActive, analyzerReachable: result.analyzerReachable });
        toast.error(`Connection issue: ${result.message}`);
      }
      refetch();
    } catch (error) {
      setTestResult({ status: 'error', message: 'Unexpected error during connection test' });
      toast.error(`Failed to connect to ${machine.name}`);
    }
  };

  const handleRefreshStatus = async () => {
    await refetch();
    toast.success('Machine status refreshed');
  };

  const handleRestartListener = async (machine: Machine) => {
    try {
      await restartListener.mutateAsync({ machineId: machine.id });
      toast.success(`TCP listener restarted for ${machine.name}`);
    } catch (error) {
      toast.error(`Failed to restart listener for ${machine.name}`);
    }
  };

  const handleDownloadBridge = async (machine: Machine) => {
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/machines/${machine.id}/bridge-script`;
    
    try {
      const response = await fetch(`${url}?token=${token}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const filename = `harbour-bridge-${(machine.name || 'machine').replace(/\s+/g, '-').toLowerCase()}.bat`;
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      
      toast.success('Bridge script downloaded — double-click to run on the lab laptop');
    } catch (error) {
      toast.error('Failed to download bridge script');
    }
  };

  const getListenerStatus = (machineId: string): boolean => {
    return listenerStatuses?.some(s => s.machineId === machineId && s.listening) ?? false;
  };

  const handleConfigSave = async (updates: Partial<Machine>) => {
    if (!selectedMachine) return;
    
    try {
      await updateMachine.mutateAsync({
        id: selectedMachine.id,
        updates,
      });
      toast.success('Machine configuration saved');
      setIsConfigOpen(false);
      refetch();
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const handleAddMachine = async (data: MachineCreate) => {
    try {
      await createMachine.mutateAsync(data);
      toast.success('Machine added successfully');
      setIsAddOpen(false);
    } catch (error) {
      toast.error('Failed to add machine');
    }
  };

  if (isLoading) {
    return (
      <RoleLayout 
        title="Machines" 
        subtitle="Configure and monitor laboratory analyzers"
        role={primaryRole === 'admin' ? 'admin' : 'lab_tech'}
        userName={profile?.full_name}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout 
      title="Machines" 
      subtitle="Configure and monitor laboratory analyzers"
      role={primaryRole === 'admin' ? 'admin' : 'lab_tech'}
      userName={profile?.full_name}
    >
      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRefreshStatus}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Status
          </Button>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Machine
        </Button>
      </div>

      {/* Live Connection Monitor */}
      <div className="mb-6">
        <LiveConnectionMonitor />
      </div>

      {/* Machines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {machines?.map(machine => {
          const config = statusConfig[machine.status];
          const StatusIcon = config.icon;
          
          return (
            <div key={machine.id} className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <StatusIcon className={cn('w-7 h-7', config.labelClass)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{machine.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {machine.manufacturer} {machine.modelName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('machine-indicator', config.indicator)} />
                  <span className={cn('text-sm font-medium', config.labelClass)}>
                    {config.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Serial Number</p>
                  <p className="font-mono text-sm">{machine.serialNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Protocol</p>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {machine.protocol}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                  <p className="font-mono text-sm">
                    {machine.ipAddress ? `${machine.ipAddress}:${machine.port}` : 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Last Communication</p>
                  <p className="text-sm">
                    {machine.lastCommunication 
                      ? new Date(machine.lastCommunication).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Supported Tests</p>
                <div className="flex flex-wrap gap-1">
                  {machine.testsSupported?.slice(0, 6).map(test => (
                    <span key={test} className="px-2 py-1 bg-muted rounded text-xs font-medium">
                      {test}
                    </span>
                  ))}
                  {(machine.testsSupported?.length || 0) > 6 && (
                    <span className="px-2 py-1 bg-muted rounded text-xs">
                      +{(machine.testsSupported?.length || 0) - 6}
                    </span>
                  )}
                </div>
              </div>

              {/* Listener Status */}
              {machine.ipAddress && machine.port && (
                <div className="flex items-center gap-2 mb-4">
                  <Radio className={cn('w-3 h-3', getListenerStatus(machine.id) ? 'text-status-normal animate-pulse' : 'text-muted-foreground')} />
                  <span className="text-xs text-muted-foreground">
                    TCP Listener: {getListenerStatus(machine.id) ? 'Active' : 'Inactive'}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedMachine(machine);
                    setIsConfigOpen(true);
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleTestConnection(machine)}
                  disabled={testConnection.isPending}
                >
                  {testConnection.isPending && selectedMachine?.id === machine.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                {machine.ipAddress && machine.port && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestartListener(machine)}
                      disabled={restartListener.isPending}
                      title="Restart TCP Listener"
                    >
                      {restartListener.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCw className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadBridge(machine)}
                      title="Download Bridge Script for Lab Laptop"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* No machines */}
      {(!machines || machines.length === 0) && (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <WifiOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Analyzers Configured</h3>
          <p className="text-muted-foreground mb-4">Add your laboratory analyzers to enable automatic result transmission.</p>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Machine
          </Button>
        </div>
      )}

      {/* Add Machine Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>
              Register a new laboratory analyzer in the system.
            </DialogDescription>
          </DialogHeader>
          <AddMachineForm onSave={handleAddMachine} onCancel={() => setIsAddOpen(false)} isSaving={createMachine.isPending} />
        </DialogContent>
      </Dialog>

      {/* Configuration Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure {selectedMachine?.name}</DialogTitle>
            <DialogDescription>
              Update the network and communication settings for this analyzer.
            </DialogDescription>
          </DialogHeader>
          
          {selectedMachine && (
            <MachineConfigForm 
              machine={selectedMachine} 
              onSave={handleConfigSave}
              onCancel={() => setIsConfigOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Test Connection Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Test: {selectedMachine?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="py-6 text-center">
            {testResult.status === 'testing' && (
              <>
                <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium">Testing connection...</p>
                <p className="text-muted-foreground text-sm">
                  Checking TCP listener and network reachability
                </p>
              </>
            )}
            {testResult.status === 'success' && (
              <>
                <CheckCircle className="w-16 h-16 text-status-normal mx-auto mb-4" />
                <p className="text-lg font-medium text-status-normal">Connection Successful</p>
                <div className="mt-4 space-y-2 text-left max-w-sm mx-auto">
                  <div className="flex items-center gap-2 text-sm">
                    {testResult.listenerActive !== false ? <CheckCircle className="w-4 h-4 text-status-normal" /> : <XCircle className="w-4 h-4 text-status-critical" />}
                    <span>TCP Listener on port {selectedMachine?.port}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {testResult.analyzerReachable !== false ? <CheckCircle className="w-4 h-4 text-status-normal" /> : <XCircle className="w-4 h-4 text-status-critical" />}
                    <span>Analyzer at {selectedMachine?.ipAddress} reachable</span>
                  </div>
                </div>
              </>
            )}
            {testResult.status === 'error' && (
              <>
                <XCircle className="w-16 h-16 text-status-critical mx-auto mb-4" />
                <p className="text-lg font-medium text-status-critical">Connection Failed</p>
                <div className="mt-4 space-y-2 text-left max-w-sm mx-auto">
                  <div className="flex items-center gap-2 text-sm">
                    {testResult.listenerActive ? <CheckCircle className="w-4 h-4 text-status-normal" /> : <XCircle className="w-4 h-4 text-status-critical" />}
                    <span>TCP Listener on port {selectedMachine?.port}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {testResult.analyzerReachable ? <CheckCircle className="w-4 h-4 text-status-normal" /> : <XCircle className="w-4 h-4 text-status-critical" />}
                    <span>Analyzer at {selectedMachine?.ipAddress} reachable</span>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mt-4">
                  {testResult.message || 'Check network settings and ensure the analyzer is powered on.'}
                </p>
              </>
            )}
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsTestOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleLayout>
  );
}

// Add Machine Form Component
function AddMachineForm({
  onSave,
  onCancel,
  isSaving,
}: {
  onSave: (data: MachineCreate) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<MachineCreate>({
    name: '',
    manufacturer: '',
    modelName: '',
    serialNumber: '',
    protocol: 'HL7',
    ipAddress: '',
    port: 5000,
    testsSupported: [],
  });
  const [testsInput, setTestsInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      testsSupported: testsInput ? testsInput.split(',').map(s => s.trim()).filter(Boolean) : [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="add-name">Name *</Label>
          <Input id="add-name" required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-manufacturer">Manufacturer *</Label>
          <Input id="add-manufacturer" required value={formData.manufacturer} onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-model">Model *</Label>
          <Input id="add-model" required value={formData.modelName} onChange={(e) => setFormData(prev => ({ ...prev, modelName: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-serial">Serial Number *</Label>
          <Input id="add-serial" required value={formData.serialNumber} onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-protocol">Protocol *</Label>
          <Select value={formData.protocol} onValueChange={(v) => setFormData(prev => ({ ...prev, protocol: v as MachineProtocol }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HL7">HL7 v2.5.1</SelectItem>
              <SelectItem value="ASTM">ASTM E1394</SelectItem>
              <SelectItem value="LIS2_A2">LIS2-A2</SelectItem>
              <SelectItem value="FHIR">FHIR R4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-port">Port</Label>
          <Input id="add-port" type="number" value={formData.port} onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 5000 }))} />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="add-ip">IP Address</Label>
          <Input id="add-ip" placeholder="192.168.1.100" value={formData.ipAddress || ''} onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))} />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="add-tests">Supported Test Codes</Label>
          <Input id="add-tests" placeholder="CBC, WBC, RBC, HGB" value={testsInput} onChange={(e) => setTestsInput(e.target.value)} />
          <p className="text-xs text-muted-foreground">Comma-separated test codes matching your test catalog.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Add Machine
        </Button>
      </div>
    </form>
  );
}

// Configuration Form Component
function MachineConfigForm({ 
  machine, 
  onSave, 
  onCancel 
}: { 
  machine: Machine; 
  onSave: (updates: Partial<Machine>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: machine.name,
    manufacturer: machine.manufacturer,
    modelName: machine.modelName,
    serialNumber: machine.serialNumber || '',
    protocol: machine.protocol,
    ipAddress: machine.ipAddress || '',
    port: machine.port?.toString() || '5000',
    testsSupported: machine.testsSupported?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      manufacturer: formData.manufacturer,
      modelName: formData.modelName,
      serialNumber: formData.serialNumber || undefined,
      protocol: formData.protocol as MachineProtocol,
      ipAddress: formData.ipAddress || undefined,
      port: formData.port ? parseInt(formData.port) : undefined,
      testsSupported: formData.testsSupported 
        ? formData.testsSupported.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.modelName}
                onChange={(e) => setFormData(prev => ({ ...prev, modelName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={formData.serialNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
              />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="network" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol</Label>
              <Select 
                value={formData.protocol} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, protocol: value as MachineProtocol }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HL7">HL7 v2.5.1</SelectItem>
                  <SelectItem value="ASTM">ASTM E1394</SelectItem>
                  <SelectItem value="LIS2_A2">LIS2-A2</SelectItem>
                  <SelectItem value="FHIR">FHIR R4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="ip">IP Address</Label>
              <Input
                id="ip"
                placeholder="192.168.1.100"
                value={formData.ipAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="p-4 bg-muted/50 rounded-lg space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">TCP Bridge Setup (Recommended)</h4>
              <p className="text-xs text-muted-foreground mb-2">
                For direct TCP connections from analyzers, run the HARBOUR TCP Bridge on your local network:
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside mb-3">
                <li>Download the TCP Bridge from <code className="bg-background px-1 rounded">middleware/tcp-bridge/</code></li>
                <li>Install: <code className="bg-background px-1 rounded">npm install</code></li>
                <li>Configure <code className="bg-background px-1 rounded">.env</code> with settings below</li>
                <li>Start: <code className="bg-background px-1 rounded">npm start</code></li>
              </ol>
              <div className="bg-background p-3 rounded text-xs font-mono space-y-1">
                <p>TCP_PORT=5000</p>
                <p>PROTOCOL={formData.protocol}</p>
                <p>MACHINE_ID={machine.id}</p>
                <p>ENDPOINT_URL={import.meta.env.VITE_API_URL || 'http://localhost:3000'}/hl7/receive</p>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Direct HTTP Endpoint</h4>
              <p className="text-xs text-muted-foreground mb-2">
                For analyzers with HTTP support, configure to send messages to:
              </p>
              <code className="text-xs bg-background px-2 py-1 rounded block">
                POST {import.meta.env.VITE_API_URL || 'http://localhost:3000'}/hl7/receive
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                Include header: <code className="bg-background px-1 rounded">x-machine-id: {machine.id}</code>
              </p>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="tests" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="tests">Supported Test Codes</Label>
            <Input
              id="tests"
              placeholder="CBC, WBC, RBC, HGB, PLT"
              value={formData.testsSupported}
              onChange={(e) => setFormData(prev => ({ ...prev, testsSupported: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Enter test codes separated by commas. These should match your test catalog codes.
            </p>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Changes
        </Button>
      </div>
    </form>
  );
}
