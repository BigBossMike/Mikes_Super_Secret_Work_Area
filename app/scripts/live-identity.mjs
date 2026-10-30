// Live check of the Stripe ID check (test keys): a throwaway person (Zed,
// +61491570109) starts a check, the app's "check" sees it waiting, then the
// session is cancelled in Stripe and Stripe's webhook must update our record.
// Zed is deleted at the end.   node scripts/live-identity.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN, SK = env.STRIPE_SECRET_KEY;
const REF = new URL(URL_).hostname.split(".")[0];
let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };
const sql = async query => (await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).json();
const dob = years => { const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setMonth(0, 15); return d.toISOString().slice(0, 10); };

(async () => {
  const db = createClient(URL_, ANON, { auth: { persistSession: false } });
  await db.auth.signInWithOtp({ phone: "+61491570109" });
  const { data } = await db.auth.verifyOtp({ phone: "+61491570109", token: "123456", type: "sms" });
  const zed = data.user.id;
  const has = (await db.from("profiles").select("id").eq("id", zed).maybeSingle()).data;
  if (!has) await db.from("profiles").insert({ id: zed, first_name: "Zed", interests: ["Gym", "Music"], free_times: ["Sundays"], date_of_birth: dob(30) });

  const config = await db.functions.invoke("identity", { body: { action: "config" } });
  ok("server says Stripe is set up", config.data?.configured === true);
  const start = await db.functions.invoke("identity", { body: { action: "start" } });
  const s = start.data ?? {};
  ok("start: Stripe session and single-use phone key", String(s.session_id).startsWith("vs_") && String(s.ephemeral_key_secret).startsWith("ek_"),
    start.error ? (await start.error.context?.text?.()) ?? start.error.message : `${String(s.session_id).slice(0, 8)}…, ${String(s.ephemeral_key_secret).slice(0, 6)}…`);
  const check = await db.functions.invoke("identity", { body: { action: "check" } });
  ok("check: waiting for the person", check.data?.status === "requires_input", JSON.stringify(check.data));

  if (s.session_id) {
    const r = await fetch(`https://api.stripe.com/v1/identity/verification_sessions/${s.session_id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${SK}` } });
    ok("cancelled in Stripe", r.ok, String(r.status));
    let row;
    for (let i = 0; i < 15; i++) {
      await new Promise(res => setTimeout(res, 2000));
      [row] = await sql(`select status from public.identity_checks where session_id = '${s.session_id}'`);
      if (row?.status === "canceled") break;
    }
    ok("Stripe's webhook reached Intro and updated the record", row?.status === "canceled", JSON.stringify(row));
  }
  const p = (await db.from("profiles").select("verified_at").eq("id", zed).single()).data;
  ok("Zed is still not verified", p?.verified_at === null);

  await db.rpc("delete_my_account");
  const hash = createHash("sha256").update("+61491570109").digest("hex");
  await sql(`delete from private.deleted_accounts where phone_hash = '${hash}'`);
  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
