import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface UpdateState {
  type: 'idle' | 'checking' | 'available' | 'not-available' | 'download-progress' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

const initialState: UpdateState = { type: 'idle' };

export function UpdateBanner() {
  const isElectron = !!window.electronAPI?.isElectron;
  const [state, setState] = useState<UpdateState>(initialState);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onUpdateStatus) return;

    const unsubscribe = window.electronAPI.onUpdateStatus((payload) => {
      setDismissed(false);
      if (payload.type === 'checking') {
        setState({ type: 'checking' });
      } else if (payload.type === 'available') {
        setState({ type: 'available', version: payload.version });
      } else if (payload.type === 'not-available') {
        setState({ type: 'not-available' });
      } else if (payload.type === 'download-progress') {
        setState({
          type: 'download-progress',
          percent: payload.percent ?? 0,
          version: payload.version,
        });
      } else if (payload.type === 'downloaded') {
        setState({ type: 'downloaded', version: payload.version });
      } else if (payload.type === 'error') {
        setState({ type: 'error', message: payload.message || 'Update failed.' });
      }
    });

    return unsubscribe;
  }, [isElectron]);

  const canCheck = isElectron && !!window.electronAPI?.checkForUpdates;

  const bannerText = useMemo(() => {
    switch (state.type) {
      case 'checking':
        return {
          title: 'Checking for updates',
          description: 'Looking for the latest desktop version.',
        };
      case 'available':
        return {
          title: 'Update found',
          description: state.version
            ? `Version ${state.version} is available and is downloading in the background.`
            : 'A new version is available and is downloading in the background.',
        };
      case 'download-progress':
        return {
          title: 'Downloading update',
          description: `${state.percent ?? 0}% complete.`,
        };
      case 'downloaded':
        return {
          title: 'Update ready to install',
          description: state.version
            ? `Version ${state.version} is ready. Restart now to apply it.`
            : 'A new version is ready. Restart now to apply it.',
        };
      case 'not-available':
        return {
          title: 'You are up to date',
          description: 'No newer desktop version is currently available.',
        };
      case 'error':
        return {
          title: 'Update check failed',
          description: state.message || 'Please try again.',
        };
      default:
        return {
          title: 'Desktop updates',
          description: 'Check for updates from this dashboard.',
        };
    }
  }, [state]);

  const handleCheckUpdates = async () => {
    if (!window.electronAPI?.checkForUpdates) return;

    setIsChecking(true);
    setDismissed(false);
    const result = await window.electronAPI.checkForUpdates();
    if (!result.success) {
      setState({ type: 'error', message: result.error || 'Failed to check for updates.' });
    }
    setIsChecking(false);
  };

  const handleInstallNow = async () => {
    if (!window.electronAPI?.installUpdateNow) return;

    setIsInstalling(true);
    const result = await window.electronAPI.installUpdateNow();
    if (!result.success) {
      setState({ type: 'error', message: result.error || 'Failed to install update.' });
      setIsInstalling(false);
    }
  };

  if (!isElectron) return null;
  if (dismissed && state.type !== 'downloaded') return null;

  return (
    <div className="border-b bg-muted/40 px-6 py-3">
      <Alert className="border-primary/20 bg-background">
        <Download className="h-4 w-4" />
        <AlertTitle>{bannerText.title}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span>{bannerText.description}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckUpdates}
              disabled={!canCheck || isChecking || isInstalling}
            >
              <RefreshCw className={isChecking ? 'animate-spin' : ''} />
              {isChecking ? 'Checking...' : 'Check Updates'}
            </Button>
            {state.type === 'downloaded' && (
              <Button
                type="button"
                size="sm"
                onClick={handleInstallNow}
                disabled={isInstalling}
              >
                {isInstalling ? 'Restarting...' : 'Restart & Update'}
              </Button>
            )}
            {state.type !== 'downloaded' && state.type !== 'idle' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
              >
                Dismiss
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
