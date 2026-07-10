import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSync } from '@/context/SyncContext';
import { useState } from 'react';
import { 
  Building2, 
  Globe, 
  Shield, 
  Database, 
  Bell,
  Plug,
  Wifi,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

export default function Settings() {
  const { connectionMode, lanBackendUrl, setServerUrl, isApiReachable } = useSync();
  const { profile } = useAuth();
  const [serverIp, setServerIp] = useState(lanBackendUrl || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTestConnection = async () => {
    const url = serverIp.trim();
    if (!url) return;
    // Ensure it starts with http
    const fullUrl = url.startsWith('http') ? url : `http://${url}`;
    setTesting(true);
    setTestResult(null);
    const error = await setServerUrl(fullUrl);
    setTesting(false);
    if (error) {
      setTestResult({ ok: false, msg: error });
    } else {
      setTestResult({ ok: true, msg: 'Connected successfully!' });
    }
  };

  const settingsSections = [
    {
      id: 'organization',
      title: 'Organization',
      description: 'Clinic name, address, and contact information',
      icon: Building2,
    },
    {
      id: 'interfaces',
      title: 'Interface Settings',
      description: 'HL7, ASTM, and FHIR protocol configuration',
      icon: Plug,
    },
    {
      id: 'network',
      title: 'Network',
      description: 'IP ranges, ports, and firewall settings',
      icon: Globe,
    },
    {
      id: 'security',
      title: 'Security',
      description: 'User roles, permissions, and audit settings',
      icon: Shield,
    },
    {
      id: 'database',
      title: 'Database',
      description: 'Backup, retention, and storage configuration',
      icon: Database,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Critical alerts, email, and SMS settings',
      icon: Bell,
    },
  ];

  return (
    <RoleLayout title="Settings" subtitle="Configure system preferences" role="admin" userName={profile?.fullName}>
      <div className="max-w-4xl">
        {/* Server Connection */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Wifi className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Server Connection</h2>
            <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
              connectionMode === 'online' ? 'bg-status-normal/15 text-status-normal' :
              connectionMode === 'lan-only' ? 'bg-primary/10 text-primary' :
              'bg-status-critical/15 text-status-critical'
            }`}>
              {connectionMode === 'online' ? 'Online' : connectionMode === 'lan-only' ? 'LAN Connected' : 'Offline'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            If the app can't find the server automatically, enter the server IP address here.
            Both machines must be on the same WiFi network.
          </p>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground">Server Address</label>
              <Input
                className="mt-1"
                placeholder="e.g. 192.168.1.100:3000"
                value={serverIp}
                onChange={(e) => { setServerIp(e.target.value); setTestResult(null); }}
              />
              {isApiReachable && lanBackendUrl && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Currently connected to {lanBackendUrl}
                </p>
              )}
            </div>
            <Button
              className="mt-6"
              onClick={handleTestConnection}
              disabled={testing || !serverIp.trim()}
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {testing ? 'Testing…' : 'Connect'}
            </Button>
          </div>
          {testResult && (
            <div className={`mt-3 flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.msg}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Tip: On the server computer, find its IP with <code>ipconfig</code> (Windows) or <code>ifconfig</code> (Mac/Linux).
            The default port is <code>3000</code>.
          </p>
        </div>

        {/* Quick Settings */}
        <div className="bg-card border rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Facility Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Facility Name</label>
              <Input defaultValue="Harbour EMR" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">License Number</label>
              <Input defaultValue="LAB-2024-001234" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">HL7 Facility ID</label>
              <Input defaultValue="CDL001" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Default Protocol</label>
              <Input defaultValue="HL7 v2.5.1" className="mt-1" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button>Save Changes</Button>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-2 gap-4">
          {settingsSections.map(section => (
            <div 
              key={section.id}
              className="bg-card border rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <section.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{section.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Protocol Support Info */}
        <div className="mt-6 bg-muted/50 border rounded-lg p-6">
          <h3 className="font-semibold mb-3">Supported Protocols & Manufacturers</h3>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <p className="font-medium text-muted-foreground mb-2">Protocols</p>
              <ul className="space-y-1">
                <li>• HL7 v2.3.1, v2.5, v2.5.1</li>
                <li>• ASTM E1381, E1394</li>
                <li>• LIS2-A2 (CLSI)</li>
                <li>• FHIR R4</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-2">Supported Analyzers</p>
              <ul className="space-y-1">
                <li>• ZYBIO (WX200, Z5, Z3)</li>
                <li>• Finecare (FIA Meter, FS-113)</li>
                <li>• Mindray (BC-5000, BS-240)</li>
                <li>• Sysmex (XN Series)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-2">Test Categories</p>
              <ul className="space-y-1">
                <li>• Hematology</li>
                <li>• Clinical Chemistry</li>
                <li>• Immunoassay</li>
                <li>• Coagulation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}

