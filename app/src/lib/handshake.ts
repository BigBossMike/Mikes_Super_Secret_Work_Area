// The rules for the in-person connect ("tap phones").
//
// Both phones make a short code that changes every 5 seconds from a secret
// key the server hands out when someone presses Connect. The phones swap codes
// over Bluetooth (or one shows its code as a QR and the other scans it), then
// each tells the server what it heard and where it is. The server unlocks
// contact details only when the checks in evaluateHandshake() pass.
//
// The server copy of these rules is supabase/functions/connect-handshake/index.ts.
// Change the settings in both places together.

import { fromBase64, hmacSha256, toHex, utf8 } from "./sha256";

export const HANDSHAKE = {
  slotSeconds: 5,          // how often the code changes
  pressWindowBleS: 10,     // Bluetooth: both must press within this many seconds
  pressWindowQrS: 120,     // QR: the scanned code proves freshness, so the window is just the press lifetime
  pressMaxAgeS: 120,       // a press is no good after 2 minutes
  minRssiDbm: -60,         // Bluetooth signal strength; closer to 0 = closer phones
  maxDistanceM: 100,       // GPS positions must be this close (plus GPS accuracy)
  maxGpsAccuracyM: 150,    // GPS readings worse than this count as this
  slotsBack: 6,            // codes from the last 6 slots (30 s) still count
  slotsForward: 1,         // and 1 slot ahead, for clock drift
  listenMs: 8000,          // Bluetooth: how long a phone listens before reporting
  listenMinMs: 3000,       // Bluetooth: report early once heard, but not before this
} as const;

export type Method = "ble" | "qr";
export interface Heard { token: string; rssi?: number | null; via: Method }
export interface Location { lat: number; lng: number; accuracy_m?: number | null }

// ---- Codes ----------------------------------------------------------------

export const slotAt = (ms = Date.now()) => Math.floor(ms / 1000 / HANDSHAKE.slotSeconds);
export const msUntilNextSlot = (ms = Date.now()) => HANDSHAKE.slotSeconds * 1000 - (ms % (HANDSHAKE.slotSeconds * 1000));

/** The code for one time slot: first 16 hex characters of HMAC-SHA256(key, slot as text). Same recipe as the server. */
export function tokenFor(sessionKeyB64: string, slot: number): string {
  return toHex(hmacSha256(fromBase64(sessionKeyB64), utf8(String(slot)))).slice(0, 16);
}

export const currentToken = (sessionKeyB64: string, ms = Date.now()) => tokenFor(sessionKeyB64, slotAt(ms));

/** Every code the server would accept from this key right now. */
export function validTokens(sessionKeyB64: string, ms = Date.now()): Set<string> {
  const now = slotAt(ms);
  const set = new Set<string>();
  for (let s = now - HANDSHAKE.slotsBack; s <= now + HANDSHAKE.slotsForward; s++) set.add(tokenFor(sessionKeyB64, s));
  return set;
}

export const isToken = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{16}$/.test(s);

// ---- QR code ---------------------------------------------------------------

const QR_PREFIX = "intro:connect:";

export const qrPayload = (token: string) => QR_PREFIX + token;

export function tokenFromQr(data: string): string | null {
  const t = data.trim().toLowerCase();
  if (!t.startsWith(QR_PREFIX)) return null;
  const token = t.slice(QR_PREFIX.length);
  return isToken(token) ? token : null;
}

// ---- Bluetooth -------------------------------------------------------------
//
// iPhones can only advertise service UUIDs and a name, so the code travels as
// the last 8 bytes of a 128-bit service UUID, and again in the local name.

export const BLE_UUID_PREFIX = "494e5452-4f2d-4853";   // "INTRO-HS" in hex
export const BLE_NAME_PREFIX = "intro-";

export const bleUuidFor = (token: string) => `${BLE_UUID_PREFIX}-${token.slice(0, 4)}-${token.slice(4)}`;
export const bleNameFor = (token: string) => BLE_NAME_PREFIX + token;

export function tokenFromBleUuid(uuid: string): string | null {
  const hex = uuid.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 32 || !hex.startsWith(BLE_UUID_PREFIX.replace(/-/g, ""))) return null;
  const token = hex.slice(16);
  return isToken(token) ? token : null;
}

export function tokenFromBleName(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (!n.startsWith(BLE_NAME_PREFIX)) return null;
  const token = n.slice(BLE_NAME_PREFIX.length);
  return isToken(token) ? token : null;
}

export interface Advertisement { serviceUUIDs?: string[] | null; localName?: string | null; name?: string | null; rssi?: number | null }

/** The Intro code in a Bluetooth advertisement, or null if this is some other device. */
export function tokenFromAdvertisement(adv: Advertisement): string | null {
  for (const u of adv.serviceUUIDs ?? []) { const t = tokenFromBleUuid(u); if (t) return t; }
  for (const n of [adv.localName, adv.name]) { if (n) { const t = tokenFromBleName(n); if (t) return t; } }
  return null;
}

/** Keeps the strongest reading for each code heard. */
export function mergeHeard(list: Heard[], h: Heard): Heard[] {
  const i = list.findIndex(x => x.token === h.token && x.via === h.via);
  if (i < 0) return [...list, h];
  const best = (list[i].rssi ?? -Infinity) >= (h.rssi ?? -Infinity) ? list[i] : h;
  return list.map((x, j) => (j === i ? best : x));
}

export const strongEnough = (rssi: number | null | undefined) => typeof rssi === "number" && rssi >= HANDSHAKE.minRssiDbm;

// ---- Place -----------------------------------------------------------------

export function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

export function samePlace(a: Location | null | undefined, b: Location | null | undefined): boolean {
  if (!a || !b) return false;
  const accA = Math.min(a.accuracy_m ?? 50, HANDSHAKE.maxGpsAccuracyM);
  const accB = Math.min(b.accuracy_m ?? 50, HANDSHAKE.maxGpsAccuracyM);
  return metresBetween(a.lat, a.lng, b.lat, b.lng) <= HANDSHAKE.maxDistanceM + accA + accB;
}

// ---- The decision (mirror of the server's evaluate()) ------------------------

export interface PressRecord {
  user: string;
  sessionKey: string;
  method: Method;
  pressedAt: number;              // ms since epoch
  reportedAt: number | null;
  heard: Heard[];
  location: Location | null;
}

export type Outcome =
  | { status: "waiting"; reason: string }
  | { status: "failed"; reason: string }
  | { status: "connected"; method: Method };

export const REASONS = {
  waitingPress: "Waiting for the other person to press Connect",
  waitingReport: "Checking the other phone…",
  tooLate: "Took too long. Press Connect again.",
  notTogether: "You need to press Connect at the same time. Try again together.",
  notHeard: "Your phones couldn't find each other. Hold them closer, or use the QR code.",
  differentPlaces: "Your phones seem to be in different places. You need to be together.",
  noLocation: "Intro needs your location to confirm you're together. Turn location on and try again.",
  noAnswer: "Couldn't confirm the other phone. Try again together.",
} as const;

/** True if any heard code is the other phone's code from the last ~30 s, with a strong enough signal (QR scans have no signal). */
export function heardValid(heard: Heard[], theirKey: string, qrAllowed: boolean, now = Date.now()): boolean {
  const valid = validTokens(theirKey, now);
  return heard.some(h => {
    if (!valid.has(String(h.token).toLowerCase())) return false;
    if (h.via === "qr") return qrAllowed;
    return strongEnough(h.rssi);
  });
}

export function evaluateHandshake(mine: PressRecord, theirs: PressRecord | null, now = Date.now()): Outcome {
  const age = (p: PressRecord) => (now - p.pressedAt) / 1000;
  if (age(mine) > HANDSHAKE.pressMaxAgeS) return { status: "failed", reason: REASONS.tooLate };
  if (!theirs || age(theirs) > HANDSHAKE.pressMaxAgeS) return { status: "waiting", reason: REASONS.waitingPress };

  const qr = mine.method === "qr" || theirs.method === "qr" || mine.heard.some(h => h.via === "qr") || theirs.heard.some(h => h.via === "qr");
  const window = qr ? HANDSHAKE.pressWindowQrS : HANDSHAKE.pressWindowBleS;
  if (Math.abs(mine.pressedAt - theirs.pressedAt) / 1000 > window) return { status: "failed", reason: REASONS.notTogether };

  if (mine.reportedAt === null || theirs.reportedAt === null) return { status: "waiting", reason: REASONS.waitingReport };

  const iHeardThem = heardValid(mine.heard, theirs.sessionKey, qr, now);
  const theyHeardMe = heardValid(theirs.heard, mine.sessionKey, qr, now);
  const proximityOk = qr ? iHeardThem || theyHeardMe : iHeardThem && theyHeardMe;
  if (!proximityOk) return { status: "failed", reason: REASONS.notHeard };

  if (!samePlace(mine.location, theirs.location)) return { status: "failed", reason: REASONS.differentPlaces };

  return { status: "connected", method: qr ? "qr" : "ble" };
}
