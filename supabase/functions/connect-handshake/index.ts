// connect-handshake: proves two phones are physically together before
// Intro unlocks contact details.
//
// How it works, in plain English:
//
//  1. "press"  — Both people tap the big green Connect button. Each phone
//                asks this function for a secret "session key". The phone
//                uses that key to make a short code that changes every 5
//                seconds, and broadcasts it over Bluetooth. It also listens
//                for the other phone's code.
//
//  2. "report" — A few seconds later each phone sends back: which codes it
//                heard, how strong the Bluetooth signal was, and roughly
//                where it is (GPS). With the QR fallback, one phone shows its
//                code as a QR code and the other scans it.
//
//  3. This function checks that:
//       * both people pressed Connect within 10 seconds of each other
//         (30 seconds for QR, since scanning takes longer)
//       * each phone heard the OTHER phone's current code (for QR, the
//         scanner read the other phone's code)
//       * the Bluetooth signal was strong, meaning the phones were very close
//       * the two GPS positions are in the same place
//     If all are true, it records the connection. The database then unlocks
//     both people's contact details, marks the objective done, and tells any
//     parent who asked to be told.
//
//  4. "status" — The phone that reported first asks again to find out
//                whether it worked.
//
// Codes change every 5 seconds and only work for this one meeting, so a
// screenshot or a forwarded code from somewhere else won't work.
//
// Deploy with:  supabase functions deploy connect-handshake

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ---- Settings you might want to tune after real-world testing -------------
const SLOT_SECONDS = 5;          // how often the Bluetooth code changes
const PRESS_WINDOW_BLE_S = 10;   // both must press within this many seconds
const PRESS_WINDOW_QR_S = 30;    // a bit longer for QR (camera takes time)
const PRESS_MAX_AGE_S = 120;     // a press is no good after 2 minutes
const MIN_RSSI_DBM = -60;        // Bluetooth signal strength; closer to 0 = closer phones
const MAX_DISTANCE_M = 100;      // GPS positions must be this close (plus GPS accuracy)
const MAX_GPS_ACCURACY_M = 150;  // ignore GPS readings worse than this

type Heard = { token: string; rssi?: number | null; via?: "ble" | "qr" };
type Location = { lat: number; lng: number; accuracy_m?: number };

type Press = {
  id: string;
  match_request_id: string;
  user_id: string;
  session_key: string;
  method: "ble" | "qr" | "uwb";
  pressed_at: string;
  reported_at: string | null;
  heard: Heard[];
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  result: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // Who is calling? We trust Supabase Auth's signed-in user, never the body.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Please sign in" }, 401);

  // The server key can do things app users can't (like recording a connection).
  // It never leaves this function.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send JSON" }, 400);
  }

  try {
    switch (body.action) {
      case "press":
        return await press(admin, user.id, String(body.match_request_id ?? ""), body.method === "qr" ? "qr" : "ble");
      case "report":
        return await report(admin, user.id, String(body.press_id ?? ""), body);
      case "status":
        return await status(admin, user.id, String(body.press_id ?? ""));
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});

// ---------------------------------------------------------------------------
// Step 1: a person presses Connect
// ---------------------------------------------------------------------------
async function press(admin: SupabaseClient, userId: string, matchId: string, method: "ble" | "qr") {
  const people = await matchPeople(admin, matchId);
  if (!people || !people.includes(userId)) return json({ error: "Match not found" }, 404);
  const [ownerId, candidateId] = people;

  const { data: mr } = await admin.from("match_requests").select("status").eq("id", matchId).single();
  if (mr?.status !== "agreed") return json({ error: "You can only connect with someone who agreed" }, 409);

  const { count: blocked } = await admin.from("blocks").select("*", { count: "exact", head: true })
    .or(`and(blocker_id.eq.${ownerId},blocked_id.eq.${candidateId}),and(blocker_id.eq.${candidateId},blocked_id.eq.${ownerId})`);
  if (blocked) return json({ error: "You can't connect with this person" }, 403);

  // Already connected before? Just hand back the details.
  const existing = await connectionFor(admin, matchId);
  if (existing) return json({ status: "connected", contact: await partnerContact(admin, userId, people) });

  const sessionKey = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const { data, error } = await admin.from("handshake_presses")
    .insert({ match_request_id: matchId, user_id: userId, session_key: sessionKey, method })
    .select("id, pressed_at").single();
  if (error) throw error;

  return json({
    press_id: data.id,
    session_key: sessionKey,     // the phone uses this to make its rotating code
    slot_seconds: SLOT_SECONDS,
    // Phone recipe: code = first 16 hex characters of
    // HMAC-SHA256(key = base64-decoded session_key, message = floor(unix_seconds / slot_seconds) as text)
    expires_in_s: PRESS_MAX_AGE_S,
  });
}

// ---------------------------------------------------------------------------
// Step 2: a phone reports what it heard and where it is
// ---------------------------------------------------------------------------
async function report(admin: SupabaseClient, userId: string, pressId: string, body: Record<string, unknown>) {
  const mine = await loadPress(admin, pressId);
  if (!mine || mine.user_id !== userId) return json({ error: "Press not found" }, 404);
  if (ageSeconds(mine.pressed_at) > PRESS_MAX_AGE_S) return json({ status: "failed", reason: "Took too long. Press Connect again." });

  const heard = (Array.isArray(body.heard) ? body.heard : []).slice(0, 50) as Heard[];
  const loc = body.location as Location | undefined;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
    return json({ error: "Location is needed to connect" }, 400);
  }

  await admin.from("handshake_presses").update({
    heard, lat: loc.lat, lng: loc.lng, accuracy_m: loc.accuracy_m ?? null, reported_at: new Date().toISOString(),
  }).eq("id", pressId);

  return await evaluate(admin, userId, pressId);
}

// ---------------------------------------------------------------------------
// Step 4: the first phone checks back
// ---------------------------------------------------------------------------
async function status(admin: SupabaseClient, userId: string, pressId: string) {
  const mine = await loadPress(admin, pressId);
  if (!mine || mine.user_id !== userId) return json({ error: "Press not found" }, 404);
  return await evaluate(admin, userId, pressId);
}

// ---------------------------------------------------------------------------
// Step 3: the checks
// ---------------------------------------------------------------------------
async function evaluate(admin: SupabaseClient, userId: string, pressId: string) {
  const mine = (await loadPress(admin, pressId))!;
  const people = (await matchPeople(admin, mine.match_request_id))!;

  if (await connectionFor(admin, mine.match_request_id)) {
    return json({ status: "connected", contact: await partnerContact(admin, userId, people) });
  }

  // The other person's most recent press for this match.
  const { data: theirs } = await admin.from("handshake_presses")
    .select("*").eq("match_request_id", mine.match_request_id).neq("user_id", userId)
    .order("pressed_at", { ascending: false }).limit(1).maybeSingle<Press>();

  if (!theirs || ageSeconds(theirs.pressed_at) > PRESS_MAX_AGE_S) {
    return json({ status: "waiting", reason: "Waiting for the other person to press Connect" });
  }

  const qr = mine.heard.some((h) => h.via === "qr") || theirs.heard.some((h) => h.via === "qr");
  const window = qr ? PRESS_WINDOW_QR_S : PRESS_WINDOW_BLE_S;
  if (Math.abs(Date.parse(mine.pressed_at) - Date.parse(theirs.pressed_at)) / 1000 > window) {
    return fail(admin, mine, theirs, "You need to press Connect at the same time. Try again together.");
  }

  if (!mine.reported_at || !theirs.reported_at) {
    return json({ status: "waiting", reason: "Checking the other phone…" });
  }

  // Did each phone hear the other's code?
  const iHeardThem = await heardValid(mine.heard, theirs.session_key, qr);
  const theyHeardMe = await heardValid(theirs.heard, mine.session_key, qr);
  const proximityOk = qr ? (iHeardThem || theyHeardMe) : (iHeardThem && theyHeardMe);
  if (!proximityOk) {
    return fail(admin, mine, theirs, "Your phones couldn't find each other. Hold them closer, or use the QR code.");
  }

  // Are they in the same place?
  if (!sameplace(mine, theirs)) {
    return fail(admin, mine, theirs, "Your phones seem to be in different places. You need to be together.");
  }

  // All good: record it. The database function unlocks contacts, marks the
  // objective done and tells parents.
  const suburb = await nearestSuburb(admin, mine.lat!, mine.lng!);
  const { error } = await admin.rpc("complete_connection", {
    p_match: mine.match_request_id, p_method: qr ? "qr" : "ble", p_suburb: suburb,
  });
  if (error) throw error;

  await admin.from("handshake_presses").update({ result: "connected" }).in("id", [mine.id, theirs.id]);
  return json({ status: "connected", contact: await partnerContact(admin, userId, people) });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The rotating code for a key at a given time slot.
async function tokenFor(sessionKey: string, slot: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", fromBase64(sessionKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(slot))));
  return Array.from(sig.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

// True if any heard code is the other phone's code from the last ~30 seconds,
// with a strong enough Bluetooth signal (QR scans don't have a signal).
async function heardValid(heard: Heard[], theirKey: string, qrAllowed: boolean): Promise<boolean> {
  const nowSlot = Math.floor(Date.now() / 1000 / SLOT_SECONDS);
  const valid = new Set<string>();
  for (let s = nowSlot - 6; s <= nowSlot + 1; s++) valid.add(await tokenFor(theirKey, s));
  return heard.some((h) => {
    if (!valid.has(String(h.token).toLowerCase())) return false;
    if (h.via === "qr") return qrAllowed;
    return typeof h.rssi === "number" && h.rssi >= MIN_RSSI_DBM;
  });
}

function sameplace(a: Press, b: Press): boolean {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false;
  const accA = Math.min(a.accuracy_m ?? 50, MAX_GPS_ACCURACY_M);
  const accB = Math.min(b.accuracy_m ?? 50, MAX_GPS_ACCURACY_M);
  return metresBetween(a.lat, a.lng, b.lat, b.lng) <= MAX_DISTANCE_M + accA + accB;
}

function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

// We only ever store the suburb, never the exact spot.
async function nearestSuburb(admin: SupabaseClient, lat: number, lng: number): Promise<string | null> {
  const { data } = await admin.from("suburbs").select("name, lat, lng");
  let best: string | null = null;
  let bestD = Infinity;
  for (const s of data ?? []) {
    const d = metresBetween(lat, lng, s.lat, s.lng);
    if (d < bestD) { bestD = d; best = s.name; }
  }
  return bestD <= 5000 ? best : null;
}

async function fail(admin: SupabaseClient, mine: Press, theirs: Press, reason: string) {
  await admin.from("handshake_presses").update({ result: `failed: ${reason}` }).in("id", [mine.id, theirs.id]);
  return json({ status: "failed", reason });
}

async function loadPress(admin: SupabaseClient, pressId: string): Promise<Press | null> {
  if (!pressId) return null;
  const { data } = await admin.from("handshake_presses").select("*").eq("id", pressId).maybeSingle<Press>();
  return data ?? null;
}

// [objective owner, candidate] for a match request.
async function matchPeople(admin: SupabaseClient, matchId: string): Promise<[string, string] | null> {
  if (!matchId) return null;
  const { data } = await admin.from("match_requests")
    .select("candidate_id, objectives(owner_id)").eq("id", matchId).maybeSingle();
  const owner = (data?.objectives as unknown as { owner_id: string } | null)?.owner_id;
  return data && owner ? [owner, data.candidate_id] : null;
}

async function connectionFor(admin: SupabaseClient, matchId: string) {
  const { data } = await admin.from("connections").select("id").eq("match_request_id", matchId).maybeSingle();
  return data;
}

async function partnerContact(admin: SupabaseClient, userId: string, people: [string, string]) {
  const partnerId = people[0] === userId ? people[1] : people[0];
  const { data } = await admin.from("private_contacts").select("full_name, mobile, instagram").eq("id", partnerId).maybeSingle();
  return data ?? null;
}

function ageSeconds(iso: string): number {
  return (Date.now() - Date.parse(iso)) / 1000;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
