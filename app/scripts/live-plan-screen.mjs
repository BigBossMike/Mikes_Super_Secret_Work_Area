// Live check of plan screening: the database must agree with the app on every
// phrase in src/lib/planScreen.fixtures.json, and refuse a real plan that
// reads as dating. Needs app/.env.local (URL, publishable key, SUPABASE_ACCESS_TOKEN).
//   node scripts/live-plan-screen.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
const fixtures = JSON.parse(readFileSync(new URL("../src/lib/planScreen.fixtures.json", import.meta.url), "utf8"));
let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };
const lit = s => `'${s.replace(/'/g, "''")}'`;

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`SQL failed: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

(async () => {
  console.log("Project:", URL_);
  const rows = await sql(`select x.n, private.plan_issue(x.t, x.m) as kind from (values ${fixtures.map((f, i) => `(${i}, ${lit(f.text)}, ${f.minor})`).join(", ")}) as x(n, t, m) order by x.n`);
  fixtures.forEach((f, i) => ok(`${f.minor ? "16-17" : "adult"}: "${f.text}"`, rows[i].kind === f.expect, `database says ${rows[i].kind ?? "allowed"}, expected ${f.expect ?? "allowed"}`));

  // A real plan from a signed-in adult (C, +61491570103) that reads as dating is refused, with the reason.
  const db = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.auth.signInWithOtp({ phone: "+61491570103" });
  const { data } = await db.auth.verifyOtp({ phone: "+61491570103", token: "123456", type: "sms" });
  const r = await db.from("objectives").insert({ owner_id: data.user.id, type: "dinner", text: "Looking for a date this Friday night", group_size: 0 });
  ok("a dating plan is refused by the database", r.error?.message === "objective_not_allowed" && r.error?.details === "dating", `${r.error?.message} | ${r.error?.details} | ${r.error?.hint}`);

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
