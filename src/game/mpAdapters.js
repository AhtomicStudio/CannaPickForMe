/**
 * CannaGotchi — Multiplayer Transport Adapters
 *
 * Each adapter exposes the same interface:
 *   open({ role: 'host'|'guest' }) → Promise<void>
 *   send(msgObject)
 *   onMessage(fn)
 *   close()
 *   describe → string
 *
 * Three transports are implemented here:
 *   • capBleAdapter — Capacitor BLE (iOS / Android native).
 *                     Uses @capacitor-community/bluetooth-le. Loaded lazily
 *                     so the bundle stays small for web users.
 *   • webBleAdapter — Web Bluetooth (Chrome / Edge desktop).
 *   • qrCodeAdapter — Asymmetric QR exchange. Host displays a QR with the
 *                     full opening message; guest enters the resulting
 *                     short code. Battles run locally on each device with
 *                     synchronized RNG seed.
 *
 * The chosen UUIDs are stable across builds — both peers must agree.
 */

const SERVICE_UUID  = '0000c91d-0000-1000-8000-00805f9b34fb'; // CGTC
const TX_CHAR_UUID  = '0000c91e-0000-1000-8000-00805f9b34fb';
const RX_CHAR_UUID  = '0000c91f-0000-1000-8000-00805f9b34fb';
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

// ── Capacitor BLE ────────────────────────────────────────────
export function capBleAdapter() {
  let BleClient = null;
  let listener = () => {};
  let connectedDevice = null;
  let isHost = false;

  async function ensureClient() {
    // Lazy import so a non-Capacitor build doesn't choke at parse time.
    const mod = await import('@capacitor-community/bluetooth-le').catch(() => null);
    if (!mod) {
      throw Object.assign(new Error('Bluetooth LE plugin not installed. Run: npm i @capacitor-community/bluetooth-le && npx cap sync'),
        { code: 'PLUGIN_MISSING' });
    }
    BleClient = mod.BleClient;
    await BleClient.initialize({ androidNeverForLocation: true });
  }

  return {
    async open({ role }) {
      isHost = role === 'host';
      await ensureClient();
      if (isHost) {
        // NOTE on advertising: the Capacitor plugin's stable surface today is
        // central-mode (scanning). Acting as a peripheral requires the
        // @arkandos/capacitor-blepe-peripheral fork or a similar extension.
        // The pattern is: host enables peripheral mode + advertises SERVICE_UUID,
        // guest scans/connects, both subscribe to RX/TX notifications.
        throw Object.assign(new Error('BLE host mode requires a peripheral plugin extension on this platform.'),
          { code: 'HOST_NOT_AVAILABLE_HERE' });
      } else {
        const device = await BleClient.requestDevice({ services: [SERVICE_UUID] });
        await BleClient.connect(device.deviceId);
        connectedDevice = device.deviceId;
        await BleClient.startNotifications(device.deviceId, SERVICE_UUID, RX_CHAR_UUID, (val) => {
          try { listener(JSON.parse(DECODER.decode(val.buffer ?? val))); }
          catch (_) {}
        });
      }
    },
    send(msg) {
      if (!BleClient || !connectedDevice) return;
      const data = ENCODER.encode(JSON.stringify(msg));
      BleClient.write(connectedDevice, SERVICE_UUID, TX_CHAR_UUID, new DataView(data.buffer)).catch(() => {});
    },
    onMessage(fn) { listener = fn; },
    close() {
      if (BleClient && connectedDevice) BleClient.disconnect(connectedDevice).catch(() => {});
      connectedDevice = null;
    },
    describe: 'Bluetooth LE (native)',
  };
}

// ── Web Bluetooth (Chrome / Edge) ────────────────────────────
export function webBleAdapter() {
  let device = null, server = null, txChar = null, rxChar = null;
  let listener = () => {};

  return {
    async open({ role }) {
      if (!navigator.bluetooth) {
        throw Object.assign(new Error('Web Bluetooth is not available in this browser.'),
          { code: 'NO_WEB_BT' });
      }
      if (role === 'host') {
        throw Object.assign(new Error('Web Bluetooth cannot host (browsers cannot advertise). Use the native app to host.'),
          { code: 'HOST_NOT_AVAILABLE_HERE' });
      }
      device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
      server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      txChar = await service.getCharacteristic(TX_CHAR_UUID);
      rxChar = await service.getCharacteristic(RX_CHAR_UUID);
      await rxChar.startNotifications();
      rxChar.addEventListener('characteristicvaluechanged', (e) => {
        try { listener(JSON.parse(DECODER.decode(e.target.value.buffer))); }
        catch (_) {}
      });
    },
    send(msg) {
      if (!txChar) return;
      txChar.writeValue(ENCODER.encode(JSON.stringify(msg))).catch(() => {});
    },
    onMessage(fn) { listener = fn; },
    close() {
      try { server?.disconnect(); } catch (_) {}
      device = null;
    },
    describe: 'Web Bluetooth',
  };
}

// ── QR / Short-Code adapter ──────────────────────────────────
//
// Pure async exchange — no actual radio. Host prepares an opening payload,
// shows it as a QR + a short typed code. Guest scans/types, receives the
// payload, both sides run the deterministic engine locally with the same
// seed. There's no streaming back-and-forth — the exchange is one-shot;
// each side resolves its own AI-vs-friend battle using the agreed snapshots.
//
// The transport interface still works because we expose a `consumePayload`
// method on the adapter for the pairing UI to drive.
export function qrCodeAdapter() {
  let listener = () => {};
  let pendingHello = null;
  return {
    async open({ role }) {
      // No-op — the adapter is driven manually by pairing UI calls.
    },
    send(msg) {
      // For QR adapter, the opening 'hello' is encoded into the QR by the
      // pairing UI directly; downstream messages are not transmitted at all
      // (each device runs its own battle locally with shared seed).
      if (msg.type === 'hello') pendingHello = msg;
    },
    onMessage(fn) { listener = fn; },
    /** Called by the pairing UI after a QR/code has been read. */
    consumePayload(msg) {
      try { listener(msg); } catch (_) {}
    },
    /** Get the host's stored hello payload to display as QR. */
    getHello() { return pendingHello; },
    close() { pendingHello = null; },
    describe: 'QR / short code',
  };
}
