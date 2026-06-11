const SAVED_BT_KEY = 'bt_thermal_printer';

export interface SavedBtDeviceInfo {
  name: string;
  id: string;
}

const CHUNK_SIZE = 200;

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  get isConnected(): boolean {
    return this.device !== null && this.device.gatt?.connected === true && this.characteristic !== null;
  }

  getSavedDevice(): SavedBtDeviceInfo | null {
    try {
      const raw = localStorage.getItem(SAVED_BT_KEY);
      return raw ? (JSON.parse(raw) as SavedBtDeviceInfo) : null;
    } catch {
      return null;
    }
  }

  async requestAndConnect(): Promise<SavedBtDeviceInfo> {
    if (!this.isSupported) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.');
    }

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '00001800-0000-1000-8000-00805f9b34fb',
        '00001801-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ],
    });

    await this._connectGatt(device);

    const info: SavedBtDeviceInfo = {
      name: device.name || 'Unknown Printer',
      id: device.id,
    };
    localStorage.setItem(SAVED_BT_KEY, JSON.stringify(info));
    return info;
  }

  async autoConnect(): Promise<boolean> {
    if (!this.isSupported) return false;
    const saved = this.getSavedDevice();
    if (!saved) return false;

    try {
      const devices = await navigator.bluetooth.getDevices();
      const match = devices.find(d => d.id === saved.id);
      if (!match) return false;

      await this._connectGatt(match);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      try {
        this.device.gatt.disconnect();
      } catch {
        // ignore
      }
    }
    this.device = null;
    this.characteristic = null;
    localStorage.removeItem(SAVED_BT_KEY);
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Bluetooth thermal printer is not connected.');
    }

    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
      await new Promise(r => setTimeout(r, 20));
    }
  }

  private async _connectGatt(device: BluetoothDevice): Promise<void> {
    if (!device.gatt) {
      throw new Error('Device does not support GATT.');
    }

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          this.characteristic = char;
          this.device = device;
          device.addEventListener('gattserverdisconnected', () => {
            this.characteristic = null;
          });
          return;
        }
      }
    }

    throw new Error('No writable characteristic found. The device may not be a printer.');
  }
}

export const btPrinterService = new BluetoothPrinterService();
