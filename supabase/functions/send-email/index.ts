// send-email: Supabase Auth's "send email" hook. Instead of Supabase's own
// sender, Auth hands us each sign-in email and we send it through Microsoft
// 365 (Microsoft Graph), the same way Cavalry's hub sends its email.
// The email carries the 6-digit code, so people type it into the app.
//
// Deployed without the sign-in check (Auth calls it, not a person); every call
// must carry a valid Standard Webhooks signature made with SEND_EMAIL_HOOK_SECRET.
//   supabase functions deploy send-email --no-verify-jwt --use-api
// Secrets: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET (an Azure app
// with the Mail.Send application permission), GRAPH_FROM_ADDRESS (the mailbox
// it sends from) and SEND_EMAIL_HOOK_SECRET ("v1,whsec_...").

interface HookPayload {
  user: { email?: string; new_email?: string };
  email_data: { token: string; token_new?: string; email_action_type: string };
}

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), { status, headers: { "Content-Type": "application/json" } });

// ---- Standard Webhooks signature: base64(HMAC-SHA256(secret, "<id>.<timestamp>.<body>")) ----
async function signatureOk(req: Request, body: string): Promise<boolean> {
  const secret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(/^v1,/, "").replace(/^whsec_/, "");
  const id = req.headers.get("webhook-id"), ts = req.headers.get("webhook-timestamp"), sigs = req.headers.get("webhook-signature");
  if (!secret || !id || !ts || !sigs || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(secret), c => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(" ").some(s => {
    const [v, sig] = s.split(",");
    return v === "v1" && sig?.length === expected.length && [...sig].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0;
  });
}

// ---- Microsoft Graph: app-only token, cached until shortly before it expires ----
let cached: { token: string; until: number } | null = null;
async function graphToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const tenant = Deno.env.get("GRAPH_TENANT_ID")!;
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GRAPH_CLIENT_ID")!, client_secret: Deno.env.get("GRAPH_CLIENT_SECRET")!,
      scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Microsoft sign-in: ${j.error_description ?? j.error ?? r.status}`);
  cached = { token: j.access_token, until: Date.now() + (j.expires_in - 120) * 1000 };
  return cached.token;
}

const page = (heading: string, line: string, code: string) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#15213B;max-width:480px">
<p style="font-size:22px;font-weight:bold;margin:0 0 16px">intro<span style="color:#12A150">.</span></p>
<h2 style="margin:0 0 8px">${heading}</h2>
<p>${line}</p>
<p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
</div>`;

function emailFor(p: HookPayload): { to: string; subject: string; html: string } | null {
  const { token, token_new, email_action_type: kind } = p.email_data;
  switch (kind) {
    case "magiclink":
      return { to: p.user.email!, subject: `${token} is your Intro code`, html: page("Your Intro code", "Enter this code in Intro to sign in:", token) };
    case "signup":
      return { to: p.user.email!, subject: `${token} is your Intro code`, html: page("Welcome to Intro", "Enter this code in Intro to finish signing up:", token) };
    case "email_change":
      return { to: p.user.new_email ?? p.user.email!, subject: `${token_new || token} confirms your new email`, html: page("Confirm your new email", "Enter this code in Intro to change your email:", token_new || token) };
    case "reauthentication":
      return { to: p.user.email!, subject: `${token} is your Intro code`, html: page("Confirm it's you", "Enter this code in Intro:", token) };
    default:
      return null;   // recovery and invites aren't used by Intro
  }
}

Deno.serve(async req => {
  if (req.method !== "POST") return fail(405, "Use POST");
  const body = await req.text();
  if (!(await signatureOk(req, body))) return fail(401, "Bad signature");
  const mail = emailFor(JSON.parse(body) as HookPayload);
  if (!mail) return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const from = Deno.env.get("GRAPH_FROM_ADDRESS")!;
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await graphToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { subject: mail.subject, body: { contentType: "HTML", content: mail.html }, toRecipients: [{ emailAddress: { address: mail.to } }] },
        saveToSentItems: false,
      }),
    });
    if (!r.ok) return fail(502, `Email not sent: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : String(e));
  }
});
