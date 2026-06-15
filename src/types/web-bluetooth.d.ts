// Web Bluetooth Scanning API (Chrome Android 등)
interface BluetoothLEScanFilter {
  name?: string
  namePrefix?: string
  services?: BluetoothServiceUUID[]
}

interface BluetoothLEScanOptions {
  filters?: BluetoothLEScanFilter[]
  keepRepeatedDevices?: boolean
  acceptAllAdvertisements?: boolean
}

interface BluetoothLEScan {
  active: boolean
  stop(): void
}

interface BluetoothAdvertisingEvent extends Event {
  device: BluetoothDevice
  name?: string
  rssi?: number
}

interface Bluetooth {
  requestLEScan?(options?: BluetoothLEScanOptions): Promise<BluetoothLEScan>
  addEventListener(
    type: 'advertisementreceived',
    listener: (event: BluetoothAdvertisingEvent) => void
  ): void
  removeEventListener(
    type: 'advertisementreceived',
    listener: (event: BluetoothAdvertisingEvent) => void
  ): void
}

interface Navigator {
  bluetooth?: Bluetooth
}
