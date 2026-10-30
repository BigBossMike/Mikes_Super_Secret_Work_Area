// Connects Intro's sign-in emails to Microsoft 365, the same way Cavalry's hub
// sends email (an Azure app with the Mail.Send permission, through Microsoft Graph).
// Needs four lines in app/.env.local, the same names the hub uses:
//   AZURE_TENANT_ID=...
//   AZURE_CLIENT_ID=...
//   AZURE_CLIENT_SECRET=...
//   GRAPH_FROM_ADDRESS=...   (the mailbox the emails come from)
// It checks Microsoft accepts the app, stores the four as Supabase secrets,
// turns on Supabase's "send email" hook (supabase/functions/send-email) with a
// fresh signing secret, then, if given an address, sends a real sign-in code:
//   node scripts/email-setup.mjs mike@cavalry.au
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
const T = env.AZURE_TENANT_ID ?? "", C = env.AZURE_CLIENT_ID ?? "", S = env.AZURE_CLIENT_SECRET ?? "", FROM = env.GRAPH_FROM_ADDRESS ?? "";
const fail = msg => { console.error("STOP:", msg); process.exit(1); };
for (const [k, v] of Object.entries({ AZURE_TENANT_ID: T, AZURE_CLIENT_ID: C, AZURE_CLIENT_SECRET: S, GRAPH_FROM_ADDRESS: FROM })) if (!v) fail(`app/.env.local needs ${k}=`);

async function mgmt(method, path, body) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/${path}`, {
    method, headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) fail(`Supabase ${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

(async () => {
  // Microsoft accepts the app (a token is enough to prove the tenant, id and secret are right).
  const tok = await fetch(`https://login.microsoftonline.com/${T}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: C, client_secret: S, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
  });
  const tj = await tok.json();
  if (!tok.ok) fail(`Microsoft didn't accept the app: ${tj.error_description?.split("\r")[0] ?? tj.error}`);
  const roles = JSON.parse(Buffer.from(tj.access_token.split(".")[1], "base64url").toString()).roles ?? [];
  if (!roles.includes("Mail.Send")) fail(`The Azure app doesn't have the Mail.Send application permission (it has: ${roles.join(", ") || "none"}).`);
  console.log("Microsoft accepts the app, and it can send mail.");

  const hookSecret = `v1,whsec_${randomBytes(32).toString("base64")}`;
  await mgmt("POST", "secrets", [
    { name: "GRAPH_TENANT_ID", value: T }, { name: "GRAPH_CLIENT_ID", value: C }, { name: "GRAPH_CLIENT_SECRET", value: S },
    { name: "GRAPH_FROM_ADDRESS", value: FROM }, { name: "SEND_EMAIL_HOOK_SECRET", value: hookSecret },
  ]);
  console.log("Saved the Microsoft details and the hook's signing secret as Supabase secrets.");

  await mgmt("PATCH", "config/auth", {
    hook_send_email_enabled: true, hook_send_email_uri: `${URL_}/functions/v1/send-email`, hook_send_email_secrets: hookSecret,
    mailer_otp_length: 6, mailer_otp_exp: 600, rate_limit_email_sent: 100,
  });
  console.log(`Sign-in emails now go through Microsoft 365 from ${FROM}, with the 6-digit code.`);

  const to = process.argv[2];
  if (to) {
    await new Promise(r => setTimeout(r, 5000));   // secrets take a few seconds to reach the function
    const s = await fetch(`${URL_}/auth/v1/otp`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: to, create_user: true }) });
    console.log(s.ok ? `Sent a sign-in code to ${to}. Check the inbox (and junk).` : `Sending to ${to} failed: ${s.status} ${(await s.text()).slice(0, 300)}`);
  }
})().catch(e => fail(e.message));
