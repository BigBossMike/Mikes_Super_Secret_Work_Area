// Which handshake pieces this build uses.
//
// Live: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set (see
// .env.example), so the app talks to the connect-handshake function and uses
// real Bluetooth. Demo: nothing is set, so a pretend server and partner stand in.
// The QR code is real in both: another phone running Intro can scan it.
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

/** Filled in when sign-in is built (CLAUDE.md next step 1): return the Supabase session's access token. */
async function accessToken(): Promise<string | null> {
  return null;
}

let services: HandshakeServices | null = null;

export function handshakeServices(): HandshakeServices {
  if (services) return services;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  services = url && anon
    ? { live: true, api: new LiveHandshakeApi(url, anon, accessToken), ble: nativeBle(), locate: whereAmI }
    : { live: false, api: createDemoApi(), ble: fakeBle(), locate: async () => (await whereAmI(4000).catch(() => null)) ?? DEMO_SPOT };
  return services;
}
