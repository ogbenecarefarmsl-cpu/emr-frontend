const SAVED_BT_KEY = 'bt_thermal_printer';

export interface SavedBtDeviceInfo {
  name: string;
  id: string;
}

const CHUNK_SIZE = 50;
const CHUNK_DELAY = 30;
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _onDisconnect: (() => void) | null = null;
  private _onReconnect: (() => void) | null = null;

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  get isConnected(): boolean {
    return this.device !== null && this.device.gatt?.connected === true && this.characteristic !== null;
  }

  /** Register callbacks for connection state changes */
  onDisconnect(cb: () => void) { this._onDisconnect = cb; }
  onReconnect(cb: () => void) { this._onReconnect = cb; }

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
        '0000180a-0000-1000-8000-00805f9b34fb',
        '0000180f-0000-1000-8000-00805f9b34fb',
      ],
    });

    await this._connectGatt(device);

    const info: SavedBtDeviceInfo = {
      name: device.name || 'Unknown Printer',
      id: device.id,
    };
    localStorage.setItem(SAVED_BT_KEY, JSON.stringify(info));
    this.reconnectAttempts = 0;
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
      this.reconnectAttempts = 0;
      return true;
    } catch (err) {
      console.warn('BT auto-connect failed:', err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect
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

    console.log(`BT print: sending ${data.length} bytes in ${Math.ceil(data.length / CHUNK_SIZE)} chunks`);

    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      
      try {
        if (this.characteristic.properties.writeWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else if (this.characteristic.properties.write) {
          await this.characteristic.writeValue(chunk);
        } else {
          throw new Error('Characteristic does not support write operations');
        }
      } catch (err) {
        console.error(`BT write failed at offset ${offset}:`, err);
        throw err;
      }
      
      await new Promise(r => setTimeout(r, CHUNK_DELAY));
    }

    console.log('BT print: complete');
  }

  private _scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('BT: max reconnect attempts reached, giving up');
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY * this.reconnectAttempts;
    console.log(`BT: scheduling reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      try {
        const ok = await this.autoConnect();
        if (ok) {
          console.log('BT: reconnected successfully');
          this.reconnectAttempts = 0;
          this._onReconnect?.();
        } else {
          this._scheduleReconnect();
        }
      } catch {
        this._scheduleReconnect();
      }
    }, delay);
  }

  private async _connectGatt(device: BluetoothDevice): Promise<void> {
    if (!device.gatt) {
      throw new Error('Device does not support GATT.');
    }

    console.log('BT: connecting to GATT server...');
    const server = await device.gatt.connect();
    
    console.log('BT: discovering services...');
    const services = await server.getPrimaryServices();
    console.log(`BT: found ${services.length} services`);

    for (const service of services) {
      console.log(`BT: service ${service.uuid}`);
      const chars = await service.getCharacteristics();
      
      for (const char of chars) {
        console.log(`BT: char ${char.uuid} - write:${char.properties.write} writeWithoutResponse:${char.properties.writeWithoutResponse}`);
        
        if (char.properties.write || char.properties.writeWithoutResponse) {
          console.log('BT: found writable characteristic');
          this.characteristic = char;
          this.device = device;
          device.addEventListener('gattserverdisconnected', () => {
            console.log('BT: disconnected, will attempt reconnect');
            this.characteristic = null;
            this._onDisconnect?.();
            this._scheduleReconnect();
          });
          return;
        }
      }
    }

    throw new Error('No writable characteristic found. The device may not be a printer.');
  }
}

export const btPrinterService = new BluetoothPrinterService();
