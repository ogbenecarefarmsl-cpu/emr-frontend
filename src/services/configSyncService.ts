/**
 * Configuration Sync Service
 * Periodically syncs connection configuration from backend server
 * Ensures all clients use the same configuration set by admin
 */

import { connectionManager } from './connectionManager';

class ConfigSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private syncIntervalMs: number = 60000; // 1 minute default

  /**
   * Start syncing configuration from server
   */
  startSync(intervalMs: number = 60000) {
    this.syncIntervalMs = intervalMs;
    
    // Initial sync
    this.syncNow();

    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, this.syncIntervalMs);

    console.log(`🔄 Config sync started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop syncing
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ Config sync stopped');
    }
  }

  /**
   * Sync configuration now
   */
  async syncNow(): Promise<boolean> {
    try {
      // Get current backend URL
      const currentBackend = connectionManager.getCurrentBackend();
      
      if (!currentBackend) {
        console.log('⚠️ No backend available for config sync');
        return false;
      }

      // Try to sync from current backend
      const success = await connectionManager.syncConfigurationFromServer(currentBackend);
      
      if (success) {
        this.lastSyncTime = Date.now();
        console.log('✅ Configuration synced successfully');
        
        // Notify listeners that config was updated
        this.notifyConfigUpdate();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to sync configuration:', error);
      return false;
    }
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime > 0 ? new Date(this.lastSyncTime) : null;
  }

  /**
   * Notify that configuration was updated
   */
  private notifyConfigUpdate() {
    // Dispatch custom event for components to listen to
    window.dispatchEvent(new CustomEvent('config-updated'));
  }

  /**
   * Listen for configuration updates
   */
  onConfigUpdate(callback: () => void): () => void {
    const handler = () => callback();
    window.addEventListener('config-updated', handler);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener('config-updated', handler);
    };
  }
}

// Singleton instance
export const configSyncService = new ConfigSyncService();

// Auto-start sync when user is logged in
if (typeof window !== 'undefined') {
  // Check if user is logged in
  const token = localStorage.getItem('access_token');
  if (token) {
    // Start syncing after a short delay
    setTimeout(() => {
      configSyncService.startSync(60000); // Sync every 1 minute
    }, 5000); // Wait 5 seconds after app load
  }
}

export default configSyncService;
