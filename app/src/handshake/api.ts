// Talking to the connect-handshake server function, plus a stand-in for the
// demo build that pretends to be the server and the other phone.
import * as Crypto from "expo-crypto";
import { currentToken, evaluateHandshake, type Heard, type Location, type Method, type PressRecord, REASONS } from "@/lib/handshake";
import { toBase64 } from "@/lib/sha256";

export interface Contact { full_name: string; mobile: string | null; instagram: string | null }

export type PressReply =
  | { kind: "press"; pressId: string; sessionKey: string }
  | { kind: "connected"; contact: Contact | null };

export type Result =
  | { status: "waiting"; reason: string }
  | { status: "failed"; reason: string }
  | { status: "connected"; contact: Contact | null };

export interface HandshakeApi {
  /** "I pressed Connect." Hands back the secret key this phone makes its codes from. */
  press(matchId: string, method: Method): Promise<PressReply>;
  /** "Here's what I heard and where I am." Can be sent again with more codes. */
  report(pressId: string, heard: Heard[], location: Location): Promise<Result>;
  /** "Did it work yet?" */
  status(pressId: string): Promise<Result>;
}

// ---- Live: the Supabase function ------------------------------------------------

export class LiveHandshakeApi implements HandshakeApi {
  constructor(private url: string, private anonKey: string, private accessToken: () => Promise<string | null>) {}

  private async call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = await this.accessToken();
    if (!token) throw new Error("Sign in to Intro first.");
    const res = await fetch(`${this.url.replace(/\/$/, "")}/functions/v1/connect-handshake`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: this.anonKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || typeof data.error === "string") throw new Error(typeof data.error === "string" ? data.error : `Server error ${res.status}`);
    return data;
  }

  async press(matchId: string, method: Method): Promise<PressReply> {
    const d = await this.call({ action: "press", match_request_id: matchId, method });
    if (d.status === "connected") return { kind: "connected", contact: (d.contact as Contact | null) ?? null };
    return { kind: "press", pressId: String(d.press_id), sessionKey: String(d.session_key) };
  }

  async report(pressId: string, heard: Heard[], location: Location): Promise<Result> {
    return toResult(await this.call({ action: "report", press_id: pressId, heard, location }));
  }

  async status(pressId: string): Promise<Result> {
    return toResult(await this.call({ action: "status", press_id: pressId }));
  }
}

function toResult(d: Record<string, unknown>): Result {
  if (d.status === "connected") return { status: "connected", contact: (d.contact as Contact | null) ?? null };
  if (d.status === "failed") return { status: "failed", reason: String(d.reason ?? REASONS.noAnswer) };
  return { status: "waiting", reason: String(d.reason ?? REASONS.waitingPress) };
}

// ---- Demo: pretends to be the server and the other phone -------------------------
//
// Runs the same evaluateHandshake() rules as the server. The other person
// presses about a second after you, stands next to you, and hears your code
// (Bluetooth) or scans it (QR). The demo can't know a real second phone's key,
// so any Intro code this phone hears or scans counts as the pretend partner's.

const DEMO_CONTACT: Contact = { full_name: "", mobile: "0491 570 156", instagram: null };

type DemoPress = PressRecord & { id: string; matchId: string };

export function createDemoApi(timing = { partnerPressMs: 1200, partnerReportMs: 1800 }): HandshakeApi {
  const presses = new Map<string, DemoPress>();
  const newKey = () => toBase64(Crypto.getRandomBytes(32));
  const partnerOf = (me: DemoPress) =>
    [...presses.values()].filter(p => p.matchId === me.matchId && p.user === "them").sort((a, b) => b.pressedAt - a.pressedAt)[0] ?? null;

  const outcome = (me: DemoPress): Result => {
    const them = partnerOf(me);
    if (them && me.location) them.location = me.location;   // the pretend partner is always beside you
    const r = evaluateHandshake(me, them);
    return r.status === "connected" ? { status: "connected", contact: DEMO_CONTACT } : r;
  };

  return {
    async press(matchId, method) {
      const me: DemoPress = { id: Crypto.randomUUID(), matchId, user: "me", sessionKey: newKey(), method, pressedAt: Date.now(), reportedAt: null, heard: [], location: null };
      presses.set(me.id, me);
      setTimeout(() => {
        const them: DemoPress = { id: Crypto.randomUUID(), matchId, user: "them", sessionKey: newKey(), method, pressedAt: Date.now(), reportedAt: null, heard: [], location: null };
        presses.set(them.id, them);
        setTimeout(() => {
          them.heard = [method === "ble" ? { token: currentToken(me.sessionKey), rssi: -47, via: "ble" } : { token: currentToken(me.sessionKey), via: "qr" }];
          them.reportedAt = Date.now();
        }, timing.partnerReportMs);
      }, timing.partnerPressMs);
      return { kind: "press", pressId: me.id, sessionKey: me.sessionKey };
    },
    async report(pressId, heard, location) {
      const me = presses.get(pressId);
      if (!me) throw new Error("Press not found");
      const them = partnerOf(me);
      me.heard = them ? heard.map(h => ({ ...h, token: currentToken(them.sessionKey) })) : heard;
      me.location = location;
      me.reportedAt = Date.now();
      return outcome(me);
    },
    async status(pressId) {
      const me = presses.get(pressId);
      if (!me) throw new Error("Press not found");
      return outcome(me);
    },
  };
}
