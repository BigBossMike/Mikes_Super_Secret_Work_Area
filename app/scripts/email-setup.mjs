// Connects Intro's sign-in emails to Azure Communication Services, the same
// email service Cavalry's sign-in (oidc) uses. Needs two lines in app/.env.local,
// the same names oidc uses:
//   AZURE_COMMS_CONN_STR=endpoint=https://...communication.azure.com/;accesskey=...
//   EMAIL_SENDER=Support@cavalry.software   (a verified MailFrom address on that service)
// It stores them as Supabase secrets, turns on Supabase's "send email" hook
// (supabase/functions/send-email) with a fresh signing secret, then, if given an
// address, sends a real sign-in code:   node scripts/email-setup.mjs mike@cavalry.au
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
const CONN = env.AZURE_COMMS_CONN_STR ?? "", FROM = env.EMAIL_SENDER ?? "";
const fail = msg => { console.error("STOP:", msg); process.exit(1); };
if (!/endpoint=https:\/\/[^;]+;accesskey=.+/i.test(CONN)) fail("app/.env.local needs AZURE_COMMS_CONN_STR=endpoint=https://...;accesskey=...");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(FROM)) fail("app/.env.local needs EMAIL_SENDER=a verified sender address, e.g. Support@cavalry.software");

async function mgmt(method, path, body) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/${path}`, {
    method, headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) fail(`Supabase ${path}: ${r.status} ${await r.text()}`);
  return r.json().catch(() => null);
}

(async () => {
  const hookSecret = `v1,whsec_${randomBytes(32).toString("base64")}`;
  await mgmt("POST", "secrets", [
    { name: "AZURE_COMMS_CONN_STR", value: CONN }, { name: "EMAIL_SENDER", value: FROM }, { name: "SEND_EMAIL_HOOK_SECRET", value: hookSecret },
  ]);
  console.log("Saved the Azure email details and the hook's signing secret as Supabase secrets.");

  await mgmt("PATCH", "config/auth", {
    hook_send_email_enabled: true, hook_send_email_uri: `${URL_}/functions/v1/send-email`, hook_send_email_secrets: hookSecret,
    mailer_otp_length: 6, mailer_otp_exp: 600, rate_limit_email_sent: 100,
  });
  console.log(`Sign-in emails now go through Azure Communication Services from ${FROM}, with the 6-digit code.`);

  const to = process.argv[2];
  if (to) {
    await new Promise(r => setTimeout(r, 8000));   // secrets take a few seconds to reach the function
    const s = await fetch(`${URL_}/auth/v1/otp`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: to, create_user: true }) });
    console.log(s.ok ? `Sent a sign-in code to ${to}. Check the inbox (and junk).` : `Sending to ${to} failed: ${s.status} ${(await s.text()).slice(0, 300)}`);
  }
})().catch(e => fail(e.message));
