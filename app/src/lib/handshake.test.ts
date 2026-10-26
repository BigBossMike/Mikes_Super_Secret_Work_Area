/// <reference types="node" />
import { createHash, createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bleNameFor, bleUuidFor, currentToken, evaluateHandshake, HANDSHAKE, heardValid, mergeHeard, metresBetween,
  type PressRecord, qrPayload, REASONS, samePlace, slotAt, tokenFor, tokenFromAdvertisement, tokenFromBleUuid, tokenFromQr, validTokens,
} from "./handshake";
import { fromBase64, fromHex, hmacSha256, sha256, toBase64, toHex, utf8 } from "./sha256";

const hex = (b: Uint8Array) => toHex(b);

describe("sha256", () => {
  it("matches the published test vectors", () => {
    expect(hex(sha256(utf8("")))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hex(sha256(utf8("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hex(sha256(utf8("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")))).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });
  it("matches Node across block boundaries", () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 200, 1000]) {
      const msg = new Uint8Array(randomBytes(n));
      expect(hex(sha256(msg))).toBe(createHash("sha256").update(msg).digest("hex"));
    }
  });
  it("HMAC matches RFC 4231", () => {
    expect(hex(hmacSha256(fromHex("0b".repeat(20)), utf8("Hi There")))).toBe("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
    expect(hex(hmacSha256(utf8("Jefe"), utf8("what do ya want for nothing?")))).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    // Key longer than one block
    expect(hex(hmacSha256(fromHex("aa".repeat(131)), utf8("Test Using Larger Than Block-Size Key - Hash Key First"))))
      .toBe("60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
  });
  it("base64 and utf8 round-trip", () => {
    for (const n of [0, 1, 2, 3, 4, 31, 32, 33]) {
      const b = new Uint8Array(randomBytes(n));
      expect(toBase64(b)).toBe(Buffer.from(b).toString("base64"));
      expect(hex(fromBase64(toBase64(b)))).toBe(hex(b));
    }
    expect(hex(utf8("héllo €𝄞"))).toBe(Buffer.from("héllo €𝄞", "utf8").toString("hex"));
  });
});

const key = () => toBase64(new Uint8Array(randomBytes(32)));
const T0 = Date.UTC(2026, 9, 27, 9, 0, 0);
const press = (over: Partial<PressRecord> & { user: string; sessionKey: string }): PressRecord => ({
  method: "ble", pressedAt: T0, reportedAt: T0 + 6000, heard: [], location: { lat: -27.4598, lng: 152.999, accuracy_m: 12 }, ...over,
});
const heardFrom = (theirKey: string, at: number, rssi = -45) => ({ token: currentToken(theirKey, at), rssi, via: "ble" as const });

describe("connect codes", () => {
  it("use the server's recipe: first 16 hex chars of HMAC-SHA256(key, slot)", () => {
    const k = key();
    const slot = slotAt(T0);
    const expected = createHmac("sha256", Buffer.from(k, "base64")).update(String(slot)).digest("hex").slice(0, 16);
    expect(tokenFor(k, slot)).toBe(expected);
    expect(currentToken(k, T0)).toBe(expected);
    expect(slotAt(T0 + 4999)).toBe(slot);
    expect(slotAt(T0 + 5000)).toBe(slot + 1);
  });
  it("accept the last 6 slots and 1 ahead, nothing else", () => {
    const k = key();
    const valid = validTokens(k, T0);
    expect(valid.size).toBe(HANDSHAKE.slotsBack + HANDSHAKE.slotsForward + 1);
    expect(valid.has(tokenFor(k, slotAt(T0) - 6))).toBe(true);
    expect(valid.has(tokenFor(k, slotAt(T0) - 7))).toBe(false);
    expect(valid.has(tokenFor(k, slotAt(T0) + 1))).toBe(true);
    expect(valid.has(tokenFor(k, slotAt(T0) + 2))).toBe(false);
    expect(valid.has(currentToken(key(), T0))).toBe(false);
  });
  it("travel in a QR payload", () => {
    const t = currentToken(key(), T0);
    expect(tokenFromQr(qrPayload(t))).toBe(t);
    expect(tokenFromQr(" INTRO:CONNECT:" + t.toUpperCase() + " ")).toBe(t);
    expect(tokenFromQr("https://example.com")).toBeNull();
    expect(tokenFromQr("intro:connect:zz")).toBeNull();
  });
  it("travel inside a Bluetooth service UUID or local name", () => {
    const t = currentToken(key(), T0);
    const uuid = bleUuidFor(t);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(tokenFromBleUuid(uuid)).toBe(t);
    expect(tokenFromBleUuid(uuid.toUpperCase())).toBe(t);
    expect(tokenFromBleUuid("0000180d-0000-1000-8000-00805f9b34fb")).toBeNull();
    expect(tokenFromAdvertisement({ serviceUUIDs: ["180D", uuid], rssi: -40 })).toBe(t);
    expect(tokenFromAdvertisement({ localName: bleNameFor(t) })).toBe(t);
    expect(tokenFromAdvertisement({ name: "Pixel 9" })).toBeNull();
  });
  it("keep the strongest reading per code", () => {
    const a = { token: "a".repeat(16), rssi: -70, via: "ble" as const };
    const list = mergeHeard(mergeHeard([], a), { ...a, rssi: -40 });
    expect(list).toEqual([{ ...a, rssi: -40 }]);
    expect(mergeHeard(list, { ...a, rssi: -90 })).toEqual([{ ...a, rssi: -40 }]);
  });
});

describe("same place", () => {
  const here = { lat: -27.4598, lng: 152.999, accuracy_m: 10 };
  const moved = (m: number) => ({ ...here, lat: here.lat + m / 111195 });
  it("measures distance", () => {
    expect(metresBetween(here.lat, here.lng, moved(500).lat, moved(500).lng)).toBeCloseTo(500, 0);
  });
  it("allows 100 m plus both GPS accuracies", () => {
    expect(samePlace(here, moved(115))).toBe(true);     // 100 + 10 + 10
    expect(samePlace(here, moved(125))).toBe(false);
    expect(samePlace({ ...here, accuracy_m: 1000 }, moved(255))).toBe(true);   // accuracy capped at 150
    expect(samePlace({ ...here, accuracy_m: 1000 }, moved(265))).toBe(false);
    expect(samePlace(here, null)).toBe(false);
  });
});

describe("evaluateHandshake (Bluetooth)", () => {
  const kA = key(), kB = key();
  it("waits until the other person presses", () => {
    expect(evaluateHandshake(press({ user: "a", sessionKey: kA }), null, T0 + 7000)).toEqual({ status: "waiting", reason: REASONS.waitingPress });
    const stale = press({ user: "b", sessionKey: kB, pressedAt: T0 - 130_000 });
    expect(evaluateHandshake(press({ user: "a", sessionKey: kA }), stale, T0 + 7000).status).toBe("waiting");
  });
  it("gives up on a press older than 2 minutes", () => {
    expect(evaluateHandshake(press({ user: "a", sessionKey: kA }), null, T0 + 121_000)).toEqual({ status: "failed", reason: REASONS.tooLate });
  });
  it("needs both presses within 10 seconds", () => {
    const a = press({ user: "a", sessionKey: kA });
    const b = press({ user: "b", sessionKey: kB, pressedAt: T0 + 11_000 });
    expect(evaluateHandshake(a, b, T0 + 12_000)).toEqual({ status: "failed", reason: REASONS.notTogether });
  });
  it("waits for both reports", () => {
    const a = press({ user: "a", sessionKey: kA });
    const b = press({ user: "b", sessionKey: kB, pressedAt: T0 + 2000, reportedAt: null });
    expect(evaluateHandshake(a, b, T0 + 7000)).toEqual({ status: "waiting", reason: REASONS.waitingReport });
  });
  it("connects when both phones heard each other up close in the same place", () => {
    const now = T0 + 7000;
    const a = press({ user: "a", sessionKey: kA, heard: [heardFrom(kB, now)] });
    const b = press({ user: "b", sessionKey: kB, pressedAt: T0 + 2000, heard: [heardFrom(kA, now)] });
    expect(evaluateHandshake(a, b, now)).toEqual({ status: "connected", method: "ble" });
  });
  it("fails when only one phone heard the other, or the signal was weak", () => {
    const now = T0 + 7000;
    const a = press({ user: "a", sessionKey: kA, heard: [heardFrom(kB, now)] });
    const bSilent = press({ user: "b", sessionKey: kB, pressedAt: T0 + 2000 });
    expect(evaluateHandshake(a, bSilent, now)).toEqual({ status: "failed", reason: REASONS.notHeard });
    const bWeak = press({ user: "b", sessionKey: kB, pressedAt: T0 + 2000, heard: [heardFrom(kA, now, -75)] });
    expect(evaluateHandshake(a, bWeak, now)).toEqual({ status: "failed", reason: REASONS.notHeard });
    expect(heardValid([heardFrom(kA, now, -60)], kA, false, now)).toBe(true);
    expect(heardValid([heardFrom(kA, now, -61)], kA, false, now)).toBe(false);
  });
  it("rejects a code made with the wrong key, or an old one", () => {
    const now = T0 + 7000;
    const forged = heardFrom(key(), now);
    const old = heardFrom(kB, now - 60_000);
    const b = press({ user: "b", sessionKey: kB, pressedAt: T0 + 2000, heard: [heardFrom(kA, now)] });
    expect(evaluateHandshake(press({ user: "a", sessionKey: kA, heard: [forged] }), b, now).status).toBe("failed");
    expect(evaluateHandshake(press({ user: "a", sessionKey: kA, heard: [old] }), b, now).status).toBe("failed");
  });
  it("fails when the phones are in different places", () => {
    const now = T0 + 7000;
    const a = press({ user: "a", sessionKey: kA, heard: [heardFrom(kB, now)] });
    const b = press({ user: "b", sessionKey: kB, pressedAt: T0 + 2000, heard: [heardFrom(kA, now)], location: { lat: -27.47, lng: 153.02, accuracy_m: 10 } });
    expect(evaluateHandshake(a, b, now)).toEqual({ status: "failed", reason: REASONS.differentPlaces });
    const noFix = { ...b, location: null };
    expect(evaluateHandshake(a, noFix, now)).toEqual({ status: "failed", reason: REASONS.differentPlaces });
  });
});

describe("evaluateHandshake (QR code)", () => {
  const kShow = key(), kScan = key();
  it("connects when the scanner read the shower's current code", () => {
    const now = T0 + 20_000;
    const shower = press({ user: "s", sessionKey: kShow, method: "qr", reportedAt: T0 + 1000 });
    const scanner = press({ user: "c", sessionKey: kScan, method: "qr", pressedAt: now - 500, reportedAt: now,
      heard: [{ token: currentToken(kShow, now - 2000), via: "qr" }] });
    expect(evaluateHandshake(scanner, shower, now)).toEqual({ status: "connected", method: "qr" });
    expect(evaluateHandshake(shower, scanner, now)).toEqual({ status: "connected", method: "qr" });
  });
  it("allows the scan up to 2 minutes after the code was first shown", () => {
    const now = T0 + 100_000;
    const shower = press({ user: "s", sessionKey: kShow, method: "qr", reportedAt: T0 + 1000 });
    const scanner = press({ user: "c", sessionKey: kScan, method: "qr", pressedAt: now - 500, reportedAt: now, heard: [{ token: currentToken(kShow, now), via: "qr" }] });
    expect(evaluateHandshake(scanner, shower, now).status).toBe("connected");
  });
  it("rejects a screenshot of an old code", () => {
    const now = T0 + 60_000;
    const shower = press({ user: "s", sessionKey: kShow, method: "qr", reportedAt: T0 + 1000 });
    const scanner = press({ user: "c", sessionKey: kScan, method: "qr", pressedAt: now - 500, reportedAt: now, heard: [{ token: currentToken(kShow, T0), via: "qr" }] });
    expect(evaluateHandshake(scanner, shower, now)).toEqual({ status: "failed", reason: REASONS.notHeard });
  });
  it("still needs both phones in the same place", () => {
    const now = T0 + 20_000;
    const shower = press({ user: "s", sessionKey: kShow, method: "qr", reportedAt: T0 + 1000, location: { lat: -27.47, lng: 153.02 } });
    const scanner = press({ user: "c", sessionKey: kScan, method: "qr", pressedAt: now - 500, reportedAt: now, heard: [{ token: currentToken(kShow, now), via: "qr" }] });
    expect(evaluateHandshake(scanner, shower, now)).toEqual({ status: "failed", reason: REASONS.differentPlaces });
  });
});
