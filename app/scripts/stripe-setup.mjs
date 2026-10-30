// Connects Stripe Identity once Mike has put two Stripe keys in app/.env.local:
//   STRIPE_SECRET_KEY=sk_test_...         (Developers > API keys > Secret key)
//   STRIPE_IDENTITY_READ_KEY=rk_test_...  (a restricted key: "Identity Verification Results"
//                                          and "Recent Detailed Verification Results" set to Read)
// It stores both as Supabase secrets, creates the Stripe webhook that tells
// identity-webhook about finished checks (and stores its signing secret), then
// checks the identity function now says it's set up. Keys are never printed.
//   node scripts/stripe-setup.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
const SK = env.STRIPE_SECRET_KEY ?? "", RK = env.STRIPE_IDENTITY_READ_KEY ?? "";
const STRIPE_VERSION = "2026-10-28.endive";
const WEBHOOK_URL = `${URL_}/functions/v1/identity-webhook`;
const EVENTS = ["verified", "requires_input", "processing", "canceled"].map(e => `identity.verification_session.${e}`);

const fail = msg => { console.error("STOP:", msg); process.exit(1); };
const mode = k => (k.includes("_test_") ? "test" : k.includes("_live_") ? "live" : "?");
if (!/^sk_(test|live)_/.test(SK)) fail("app/.env.local needs STRIPE_SECRET_KEY=sk_test_... (the Secret key, not the Publishable key).");
if (!/^rk_(test|live)_/.test(RK)) fail("app/.env.local needs STRIPE_IDENTITY_READ_KEY=rk_test_... (the restricted key).");
if (mode(SK) !== mode(RK)) fail("The two keys must both be test keys, or both live keys.");
console.log(`Stripe keys found (${mode(SK)} mode).`);

async function stripe(method, path, params) {
  const body = params ? new URLSearchParams(params.flatMap(([k, v]) => (Array.isArray(v) ? v.map(x => [k, x]) : [[k, v]]))).toString() : undefined;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${SK}`, "Stripe-Version": STRIPE_VERSION, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body,
  });
  const j = await r.json();
  if (!r.ok) fail(`Stripe ${path}: ${j?.error?.message ?? r.status}`);
  return j;
}
async function setSecrets(pairs) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify(pairs.map(([name, value]) => ({ name, value }))),
  });
  if (!r.ok) fail(`Supabase secrets: ${r.status} ${await r.text()}`);
}

(async () => {
  // The read key really can read Identity results (a 404 for a made-up session means the permission is there).
  const probe = await fetch("https://api.stripe.com/v1/identity/verification_sessions?limit=1", { headers: { Authorization: `Bearer ${RK}`, "Stripe-Version": STRIPE_VERSION } });
  if (probe.status === 401 || probe.status === 403) fail("The restricted key can't read Identity results. Set \"Identity Verification Results\" and \"Recent Detailed Verification Results\" to Read.");
  console.log("Restricted key can read Identity results.");

  await setSecrets([["STRIPE_SECRET_KEY", SK], ["STRIPE_IDENTITY_READ_KEY", RK]]);
  console.log("Saved both keys as Supabase secrets.");

  // One webhook for this project. Its signing secret is only shown when it's created, so replace any old one.
  const existing = (await stripe("GET", "webhook_endpoints?limit=100")).data.filter(w => w.url === WEBHOOK_URL);
  for (const w of existing) await stripe("DELETE", `webhook_endpoints/${w.id}`);
  const hook = await stripe("POST", "webhook_endpoints", [["url", WEBHOOK_URL], ["enabled_events[]", EVENTS], ["description", "Intro ID checks"]]);
  await setSecrets([["STRIPE_WEBHOOK_SECRET", hook.secret]]);
  console.log(`Webhook created (${EVENTS.length} events) and its signing secret saved.`);

  // The identity function should now say it's set up (secrets take a few seconds to reach functions).
  const db = createClient(URL_, ANON, { auth: { persistSession: false } });
  await db.auth.signInWithOtp({ phone: "+61491570103" });
  await db.auth.verifyOtp({ phone: "+61491570103", token: "123456", type: "sms" });
  for (let i = 0; i < 10; i++) {
    const { data } = await db.functions.invoke("identity", { body: { action: "config" } });
    if (data?.configured) { console.log("\nREADY: the app now uses Stripe for the ID check."); process.exit(0); }
    await new Promise(r => setTimeout(r, 3000));
  }
  fail("The identity function still says it isn't set up. Wait a minute and run this again.");
})().catch(e => fail(e.message));
