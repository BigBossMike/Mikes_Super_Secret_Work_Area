// Bluetooth for the connect: this phone advertises its current code and
// listens for the other phone's, at the same time.
//
// The code travels as the last 8 bytes of a 128-bit service UUID, because an
// iPhone acting as a peripheral can only advertise service UUIDs and a name.
// Both iPhone and Android scanners read service UUIDs, so one method works
// between any two phones.
//
// The native module (munim-bluetooth) is not in Expo Go. It needs a
// development build: `npx expo run:android`, `npx expo run:ios` or EAS Build.
import { Platform } from "react-native";
import { bleUuidFor, type Heard, tokenFromAdvertisement } from "@/lib/handshake";

export type BleReady = "ok" | "unavailable" | "denied" | "off";

export interface BleHandshake {
  /** False in Expo Go and on the web: the Bluetooth module isn't in this build. */
  available(): boolean;
  prepare(): Promise<BleReady>;
  /** Advertise `token` and report every Intro code heard nearby. */
  start(token: string, onHeard: (h: Heard) => void): Promise<void>;
  /** The code changed (new 5-second slot). */
  update(token: string): Promise<void>;
  stop(): Promise<void>;
}

// Only the parts of munim-bluetooth the handshake uses.
interface BleModule {
  requestBluetoothPermission(permissions?: ("scan" | "connect" | "advertise")[]): Promise<boolean>;
  isBluetoothEnabled(): Promise<boolean>;
  requestEnable(): Promise<boolean>;
  startAdvertising(options: { serviceUUIDs: string[]; localName?: string }): void;
  stopAdvertising(): void;
  startScan(options?: { serviceUUIDs?: string[]; allowDuplicates?: boolean; scanMode?: "lowPower" | "balanced" | "lowLatency" }): void;
  stopScan(): void;
  addDeviceFoundListener(callback: (d: { id: string; name?: string; localName?: string; rssi?: number; serviceUUIDs?: string[] }) => void): () => void;
}

let loaded: BleModule | null | undefined;

function loadModule(): BleModule | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === "web") return (loaded = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("munim-bluetooth") as BleModule;
  } catch {
    loaded = null;   // Expo Go, or a build without the module
  }
  return loaded;
}

export function nativeBle(): BleHandshake {
  let unsubscribe: (() => void) | null = null;
  let advertising = false;
  return {
    available: () => loadModule() !== null,
    async prepare() {
      const m = loadModule();
      if (!m) return "unavailable";
      try {
        const allowed = await m.requestBluetoothPermission(["scan", "advertise", "connect"]);
        if (!allowed) return "denied";
        if (!(await m.isBluetoothEnabled()) && !(await m.requestEnable())) return "off";
        return "ok";
      } catch {
        return "unavailable";
      }
    },
    async start(token, onHeard) {
      const m = loadModule();
      if (!m) throw new Error("Bluetooth isn't in this build.");
      unsubscribe?.();
      unsubscribe = m.addDeviceFoundListener(d => {
        const heard = tokenFromAdvertisement(d);
        if (heard) onHeard({ token: heard, rssi: d.rssi ?? null, via: "ble" });
      });
      // No service filter: the UUID changes with the code. We pick out Intro codes ourselves.
      m.startScan({ allowDuplicates: true, scanMode: "lowLatency" });
      m.startAdvertising({ serviceUUIDs: [bleUuidFor(token)] });
      advertising = true;
    },
    async update(token) {
      const m = loadModule();
      if (!m || !advertising) return;
      m.stopAdvertising();
      m.startAdvertising({ serviceUUIDs: [bleUuidFor(token)] });
    },
    async stop() {
      const m = loadModule();
      unsubscribe?.();
      unsubscribe = null;
      if (!m) return;
      try { m.stopScan(); } catch { /* already stopped */ }
      if (advertising) { try { m.stopAdvertising(); } catch { /* already stopped */ } }
      advertising = false;
    },
  };
}

/** Demo build: pretends the other phone is right here and hears you after a moment. */
export function fakeBle(hearAfterMs = 1400): BleHandshake {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    available: () => true,
    prepare: async () => "ok",
    async start(_token, onHeard) {
      timer = setTimeout(() => onHeard({ token: "0123456789abcdef", rssi: -47, via: "ble" }), hearAfterMs);
    },
    async update() {},
    async stop() { if (timer) clearTimeout(timer); timer = null; },
  };
}
