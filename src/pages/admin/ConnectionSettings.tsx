import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConnectionStatusDetailed } from '@/components/connection/ConnectionStatus';
import { connectionManager } from '@/services/connectionManager';
import { configSyncService } from '@/services/configSyncService';
import api from '@/services/api';
import { Server, Cloud, Wifi, Save, RefreshCw, AlertCircle, CheckCircle, Users } from 'lucide-react';

interface ConnectionConfig {
  localUrl: string;
  cloudUrl: string;
  localTimeout: number;
  cloudTimeout: number;
  monitoringInterval: number;
}

export default function ConnectionSettings() {
  const [config, setConfig] = useState<ConnectionConfig>({
    localUrl: '',
    cloudUrl: '',
    localTimeout: 2000,
    cloudTimeout: 5000,
    monitoringInterval: 30000,
  });

  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    local: { status: 'idle' | 'testing' | 'success' | 'failed'; message: string };
    cloud: { status: 'idle' | 'testing' | 'success' | 'failed'; message: string };
  }>({
    local: { status: 'idle', message: '' },
    cloud: { status: 'idle', message: '' },
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    // Load current configuration
    loadConfiguration();
    
    // Get last sync time
    const syncTime = configSyncService.getLastSyncTime();
    setLastSync(syncTime);

    // Listen for config updates
    const unsubscribe = configSyncService.onConfigUpdate(() => {
      loadConfiguration();
      setLastSync(new Date());
    });

    return unsubscribe;
  }, []);

  const loadConfiguration = () => {
    // Load from localStorage (where we'll store the config)
    const saved = localStorage.getItem('connection_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    } else {
      // Set defaults from environment
      setConfig({
        localUrl: import.meta.env.VITE_LOCAL_API_URL || 'http://192.168.1.100:3000',
        cloudUrl: import.meta.env.VITE_CLOUD_API_URL || 'https://carefam-lab-1e0cbe42a3ac.herokuapp.com',
        localTimeout: 2000,
        cloudTimeout: 5000,
        monitoringInterval: 30000,
      });
    }
  };

  const testConnection = async (url: string, timeout: number): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const handleTestLocal = async () => {
    setTestResults(prev => ({
      ...prev,
      local: { status: 'testing', message: 'Testing connection...' },
    }));

    const success = await testConnection(config.localUrl, config.localTimeout);

    setTestResults(prev => ({
      ...prev,
      local: {
        status: success ? 'success' : 'failed',
        message: success
          ? 'Local network server is reachable'
          : 'Cannot reach local network server',
      },
    }));
  };

  const handleTestCloud = async () => {
    setTestResults(prev => ({
      ...prev,
      cloud: { status: 'testing', message: 'Testing connection...' },
    }));

    const success = await testConnection(config.cloudUrl, config.cloudTimeout);

    setTestResults(prev => ({
      ...prev,
      cloud: {
        status: success ? 'success' : 'failed',
        message: success ? 'Cloud server is reachable' : 'Cannot reach cloud server',
      },
    }));
  };

  const handleTestAll = async () => {
    setTesting(true);
    await Promise.all([handleTestLocal(), handleTestCloud()]);
    setTesting(false);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveMessage('');

    try {
      // Validate URLs
      if (!config.localUrl && !config.cloudUrl) {
        throw new Error('At least one backend URL must be configured');
      }

      // Save to backend (this will sync to all clients)
      try {
        await api.post('/settings/connection/config', config);
        console.log('✅ Configuration saved to backend');
      } catch (backendError) {
        console.warn('⚠️ Failed to save to backend, saving locally only:', backendError);
      }

      // Save to localStorage as fallback
      localStorage.setItem('connection_config', JSON.stringify(config));

      // Reload connection manager configuration
      connectionManager.reloadConfiguration();

      // Force immediate connection check
      await connectionManager.getBestBackend().catch(() => {
        // Ignore error, just checking connection
      });

      // Trigger sync on all clients
      await configSyncService.syncNow();

      setSaveStatus('success');
      setSaveMessage(
        'Settings saved successfully! All users will receive the updated configuration within 1 minute.'
      );

      // Show success for 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 5000);
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save settings');
    }
  };

  const handleReset = () => {
    localStorage.removeItem('connection_config');
    loadConfiguration();
    setSaveMessage('Settings reset to defaults');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Connection Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure backend servers and connection behavior
        </p>
      </div>

      {/* Current Status */}
      <div className="mb-6">
        <ConnectionStatusDetailed />
      </div>

      {/* Sync Status */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <Users className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Centralized Configuration:</strong> Changes made here will automatically sync to
          all users within 1 minute.
          {lastSync && (
            <span className="block mt-1 text-sm">
              Last synced: {lastSync.toLocaleTimeString()}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Local Network Server */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Local Network Server
          </CardTitle>
          <CardDescription>
            Configure your local area network (LAN) server for fastest performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="localUrl">Server URL</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="localUrl"
                value={config.localUrl}
                onChange={(e) => setConfig({ ...config, localUrl: e.target.value })}
                placeholder="http://192.168.1.100:3000"
                className="flex-1"
              />
              <Button
                onClick={handleTestLocal}
                disabled={!config.localUrl || testResults.local.status === 'testing'}
                variant="outline"
              >
                {testResults.local.status === 'testing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                <span className="ml-2">Test</span>
              </Button>
            </div>
            {testResults.local.status !== 'idle' && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                {getStatusIcon(testResults.local.status)}
                <span
                  className={
                    testResults.local.status === 'success'
                      ? 'text-green-600'
                      : testResults.local.status === 'failed'
                      ? 'text-red-600'
                      : 'text-blue-600'
                  }
                >
                  {testResults.local.message}
                </span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="localTimeout">Connection Timeout (milliseconds)</Label>
            <Input
              id="localTimeout"
              type="number"
              value={config.localTimeout}
              onChange={(e) =>
                setConfig({ ...config, localTimeout: parseInt(e.target.value) || 2000 })
              }
              min="500"
              max="10000"
              step="500"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              How long to wait before trying cloud server (recommended: 2000ms)
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              To set up a local network server, install the backend on one computer in your lab
              and enter its IP address above. See documentation for detailed setup instructions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Cloud Server */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Cloud Server
          </CardTitle>
          <CardDescription>
            Configure cloud backup server (Heroku) for reliable fallback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cloudUrl">Server URL</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="cloudUrl"
                value={config.cloudUrl}
                onChange={(e) => setConfig({ ...config, cloudUrl: e.target.value })}
                placeholder="https://your-app.herokuapp.com"
                className="flex-1"
              />
              <Button
                onClick={handleTestCloud}
                disabled={!config.cloudUrl || testResults.cloud.status === 'testing'}
                variant="outline"
              >
                {testResults.cloud.status === 'testing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                <span className="ml-2">Test</span>
              </Button>
            </div>
            {testResults.cloud.status !== 'idle' && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                {getStatusIcon(testResults.cloud.status)}
                <span
                  className={
                    testResults.cloud.status === 'success'
                      ? 'text-green-600'
                      : testResults.cloud.status === 'failed'
                      ? 'text-red-600'
                      : 'text-blue-600'
                  }
                >
                  {testResults.cloud.message}
                </span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="cloudTimeout">Connection Timeout (milliseconds)</Label>
            <Input
              id="cloudTimeout"
              type="number"
              value={config.cloudTimeout}
              onChange={(e) =>
                setConfig({ ...config, cloudTimeout: parseInt(e.target.value) || 5000 })
              }
              min="1000"
              max="30000"
              step="1000"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              How long to wait before going offline (recommended: 5000ms)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>Fine-tune connection monitoring behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="monitoringInterval">Monitoring Interval (milliseconds)</Label>
            <Input
              id="monitoringInterval"
              type="number"
              value={config.monitoringInterval}
              onChange={(e) =>
                setConfig({
                  ...config,
                  monitoringInterval: parseInt(e.target.value) || 30000,
                })
              }
              min="5000"
              max="300000"
              step="5000"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              How often to check connection status (recommended: 30000ms / 30 seconds)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <Button onClick={handleTestAll} disabled={testing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
          Test All Connections
        </Button>

        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline">
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="min-w-[120px]"
          >
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Save Status Message */}
      {saveMessage && (
        <Alert className={`mt-4 ${saveStatus === 'success' ? 'border-green-500' : 'border-red-500'}`}>
          {saveStatus === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      {/* Help Section */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Local Network Server:</strong> Set up one computer in your lab to run the
            backend. This provides the fastest performance (10-50ms response time).
          </p>
          <p>
            <strong>Cloud Server:</strong> Your Heroku backend serves as a reliable fallback when
            the local network is unavailable.
          </p>
          <p>
            <strong>Offline Mode:</strong> When both servers are unavailable, operations are queued
            locally and synced when connection is restored.
          </p>
          <p className="pt-2">
            <strong>To find your local IP:</strong> Run <code className="bg-blue-100 px-1 rounded">node scripts/find-local-ip.js</code> in the terminal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
