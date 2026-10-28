// Sets up the two-phone test: a test person, "Sam" (+61491570106, code 123456),
// sets a plan that matches Mike, and Intro asks Mike. Mike's phone gets the
// request notification; he says yes; both phones open the chat and press
// Connect together (Bluetooth, or QR as the fallback).
//
// Sam is 48 with Mike's interests, so Mike (49, pairs with 45-52) is the only
// person in range. Run once, on the night:   node scripts/bluetooth-test-setup.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
const MIKE_PHONE = "61407702962";
const must = r => { if (r.error) throw new Error(`${r.error.message}${r.error.details ? " | " + r.error.details : ""}${r.error.hint ? " | " + r.error.hint : ""}`); return r.data; };

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`SQL failed: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const dob = years => { const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setMonth(0, 15); return d.toISOString().slice(0, 10); };

(async () => {
  const db = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await db.auth.signInWithOtp({ phone: "+61491570106" }));
  const { data, error } = await db.auth.verifyOtp({ phone: "+61491570106", token: "123456", type: "sms" });
  if (error) throw error;
  const sam = data.user.id;

  must(await db.from("profiles").update({ first_name: "Sam", interests: ["Football", "Food", "Movies"], free_times: ["Saturdays"], match_age_min: null, match_age_max: null }).eq("id", sam));
  const v = await db.functions.invoke("verify-stub", { body: { date_of_birth: dob(48) } });
  if (v.error) throw new Error(`verify-stub: ${v.error.message}`);
  console.log("Sam: 48, into football, food and movies, free Saturdays, verified");

  const existing = must(await db.from("objectives").select("id, text, status").eq("owner_id", sam).in("status", ["active", "pending_guardian"]));
  const plan = existing[0] ?? must(await db.from("objectives").insert({
    owner_id: sam, type: "sport", text: "Someone to watch the footy with on Saturday", when_text: "Saturday arvo", where_text: "Brisbane", group_size: 0,
  }).select("id, text, status").single());
  console.log(`Sam's plan: "${plan.text}" (${plan.status})`);

  const asked = must(await db.rpc("find_matches", { p_objective: plan.id }));
  const [m] = await sql(`select count(*)::int as n from public.match_requests mr join auth.users u on u.id = mr.candidate_id
                         where mr.objective_id = '${plan.id}' and u.phone = '${MIKE_PHONE}'`);
  console.log(`Intro asked ${asked} new ${asked === 1 ? "person" : "people"}; Mike asked: ${m.n === 1 ? "yes" : "no"}`);
  if (m.n !== 1) { console.log("Mike wasn't asked. Check his age range, that he can be put forward, and that he hasn't had 3 requests this week."); process.exit(1); }
  console.log("\nNext: Mike's phone shows \"Sam asked if you're keen\". Say yes. The second phone signs in as 0491 570 106 (code 123456).");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
