/**
 * USB Printer Service — WebUSB connection management for the Xprinter XT-80P
 * (and any other USB Class 7 thermal printer).
 *
 * ⚠️  Windows note:
 * The Windows USB printer class driver (usbprint.sys) takes exclusive ownership
 * of the device, blocking WebUSB access.  Before using this service, you must
 * replace the driver with WinUSB using the Zadig tool:
 *   https://zadig.akeo.ie/
 * Select the printer, choose "WinUSB", click "Replace Driver".
 *
 * Only Chrome / Edge support the WebUSB API.
 */

const SAVED_DEVICE_KEY = 'thermal_printer_device';

export interface SavedDeviceInfo {
  vendorId: number;
  productId: number;
  manufacturerName?: string;
  productName?: string;
}

class USBPrinterService {
  private device: USBDevice | null = null;

  /** True if the browser supports the WebUSB API */
  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  /** True if a device is currently opened and claimed */
  get isConnected(): boolean {
    return this.device !== null && this.device.opened;
  }

  /** Returns device info stored in localStorage from a previous pairing, or null */
  getSavedDevice(): SavedDeviceInfo | null {
    try {
      const raw = localStorage.getItem(SAVED_DEVICE_KEY);
      return raw ? (JSON.parse(raw) as SavedDeviceInfo) : null;
    } catch {
      return null;
    }
  }

  /**
   * Opens the browser USB device picker.
   * Requires a user gesture (button click).
   * Saves the paired device info to localStorage for auto-reconnect.
   */
  async requestAndConnect(): Promise<SavedDeviceInfo> {
    if (!this.isSupported) {
      throw new Error(
        'WebUSB is not supported in this browser. Use Chrome or Edge.'
      );
    }

    const device = await navigator.usb.requestDevice({ filters: [] });
    await this._openDevice(device);

    const info: SavedDeviceInfo = {
      vendorId: device.vendorId,
      productId: device.productId,
      manufacturerName: device.manufacturerName,
      productName: device.productName,
    };
    localStorage.setItem(SAVED_DEVICE_KEY, JSON.stringify(info));
    return info;
  }

  /**
   * Tries to silently reconnect the previously paired device.
   * Call this on app startup/page load.
   * Returns true if reconnect succeeded.
   */
  async autoConnect(): Promise<boolean> {
    if (!this.isSupported) return false;
    const saved = this.getSavedDevice();
    if (!saved) return false;

    try {
      const devices = await navigator.usb.getDevices();
      const match = devices.find(
        d => d.vendorId === saved.vendorId && d.productId === saved.productId
      );
      if (!match) return false;

      await this._openDevice(match);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Releases the interface, closes the device, and removes the pairing from
   * localStorage.
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        const iface = this._findInterface();
        if (iface !== null) {
          await this.device.releaseInterface(iface);
        }
        await this.device.close();
      } catch {
        // Ignore errors on close
      }
      this.device = null;
    }
    localStorage.removeItem(SAVED_DEVICE_KEY);
  }

  /**
   * Sends raw bytes to the printer via the bulk OUT endpoint.
   * Splits data into 64-byte chunks to avoid USB buffer overflows.
   */
  async print(data: Uint8Array): Promise<void> {
    if (!this.device || !this.device.opened) {
      throw new Error('Thermal printer is not connected.');
    }

    const endpointNumber = this._findBulkOutEndpoint();
    if (endpointNumber === null) {
      throw new Error(
        'No bulk OUT endpoint found. The device may not be a printer.'
      );
    }

    const CHUNK = 64;
    for (let offset = 0; offset < data.length; offset += CHUNK) {
      await this.device.transferOut(endpointNumber, data.slice(offset, offset + CHUNK));
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async _openDevice(device: USBDevice): Promise<void> {
    try {
      await device.open();
    } catch (err: unknown) {
      const isDenied =
        (err instanceof DOMException && err.name === 'SecurityError') ||
        (err instanceof Error && err.message.toLowerCase().includes('access denied'));
      if (isDenied) {
        throw new Error(
          'ACCESS_DENIED: Windows is blocking WebUSB access to this printer.\n\n' +
          'You must replace the USB driver with WinUSB using the Zadig tool:\n' +
          '1. Download Zadig from https://zadig.akeo.ie/\n' +
          '2. Select your printer from the device list\n' +
          '3. Choose "WinUSB" as the driver\n' +
          '4. Click "Replace Driver" and wait for it to finish\n' +
          '5. Unplug and replug the printer, then try connecting again.'
        );
      }
      throw err;
    }

    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const interfaces = device.configuration!.interfaces;
    if (interfaces.length === 0) {
      throw new Error('USB device has no interfaces.');
    }

    // Prefer USB Printer Class (class 7); fall back to first interface
    const iface =
      interfaces.find(i => i.alternate.interfaceClass === 7) ?? interfaces[0];

    await device.claimInterface(iface.interfaceNumber);
    this.device = device;
  }

  private _findInterface(): number | null {
    if (!this.device?.configuration) return null;
    const interfaces = this.device.configuration.interfaces;
    const iface =
      interfaces.find(i => i.alternate.interfaceClass === 7) ?? interfaces[0];
    return iface?.interfaceNumber ?? null;
  }

  private _findBulkOutEndpoint(): number | null {
    if (!this.device?.configuration) return null;
    for (const iface of this.device.configuration.interfaces) {
      for (const ep of iface.alternate.endpoints) {
        if (ep.direction === 'out' && ep.type === 'bulk') {
          return ep.endpointNumber;
        }
      }
    }
    return null;
  }
}

// Singleton instance shared across the app
export const usbPrinterService = new USBPrinterService();
