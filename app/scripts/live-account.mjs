// Live check of pricing, blocking and account deletion against the real project.
// A (+61491570101) and B (+61491570102) have met; C is +61491570103; Z
// (+61491570109) is a throwaway account that gets deleted each run.
//   node scripts/live-account.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };
const must = r => { if (r.error) throw new Error(r.error.message + (r.error.details ? " | " + r.error.details : "")); return r.data; };

async function sql(query, allowError = false) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const body = await r.json();
  if (!r.ok && !allowError) throw new Error(`SQL failed: ${JSON.stringify(body).slice(0, 300)}`);
  return r.ok ? body : { error: JSON.stringify(body) };
}

async function signIn(phone, code = "123456") {
  const db = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.auth.signInWithOtp({ phone });
  const { data, error } = await db.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw new Error(`Sign-in failed for ${phone}: ${error.message}`);
  return { db, id: data.user.id };
}
const dob = years => { const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setMonth(0, 15); return d.toISOString().slice(0, 10); };
const hashOf = e164 => createHash("sha256").update(e164).digest("hex");

(async () => {
  console.log("Project:", URL_);
  const A = await signIn("+61491570101"), B = await signIn("+61491570102"), C = await signIn("+61491570103");

  // ---- Pricing ----
  const plan = must(await C.db.rpc("my_plan"))[0];
  ok("pilot: payments aren't live yet", plan.payments_live === false, JSON.stringify(plan));
  const allowance = must(await C.db.rpc("objective_allowance"))[0];
  ok("pilot: everyone can set plans", allowance.plan === "unlimited" && allowance.remaining === null, JSON.stringify(allowance));
  const paywall = await sql(`begin;
    update private.settings set value = 'true' where key = 'payments_live';
    insert into public.objectives (owner_id, type, text, group_size) values ('${C.id}', 'dinner', 'Someone to join me for a midweek dinner', 0);
    rollback;`, true);
  ok("payments live: no subscription, no plan", Boolean(paywall.error?.includes("subscription_needed")), (paywall.error ?? "inserted").slice(0, 120));
  const subscribed = await sql(`begin;
    update private.settings set value = 'true' where key = 'payments_live';
    insert into public.subscriptions (user_id, plan, current_period_end, in_trial) values ('${C.id}', 'unlimited', now() + interval '7 days', true)
      on conflict (user_id) do update set plan = 'unlimited', current_period_end = now() + interval '7 days', in_trial = true;
    select a.plan from private.allowance('${C.id}') a;
    rollback;`);
  ok("payments live: a trial subscriber can set plans", subscribed[0]?.plan === "unlimited", JSON.stringify(subscribed));
  const lapsed = await sql(`begin;
    update private.settings set value = 'true' where key = 'payments_live';
    insert into public.subscriptions (user_id, plan, current_period_end) values ('${C.id}', 'unlimited', now() - interval '1 day')
      on conflict (user_id) do update set plan = 'unlimited', current_period_end = now() - interval '1 day';
    select a.plan from private.allowance('${C.id}') a;
    rollback;`);
  ok("payments live: a lapsed subscription can't", lapsed[0]?.plan === "free", JSON.stringify(lapsed));

  // ---- Block ----
  const objective = (await A.db.from("objectives").select("id").eq("owner_id", A.id).order("created_at").limit(1)).data?.[0];
  const withB = objective ? ((await A.db.rpc("my_matches", { p_objective: objective.id })).data ?? []).find(m => m.candidate_id === B.id) : null;
  if (!withB) throw new Error("A and B have no match. Run live-smoke.mjs with 61491570101 and 61491570102 first.");
  must(await A.db.from("blocks").insert({ blocker_id: A.id, blocked_id: B.id }));
  const blockedMsg = await B.db.from("messages").insert({ match_request_id: withB.request_id, sender_id: B.id, body: "Still there?" });
  ok("A blocks B: B can't message A", Boolean(blockedMsg.error), blockedMsg.error?.message);
  const card = must(await B.db.rpc("profile_card", { p_user: A.id }));
  ok("A blocks B: B can't see A's card", card.length === 0);
  const peek = must(await B.db.from("blocks").select("*").eq("blocker_id", A.id));
  ok("B can't see that A blocked them", peek.length === 0);
  must(await A.db.from("blocks").delete().eq("blocker_id", A.id).eq("blocked_id", B.id));
  const after = await B.db.from("messages").insert({ match_request_id: withB.request_id, sender_id: B.id, body: "Unblock check" });
  ok("A unblocks B: messages work again", !after.error, after.error?.message);

  // ---- Delete my account ----
  const Z = await signIn("+61491570109");
  const hasProfile = must(await Z.db.from("profiles").select("id").eq("id", Z.id).maybeSingle());
  if (!hasProfile) must(await Z.db.from("profiles").insert({ id: Z.id, first_name: "Zed", interests: ["Gym", "Music"], free_times: ["Sundays"], date_of_birth: dob(30) }));
  const v = await Z.db.functions.invoke("verify-stub", { body: { date_of_birth: dob(30) } });
  ok("Z: signed up and verified", !v.error, v.error?.message);
  must(await Z.db.from("reports").insert({ reporter_id: Z.id, reported_id: C.id, reason: "spam", details: "live-account test" }));
  must(await C.db.from("reports").insert({ reporter_id: C.id, reported_id: Z.id, reason: "fake", details: "live-account test" }));
  must(await Z.db.rpc("delete_my_account"));
  const zHash = hashOf("+61491570109");
  const [gone] = await sql(`select (select count(*) from auth.users where id = '${Z.id}')::int as users, (select count(*) from public.profiles where id = '${Z.id}')::int as profiles,
                                   (select count(*) from public.reports where '${Z.id}' in (reporter_id, reported_id))::int as live_reports`);
  ok("Z deleted: sign-in, profile and live reports gone", gone.users === 0 && gone.profiles === 0 && gone.live_reports === 0, JSON.stringify(gone));
  const [kept] = await sql(`select (select count(*) from private.retained_reports where '${zHash}' in (reporter_phone_hash, reported_phone_hash) and details = 'live-account test')::int as retained,
                                   (select reports_made || '/' || reports_against from private.deleted_accounts where phone_hash = '${zHash}' order by deleted_at desc limit 1) as counts`);
  ok("Z deleted: both reports kept for the safety team, by fingerprint", kept.retained === 2 && kept.counts === "1/1", JSON.stringify(kept));
  await sql(`delete from private.retained_reports where details = 'live-account test'; delete from private.deleted_accounts where phone_hash = '${zHash}';`);

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
