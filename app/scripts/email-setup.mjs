// Connects Resend so Intro's sign-in emails go out with a 6-digit code.
// Needs two lines in app/.env.local:
//   RESEND_API_KEY=re_...                 (Resend > API Keys, sending access)
//   EMAIL_FROM=intro@mail.cavalry.au      (an address on a domain verified in Resend)
// Sets Supabase's sign-in email to send through Resend, puts the code in the
// email, and allows 100 emails an hour. Then, if given an address, sends a real
// sign-in code to it so you can see one arrive:
//   node scripts/email-setup.mjs you@example.com
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
const KEY = env.RESEND_API_KEY ?? "", FROM = env.EMAIL_FROM ?? "";
const fail = msg => { console.error("STOP:", msg); process.exit(1); };
if (!KEY.startsWith("re_")) fail("app/.env.local needs RESEND_API_KEY=re_... (Resend > API Keys).");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(FROM)) fail("app/.env.local needs EMAIL_FROM=intro@your-verified-domain.");

const body = (title, line) => `<h2>${title}</h2>
<p>${line}</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:24px 0">{{ .Token }}</p>
<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
<p>Intro</p>`;

(async () => {
  // The sending domain must be verified in Resend, or every email bounces.
  const domains = await (await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${KEY}` } })).json();
  const domain = FROM.split("@")[1].toLowerCase();
  const d = (domains.data ?? []).find(x => x.name?.toLowerCase() === domain);
  if (domains.statusCode === 401 || domains.name === "restricted_api_key") console.log("(The key can only send, so the domain check is skipped.)");
  else if (!d) fail(`${domain} isn't in Resend yet. Add it under Domains and add its DNS records.`);
  else if (d.status !== "verified") fail(`${domain} is in Resend but not verified yet (status: ${d.status}). Check its DNS records, then press Verify in Resend.`);
  else console.log(`${domain} is verified in Resend.`);

  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
    method: "PATCH", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      smtp_admin_email: FROM, smtp_sender_name: "Intro", smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend", smtp_pass: KEY,
      smtp_max_frequency: 30, rate_limit_email_sent: 100,
      mailer_otp_length: 6, mailer_otp_exp: 600,
      mailer_subjects_magic_link: "{{ .Token }} is your Intro code",
      mailer_templates_magic_link_content: body("Your Intro code", "Enter this code in Intro to sign in:"),
      mailer_subjects_confirmation: "{{ .Token }} is your Intro code",
      mailer_templates_confirmation_content: body("Welcome to Intro", "Enter this code in Intro to finish signing up:"),
    }),
  });
  if (!r.ok) fail(`Supabase: ${r.status} ${await r.text()}`);
  console.log(`Sign-in emails now go through Resend from ${FROM}, with the code in the email.`);

  const to = process.argv[2];
  if (to) {
    const s = await fetch(`${URL_}/auth/v1/otp`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: to, create_user: true }) });
    console.log(s.ok ? `Sent a sign-in code to ${to}. Check the inbox (and junk).` : `Sending to ${to} failed: ${s.status} ${await s.text()}`);
  }
})().catch(e => fail(e.message));
