/**
 * Browser notification service with sound support
 * Handles desktop notifications and audio alerts
 */

import { soundService, type SoundType } from './soundService';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  sound?: SoundType;
  requireInteraction?: boolean;
  data?: any;
  onClick?: () => void;
}

class NotificationService {
  private permission: NotificationPermission = 'default';
  private enabled: boolean = true;

  constructor() {
    // Check current permission status
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }

    // Load notification preferences
    const savedEnabled = localStorage.getItem('notifications_enabled');
    if (savedEnabled !== null) {
      this.enabled = savedEnabled === 'true';
    }
  }

  /**
   * Request notification permission from the user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Show a notification with optional sound
   */
  async show(options: NotificationOptions): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Play sound if specified
    if (options.sound) {
      await soundService.play(options.sound);
    }

    // Show desktop notification if permission granted
    if (this.permission === 'granted' && 'Notification' in window) {
      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icon-192.png',
          tag: options.tag,
          requireInteraction: options.requireInteraction || false,
          data: options.data
        });

        if (options.onClick) {
          notification.onclick = () => {
            options.onClick?.();
            notification.close();
          };
        }

        // Auto-close after 10 seconds if not requiring interaction
        if (!options.requireInteraction) {
          setTimeout(() => notification.close(), 10000);
        }
      } catch (error) {
        console.error('Failed to show notification:', error);
      }
    }
  }

  /**
   * Show notification for new order (Reception)
   */
  async notifyNewOrder(orderNumber: string, patientName: string): Promise<void> {
    await this.show({
      title: '🆕 New Order Created',
      body: `Order ${orderNumber} for ${patientName}`,
      tag: `order-${orderNumber}`,
      sound: 'new-order',
      icon: '/icon-192.png'
    });
  }

  /**
   * Show notification for urgent order (All users)
   */
  async notifyUrgentOrder(orderNumber: string, patientName: string): Promise<void> {
    await this.show({
      title: '🚨 URGENT Order',
      body: `STAT order ${orderNumber} for ${patientName}`,
      tag: `urgent-${orderNumber}`,
      sound: 'urgent-order',
      requireInteraction: true,
      icon: '/icon-192.png'
    });
  }

  /**
   * Show notification for sample collected (Lab)
   */
  async notifySampleCollected(orderNumber: string, patientName: string): Promise<void> {
    await this.show({
      title: '🧪 Sample Collected',
      body: `Sample ready for ${orderNumber} - ${patientName}`,
      tag: `sample-${orderNumber}`,
      sound: 'sample-collected',
      icon: '/icon-192.png'
    });
  }

  /**
   * Show notification for results ready (Reception)
   */
  async notifyResultsReady(orderNumber: string, patientName: string): Promise<void> {
    await this.show({
      title: '✅ Results Ready',
      body: `Results available for ${orderNumber} - ${patientName}`,
      tag: `results-${orderNumber}`,
      sound: 'results-ready',
      icon: '/icon-192.png'
    });
  }

  /**
   * Show notification for payment received (Reception)
   */
  async notifyPaymentReceived(orderNumber: string, amount: number): Promise<void> {
    await this.show({
      title: '💰 Payment Received',
      body: `Le ${amount.toLocaleString()} received for ${orderNumber}`,
      tag: `payment-${orderNumber}`,
      sound: 'payment-received',
      icon: '/icon-192.png'
    });
  }

  /**
   * Enable or disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('notifications_enabled', String(enabled));
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Check if notifications are supported and permitted
   */
  isSupported(): boolean {
    return 'Notification' in window && this.permission === 'granted';
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
