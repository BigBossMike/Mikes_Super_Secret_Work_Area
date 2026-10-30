// send-email: Supabase Auth's "send email" hook. Instead of Supabase's own
// sender, Auth hands us each sign-in email and we send it through Azure
// Communication Services, the same service Cavalry's sign-in (oidc) uses.
// The email carries the 6-digit code, so people type it into the app.
//
// Deployed without the sign-in check (Auth calls it, not a person); every call
// must carry a valid Standard Webhooks signature made with SEND_EMAIL_HOOK_SECRET.
//   supabase functions deploy send-email --no-verify-jwt --use-api
// Secrets: AZURE_COMMS_CONN_STR ("endpoint=https://...;accesskey=..."),
// EMAIL_SENDER (a verified MailFrom address, e.g. Support@cavalry.software)
// and SEND_EMAIL_HOOK_SECRET ("v1,whsec_...").

interface HookPayload {
  user: { email?: string; new_email?: string };
  email_data: { token: string; token_new?: string; email_action_type: string };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, message: string) => json(status, { error: { http_code: status, message } });
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hmac(key: Uint8Array, text: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
}

// ---- Standard Webhooks signature: base64(HMAC-SHA256(secret, "<id>.<timestamp>.<body>")) ----
async function signatureOk(req: Request, body: string): Promise<boolean> {
  const secret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(/^v1,/, "").replace(/^whsec_/, "");
  const id = req.headers.get("webhook-id"), ts = req.headers.get("webhook-timestamp"), sigs = req.headers.get("webhook-signature");
  if (!secret || !id || !ts || !sigs || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = b64(await hmac(unb64(secret), `${id}.${ts}.${body}`));
  return sigs.split(" ").some(s => {
    const [v, sig] = s.split(",");
    return v === "v1" && sig?.length === expected.length && [...sig].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0;
  });
}

// ---- Azure Communication Services Email, signed with the access key (HMAC-SHA256) ----
async function sendAcs(to: string, subject: string, html: string, text: string): Promise<void> {
  const conn = Object.fromEntries((Deno.env.get("AZURE_COMMS_CONN_STR") ?? "").split(";").filter(Boolean)
    .map(p => { const i = p.indexOf("="); return [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()]; }));
  const endpoint = new URL(conn.endpoint);
  const path = "/emails:send?api-version=2023-03-31";
  const sender = (Deno.env.get("EMAIL_SENDER") ?? "").replace(/^['"]|['"]$/g, "");
  const body = JSON.stringify({
    senderAddress: sender,
    recipients: { to: [{ address: to }] },
    content: { subject, html, plainText: text },
    userEngagementTrackingDisabled: true,
  });
  const date = new Date().toUTCString();
  const contentHash = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))));
  const signature = b64(await hmac(unb64(conn.accesskey), `POST\n${path}\n${date};${endpoint.host};${contentHash}`));
  const r = await fetch(`${endpoint.origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "x-ms-date": date, "x-ms-content-sha256": contentHash,
      Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    },
    body,
  });
  if (r.status !== 202) throw new Error(`Azure email: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

const page = (heading: string, line: string, code: string) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#15213B;max-width:480px">
<p style="font-size:22px;font-weight:bold;margin:0 0 16px">intro<span style="color:#12A150">.</span></p>
<h2 style="margin:0 0 8px">${heading}</h2>
<p>${line}</p>
<p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</p>
<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
</div>`;

function emailFor(p: HookPayload): { to: string; subject: string; html: string; text: string } | null {
  const { token, token_new, email_action_type: kind } = p.email_data;
  const make = (to: string, code: string, subject: string, heading: string, line: string) =>
    ({ to, subject, html: page(heading, line, code), text: `${heading}\n\n${line} ${code}\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.` });
  switch (kind) {
    case "magiclink": return make(p.user.email!, token, `${token} is your Intro code`, "Your Intro code", "Enter this code in Intro to sign in:");
    case "signup": return make(p.user.email!, token, `${token} is your Intro code`, "Welcome to Intro", "Enter this code in Intro to finish signing up:");
    case "email_change": return make(p.user.new_email ?? p.user.email!, token_new || token, `${token_new || token} confirms your new email`, "Confirm your new email", "Enter this code in Intro to change your email:");
    case "reauthentication": return make(p.user.email!, token, `${token} is your Intro code`, "Confirm it's you", "Enter this code in Intro:");
    default: return null;   // recovery and invites aren't used by Intro
  }
}

Deno.serve(async req => {
  if (req.method !== "POST") return fail(405, "Use POST");
  const body = await req.text();
  if (!(await signatureOk(req, body))) return fail(401, "Bad signature");
  const mail = emailFor(JSON.parse(body) as HookPayload);
  if (!mail) return json(200, {});
  try {
    await sendAcs(mail.to, mail.subject, mail.html, mail.text);
    return json(200, {});
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : String(e));
  }
});
