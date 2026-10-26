// Drives one connect attempt from the screen's point of view.
//
//   startBle()   press → advertise and listen for 8 s → report → ask until yes/no
//   showQr()     press → show the code (changes every 5 s) → report → ask until yes/no
//   scanned(d)   read the other phone's code → press → report → ask until yes/no
//
// Anything left over from an earlier attempt is ignored (see `run`).
import { useCallback, useEffect, useRef, useState } from "react";
import { currentToken, HANDSHAKE, type Heard, type Location, mergeHeard, msUntilNextSlot, REASONS, strongEnough, tokenFromQr } from "@/lib/handshake";
import type { Contact, HandshakeApi, Result } from "./api";
import type { BleHandshake } from "./ble";

export type Phase = "idle" | "listening" | "showing" | "checking" | "connected" | "failed" | "unavailable";

export interface HandshakeState {
  phase: Phase;
  reason: string | null;
  heard: Heard[];
  /** This phone's current code, for the QR screen. */
  token: string | null;
  contact: Contact | null;
}

export interface HandshakeDeps {
  api: HandshakeApi;
  ble: BleHandshake;
  locate: () => Promise<Location | null>;
  onConnected?: (contact: Contact | null) => void;
}

const IDLE: HandshakeState = { phase: "idle", reason: null, heard: [], token: null, contact: null };

export const BLE_MESSAGES: Record<Exclude<import("./ble").BleReady, "ok">, string> = {
  unavailable: "Bluetooth isn't in this build of Intro. Use the QR code instead.",
  denied: "Intro needs Bluetooth to check your phones are together. Allow it in Settings, or use the QR code.",
  off: "Turn Bluetooth on, then press Connect again.",
};

const errorText = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong. Try again.");

export function useHandshake(matchId: string, deps: HandshakeDeps) {
  const [state, setState] = useState<HandshakeState>(IDLE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const run = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onConnected = useRef(deps.onConnected);
  onConnected.current = deps.onConnected;
  const { api, ble, locate } = deps;

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const stopAll = useCallback(() => { clearTimers(); ble.stop().catch(() => {}); }, [ble]);
  useEffect(() => () => { run.current++; stopAll(); }, [stopAll]);

  const live = (id: number) => id === run.current;
  const patch = (id: number, p: Partial<HandshakeState>) => { if (live(id)) setState(prev => ({ ...prev, ...p })); };
  const sleep = (ms: number) => new Promise<void>(resolve => { timers.current.push(setTimeout(resolve, ms)); });

  const finish = (id: number, r: Result) => {
    if (!live(id)) return;
    stopAll();
    if (r.status === "connected") { setState(prev => ({ ...prev, phase: "connected", contact: r.contact })); onConnected.current?.(r.contact); }
    else if (r.status === "failed") setState(prev => ({ ...prev, phase: "failed", reason: r.reason }));
  };

  /**
   * Sends the report, then keeps asking until the server says yes or no.
   * With `repeatReport`, each ask re-sends what we've heard so far, and a
   * "couldn't find each other" answer gets more time while we're still listening.
   */
  async function reportAndWait(id: number, pressId: string, heard: () => Heard[], loc: Location | null, o: { pollMs: number; maxMs: number; repeatReport: boolean }) {
    if (!loc) return finish(id, { status: "failed", reason: REASONS.noLocation });
    patch(id, { phase: "checking" });
    const until = Date.now() + o.maxMs;
    let r = await api.report(pressId, heard(), loc);
    const keepTrying = (x: Result) => x.status === "waiting" || (o.repeatReport && x.status === "failed" && x.reason === REASONS.notHeard);
    while (live(id) && keepTrying(r) && Date.now() < until) {
      await sleep(o.pollMs);
      if (!live(id)) return;
      r = o.repeatReport ? await api.report(pressId, heard(), loc) : await api.status(pressId);
    }
    if (!live(id)) return;
    finish(id, r.status === "waiting" ? { status: "failed", reason: REASONS.noAnswer } : r);
  }

  const startBle = useCallback(async () => {
    const id = ++run.current;
    stopAll();
    setState({ ...IDLE, phase: "listening" });
    try {
      const locP = locate().catch(() => null);
      if (!ble.available()) return patch(id, { phase: "unavailable", reason: BLE_MESSAGES.unavailable });
      const ready = await ble.prepare();
      if (!live(id)) return;
      if (ready !== "ok") return patch(id, { phase: "unavailable", reason: BLE_MESSAGES[ready] });

      const p = await api.press(matchId, "ble");
      if (!live(id)) return;
      if (p.kind === "connected") return finish(id, { status: "connected", contact: p.contact });

      let heard: Heard[] = [];
      await ble.start(currentToken(p.sessionKey), h => {
        if (!live(id)) return;
        heard = mergeHeard(heard, h);
        patch(id, { heard });
      });
      const rotate = () => {
        if (!live(id)) return;
        ble.update(currentToken(p.sessionKey)).catch(() => {});
        timers.current.push(setTimeout(rotate, msUntilNextSlot()));
      };
      timers.current.push(setTimeout(rotate, msUntilNextSlot()));

      // Listen for 8 s, or stop early once we've heard them up close and given them 3 s to hear us.
      const started = Date.now();
      while (Date.now() - started < HANDSHAKE.listenMs) {
        await sleep(250);
        if (!live(id)) return;
        if (Date.now() - started >= HANDSHAKE.listenMinMs && heard.some(h => strongEnough(h.rssi))) break;
      }
      const loc = await locP;
      if (!live(id)) return;
      // Bluetooth stays on while we check, so the other phone can still hear us.
      await reportAndWait(id, p.pressId, () => heard, loc, { pollMs: 1500, maxMs: 25_000, repeatReport: true });
    } catch (e) {
      finish(id, { status: "failed", reason: errorText(e) });
    }
  }, [api, ble, locate, matchId, stopAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const showQr = useCallback(async () => {
    const id = ++run.current;
    stopAll();
    setState({ ...IDLE, phase: "showing" });
    try {
      const locP = locate().catch(() => null);
      const giveUp = Date.now() + 5 * 60_000;
      while (live(id) && Date.now() < giveUp) {
        const p = await api.press(matchId, "qr");
        if (!live(id)) return;
        if (p.kind === "connected") return finish(id, { status: "connected", contact: p.contact });

        patch(id, { token: currentToken(p.sessionKey) });
        const rotate = () => {
          if (!live(id)) return;
          patch(id, { token: currentToken(p.sessionKey) });
          timers.current.push(setTimeout(rotate, msUntilNextSlot()));
        };
        timers.current.push(setTimeout(rotate, msUntilNextSlot()));

        const loc = await locP;
        if (!live(id)) return;
        if (!loc) return finish(id, { status: "failed", reason: REASONS.noLocation });

        // A press lasts 2 minutes on the server. Ask every 2 s, then start a fresh code before it runs out.
        const fresh = Date.now() + 100_000;
        let r = await api.report(p.pressId, [], loc);
        while (live(id) && r.status === "waiting" && Date.now() < fresh) {
          await sleep(2000);
          if (!live(id)) return;
          r = await api.status(p.pressId);
        }
        if (!live(id)) return;
        if (r.status !== "waiting") return finish(id, r);
        clearTimers();
      }
      finish(id, { status: "failed", reason: REASONS.noAnswer });
    } catch (e) {
      finish(id, { status: "failed", reason: errorText(e) });
    }
  }, [api, locate, matchId, stopAll]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The camera read a code. Returns false if it wasn't an Intro code. */
  const scanned = useCallback((data: string): boolean => {
    const token = tokenFromQr(data);
    if (!token) return false;
    const phase = stateRef.current.phase;
    if (phase === "checking" || phase === "connected") return true;
    const id = ++run.current;
    stopAll();
    setState({ ...IDLE, phase: "checking" });
    (async () => {
      try {
        const locP = locate().catch(() => null);
        const p = await api.press(matchId, "qr");
        if (!live(id)) return;
        if (p.kind === "connected") return finish(id, { status: "connected", contact: p.contact });
        const loc = await locP;
        if (!live(id)) return;
        await reportAndWait(id, p.pressId, () => [{ token, via: "qr" }], loc, { pollMs: 1500, maxMs: 20_000, repeatReport: false });
      } catch (e) {
        finish(id, { status: "failed", reason: errorText(e) });
      }
    })();
    return true;
  }, [api, locate, matchId, stopAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => { run.current++; stopAll(); setState(IDLE); }, [stopAll]);

  return { ...state, startBle, showQr, scanned, reset, bleAvailable: ble.available() };
}
