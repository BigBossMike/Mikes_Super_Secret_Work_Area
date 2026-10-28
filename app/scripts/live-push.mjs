// Live check of push notifications against the real Supabase project.
//
// Part 1 sends for real: A registers a made-up Expo token, B messages A, and
// Expo's reply is read back from pg_net (it answers "not a registered
// recipient", which proves the database reached Expo with a well-formed push).
// Part 2 checks every notification's wording inside a transaction that is
// rolled back, so nothing is saved and nothing is sent.
//
// Needs app/.env.local (URL, publishable key, SUPABASE_ACCESS_TOKEN) and the
// smoke-test people: A (+61491570101) and B (+61491570102) have met; C is
// +61491570103.   node scripts/live-push.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`SQL failed: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function signIn(phone, code = "123456") {
  const db = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.auth.signInWithOtp({ phone });
  const { data, error } = await db.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw new Error(`Sign-in failed for ${phone}: ${error.message}`);
  return { db, id: data.user.id };
}

(async () => {
  console.log("Project:", URL_);
  const A = await signIn("+61491570101"), B = await signIn("+61491570102"), C = await signIn("+61491570103");
  const fake = `ExponentPushToken[introTest${Date.now()}]`;

  // ---- Part 1: a real send ------------------------------------------------
  const reg = await A.db.rpc("register_push_token", { p_token: fake, p_platform: "ios" });
  ok("A: registers a token", !reg.error, reg.error?.message);
  const bad = await A.db.rpc("register_push_token", { p_token: "not-a-token", p_platform: "ios" });
  ok("A: a malformed token is refused", Boolean(bad.error), bad.error?.message);
  const peek = await B.db.from("push_tokens").select("*");
  ok("B: can't read anyone's tokens", Boolean(peek.error) || (peek.data ?? []).length === 0, peek.error?.message ?? `${peek.data?.length} rows`);

  const objective = (await A.db.from("objectives").select("id, text").eq("owner_id", A.id).order("created_at").limit(1)).data?.[0];
  const matches = objective ? (await A.db.rpc("my_matches", { p_objective: objective.id })).data ?? [] : [];
  const withB = matches.find(m => m.candidate_id === B.id);
  if (!withB) throw new Error("A and B have no match yet. Run live-smoke.mjs with 61491570101 and 61491570102 first.");

  const [{ last }] = await sql("select coalesce(max(id), 0) as last from net._http_response");
  const sent = await B.db.from("messages").insert({ match_request_id: withB.request_id, sender_id: B.id, body: "Push test from B" });
  ok("B: messages A", !sent.error, sent.error?.message);
  let replies = [];
  for (let i = 0; i < 15 && !replies.length; i++) {
    await sleep(1000);
    replies = await sql(`select status_code, content::text as content from net._http_response where id > ${last} and content::text like '%${fake.slice(18, -1)}%'`);
  }
  ok("database reached Expo for A's token", replies.length === 1 && replies[0].status_code === 200, replies[0] ? `${replies[0].status_code} ${replies[0].content.slice(0, 140)}` : "no reply within 15 s");

  const unreg = await A.db.rpc("unregister_push_token", { p_token: fake });
  ok("A: removes the token", !unreg.error, unreg.error?.message);
  const left = await sql(`select count(*)::int as n from public.push_tokens where token = '${fake}'`);
  ok("token gone", left[0].n === 0);

  // ---- Part 2: the wording, rolled back -----------------------------------
  const tA = "ExponentPushToken[introTestA]", tC = "ExponentPushToken[introTestC]";
  const queued = await sql(`
    begin;
    insert into public.push_tokens (token, user_id, platform) values ('${tA}', '${A.id}', 'ios'), ('${tC}', '${C.id}', 'ios');
    -- C is asked about A's plan, then says yes
    insert into public.match_requests (objective_id, candidate_id, score, reasons) values ('${objective.id}', '${C.id}', 80, '{}');
    update public.match_requests set status = 'agreed', responded_at = now() where objective_id = '${objective.id}' and candidate_id = '${C.id}';
    -- a parent (C stands in) decides on A's plan, approves the account, and gets alerts
    update public.objectives set status = 'pending_guardian' where id = '${objective.id}';
    update public.objectives set status = 'active', decided_by = null where id = '${objective.id}';
    update public.objectives set status = 'pending_guardian' where id = '${objective.id}';
    update public.objectives set status = 'rejected', decided_by = null where id = '${objective.id}';
    insert into public.guardians (teen_id, guardian_id, relationship, invite_phone, status) values ('${A.id}', '${C.id}', 'mum', '+61491570103', 'pending');
    update public.guardians set status = 'approved', approved_at = now() where teen_id = '${A.id}' and guardian_id = '${C.id}';
    insert into public.guardian_notifications (guardian_id, teen_id, kind, payload) values
      ('${C.id}', '${A.id}', 'objective_pending', '{"text": "A fifth player for Tuesday football"}'),
      ('${C.id}', '${A.id}', 'connected', '{"with_first_name": "Bravo", "suburb": "Toowong"}'),
      ('${C.id}', '${A.id}', 'meetup', '{"with_first_name": "Bravo", "place": "Toowong Sports Centre", "meet_at": "2026-10-29T08:00:00Z"}'),
      ('${C.id}', '${A.id}', 'report', '{"role": "made a report"}');
    -- discreet: A turns it on, then gets one more
    update public.profiles set discreet_notifications = true where id = '${A.id}';
    select private.push('${A.id}', 'Bravo', 'Secret plan details', '/home');
    select q.id, convert_from(q.body, 'UTF8') as body from net.http_request_queue q where convert_from(q.body, 'UTF8') like '%introTest%' order by q.id;
    rollback;`);
  const msgs = queued.map(r => JSON.parse(r.body)).flat();
  const say = msgs.map(m => `${m.to === tA ? "A" : "C"}: ${m.title ?? "(no title)"} | ${m.body} | ${m.data?.url}`);
  say.forEach(s => console.log("      " + s));
  const has = (who, title, bodyStart, url) => say.some(s => s.startsWith(`${who}: ${title} | ${bodyStart}`) && s.endsWith(`| ${url}`));
  ok("C asked: 'Alpha asked if you're keen' with the plan, opens Requests", has("C", "Alpha asked if you're keen", objective.text, "/requests"));
  ok("A told: 'Charlie is keen', opens Matches", has("A", "Charlie is keen", "Said yes to your plan.", "/matches"));
  ok("A told: plan approved, opens Home", has("A", "Your plan is approved", "Intro is asking people now.", "/home"));
  ok("A told: plan turned down, with the plan", has("A", "Plan not approved", "Your parent turned down: " + objective.text, "/home") || has("A", "Plan not approved", "Mum turned down: " + objective.text, "/home"));
  ok("A told: account approved by Mum", has("A", "You're all set", "Mum approved your account.", "/home"));
  ok("parent: new plan to OK", has("C", "Alpha has a new plan", "A fifth player for Tuesday football. Tap to approve", "/parent"));
  ok("parent: met someone", has("C", "Alpha met Bravo", "They connected in person near Toowong.", "/parent"));
  ok("parent: meet-up with place and Brisbane time", has("C", "Alpha is meeting Bravo", "Toowong Sports Centre, Thursday 6:00pm", "/parent"));
  ok("parent: report", has("C", "Alpha made a report", "Intro's safety team will look at it.", "/parent"));
  ok("discreet: no title, no details", has("A", "(no title)", "Intro: you have an update", "/home") && !say.some(s => s.includes("Secret plan details")));
  const after = await sql(`select count(*)::int as n from public.push_tokens where token in ('${tA}', '${tC}')`);
  ok("rolled back: nothing kept", after[0].n === 0);

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
