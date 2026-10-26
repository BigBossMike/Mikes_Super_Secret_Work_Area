// Which handshake pieces this build uses.
//
// Live: the Supabase settings are set (see backend/client.ts and .env.example),
// so the app talks to the connect-handshake function and uses real Bluetooth.
// Demo: nothing is set, so a pretend server and partner stand in.
// The QR code is real in both: another phone running Intro can scan it.
import { accessToken, supabaseConfig } from "@/backend/client";
import type { Location } from "@/lib/handshake";
import { createDemoApi, type HandshakeApi, LiveHandshakeApi } from "./api";
import { type BleHandshake, fakeBle, nativeBle } from "./ble";
import { whereAmI } from "./location";

export interface HandshakeServices {
  live: boolean;
  api: HandshakeApi;
  ble: BleHandshake;
  locate: () => Promise<Location | null>;
}

// Paddington, Brisbane. Used in the demo when the phone has no GPS fix (simulators).
const DEMO_SPOT: Location = { lat: -27.4598, lng: 152.999, accuracy_m: 25 };

let services: HandshakeServices | null = null;

export function handshakeServices(): HandshakeServices {
  if (services) return services;
  const cfg = supabaseConfig();
  services = cfg
    ? { live: true, api: new LiveHandshakeApi(cfg.url, cfg.anonKey, accessToken), ble: nativeBle(), locate: whereAmI }
    : { live: false, api: createDemoApi(), ble: fakeBle(), locate: async () => (await whereAmI(4000).catch(() => null)) ?? DEMO_SPOT };
  return services;
}
