// Live end-to-end check against the real Supabase project. Runs the whole
// journey for two test people, A and B, from the command line:
//   sign in -> profile -> verify -> A sets a plan -> B is asked and says yes
//   -> chat (contact details blocked) -> QR handshake -> details unlocked.
//
// Needs app/.env.local with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY,
// and two test phone numbers with fixed codes set up in Supabase
// (Authentication -> Providers -> Phone -> Test phone numbers), given as
//   TEST_PHONES="61491570101=123456,61491570102=123456" node scripts/live-smoke.mjs
// Each run needs a pair that hasn't been matched before (Intro never asks the
// same person twice for the same requester), so rotate the numbers.
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) throw new Error("app/.env.local needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
const phones = (process.env.TEST_PHONES ?? "").split(",").map(p => p.trim()).filter(Boolean).map(p => { const [phone, code] = p.split("="); return { phone: "+" + phone.replace(/^\+/, ""), code }; });
if (phones.length < 2) throw new Error('Set TEST_PHONES="61491570101=123456,61491570102=123456"');

let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };
const must = r => { if (r.error) throw new Error(r.error.message + (r.error.details ? " | " + r.error.details : "") + (r.error.hint ? " | " + r.error.hint : "")); return r.data; };
const client = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn({ phone, code }) {
  const db = client();
  must(await db.auth.signInWithOtp({ phone }));
  const { data, error } = await db.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw new Error(`Sign-in failed for ${phone}: ${error.message}`);
  return { db, id: data.user.id, phone };
}

const dob = yearsAgo => { const d = new Date(); d.setFullYear(d.getFullYear() - yearsAgo); d.setMonth(0, 15); return d.toISOString().slice(0, 10); };

async function ensureProfile(u, fields) {
  const existing = must(await u.db.from("profiles").select("id, verified_at").eq("id", u.id).maybeSingle());
  if (!existing) must(await u.db.from("profiles").insert({ id: u.id, ...fields }));
  else must(await u.db.from("profiles").update({ ...fields, date_of_birth: undefined }).eq("id", u.id));
  const { data, error } = await u.db.functions.invoke("verify-stub", { body: { date_of_birth: fields.date_of_birth } });
  ok(`${fields.first_name}: verify-stub`, !error && data?.status === "verified", error ? error.message : JSON.stringify(data));
  must(await u.db.from("private_contacts").upsert({ id: u.id, full_name: `${fields.first_name} Test`, mobile: u.phone, instagram: `${fields.first_name.toLowerCase()}.test` }));
}

const tokenFor = (keyB64, slot) => createHmac("sha256", Buffer.from(keyB64, "base64")).update(String(slot)).digest("hex").slice(0, 16);
const HERE = { lat: -27.4598, lng: 152.999, accuracy_m: 10 };
async function handshake(u, body) {
  const { data, error } = await u.db.functions.invoke("connect-handshake", { body });
  if (error) throw new Error(`connect-handshake: ${error.message}`);
  return data;
}

(async () => {
  console.log("Project:", URL_);
  const A = await signIn(phones[0]);
  const B = await signIn(phones[1]);
  ok("sign in A and B", Boolean(A.id && B.id && A.id !== B.id));

  await ensureProfile(A, { first_name: "Alpha", suburb: "Paddington", interests: ["Football", "Music"], free_times: ["Tuesday nights"], date_of_birth: dob(30), school: null, workplace: null });
  await ensureProfile(B, { first_name: "Bravo", suburb: "Toowong", interests: ["Football", "Gym"], free_times: ["Tuesday nights"], date_of_birth: dob(28), school: null, workplace: null });

  const allowance = must(await A.db.rpc("objective_allowance"));
  ok("A: objective allowance", Array.isArray(allowance) && allowance.length === 1, JSON.stringify(allowance[0]));

  // A sets a plan. The database refuses contact details in the text.
  const bad = await A.db.from("objectives").insert({ owner_id: A.id, type: "sport", text: "Fifth player, text me on 0491 570 156", group_size: 4 });
  ok("A: objective with a phone number is refused", Boolean(bad.error?.message.includes("contact_details_locked")), bad.error?.message);

  const objective = must(await A.db.from("objectives").insert({ owner_id: A.id, type: "sport", text: `A fifth player for Tuesday football (${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 4)})`, when_text: "Tuesdays, 7pm", where_text: "Toowong", group_size: 4 }).select("*").single());
  ok("A: objective created and active", objective.status === "active", objective.status);

  const asked = must(await A.db.rpc("find_matches", { p_objective: objective.id }));
  ok("A: find_matches asked someone", asked >= 1, `asked ${asked}`);

  let mine = must(await A.db.rpc("my_matches", { p_objective: objective.id }));
  ok("A: matches are anonymous until they agree", mine.length >= 1 && mine.every(m => m.first_name === null), JSON.stringify(mine.map(m => m.status)));

  const reqs = must(await B.db.rpc("my_requests"));
  const req = reqs.find(r => r.objective_id === objective.id);
  ok("B: sees the request with A's first name", Boolean(req) && req.first_name === "Alpha", req ? `${req.first_name}: ${req.objective_text}` : "not found (is B inside 25 km, same age band, free Tuesday nights?)");
  if (!req) { console.log(`\n${failures} failures`); process.exit(1); }

  ok("B: says yes", (await B.db.rpc("respond_to_request", { p_request: req.request_id, p_agree: true })).data === "agreed");
  mine = must(await A.db.rpc("my_matches", { p_objective: objective.id }));
  const agreed = mine.find(m => m.request_id === req.request_id);
  ok("A: now sees Bravo agreed", agreed?.status === "agreed" && agreed.first_name === "Bravo", JSON.stringify(agreed));

  // Chat: locked until they meet.
  must(await A.db.from("messages").insert({ match_request_id: req.request_id, sender_id: A.id, body: "Hey, keen for Tuesday?" }));
  const locked = await B.db.from("messages").insert({ match_request_id: req.request_id, sender_id: B.id, body: "Yep. My number is 0491 570 156" });
  ok("B: phone number in chat is refused before meeting", Boolean(locked.error?.message.includes("contact_details_locked")), locked.error?.details);
  const noContact = must(await B.db.from("private_contacts").select("*").eq("id", A.id).maybeSingle());
  ok("B: can't read A's contact details before meeting", noContact === null);

  // QR handshake: A shows a code, B scans it.
  const pressA = await handshake(A, { action: "press", match_request_id: req.request_id, method: "qr" });
  ok("A: press (qr) gives a session key", Boolean(pressA.press_id && pressA.session_key), JSON.stringify(pressA).slice(0, 80));
  const reportA = await handshake(A, { action: "report", press_id: pressA.press_id, heard: [], location: HERE });
  ok("A: report -> waiting", reportA.status === "waiting", reportA.reason ?? reportA.status);
  const pressB = await handshake(B, { action: "press", match_request_id: req.request_id, method: "qr" });
  const slot = Math.floor(Date.now() / 1000 / (pressA.slot_seconds ?? 5));
  const reportB = await handshake(B, { action: "report", press_id: pressB.press_id, heard: [{ token: tokenFor(pressA.session_key, slot), via: "qr" }], location: HERE });
  ok("B: scanned A's code -> connected with contact details", reportB.status === "connected" && reportB.contact?.full_name === "Alpha Test", JSON.stringify(reportB).slice(0, 120));
  const statusA = await handshake(A, { action: "status", press_id: pressA.press_id });
  ok("A: status -> connected with Bravo's details", statusA.status === "connected" && statusA.contact?.full_name === "Bravo Test", JSON.stringify(statusA).slice(0, 120));

  const after = await B.db.from("messages").insert({ match_request_id: req.request_id, sender_id: B.id, body: "Great to meet you. 0491 570 156" });
  ok("B: contact details allowed after meeting", !after.error, after.error?.message);
  const contact = must(await B.db.from("private_contacts").select("*").eq("id", A.id).maybeSingle());
  ok("B: can read A's contact details now", contact?.full_name === "Alpha Test");
  const done = must(await A.db.from("objectives").select("status").eq("id", objective.id).single());
  ok("A: objective marked done", done.status === "done", done.status);
  const stale = await handshake(B, { action: "report", press_id: pressB.press_id, heard: [{ token: tokenFor(pressA.session_key, slot - 20), via: "qr" }], location: HERE });
  ok("an old code still reports connected (already met)", stale.status === "connected");

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
