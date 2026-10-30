// Stripe Identity, shared by the identity function (the app) and
// identity-webhook (Stripe). Plain fetch to Stripe's API, no SDK.
//
// Secrets (supabase secrets set ...):
//   STRIPE_SECRET_KEY          sk_...  creates sessions and ephemeral keys, redacts
//   STRIPE_IDENTITY_READ_KEY   rk_...  restricted key with "Identity Verification Results"
//                                      and "Recent Detailed Verification Results" set to Read;
//                                      the only key that can read the date of birth and the
//                                      document number (for 48 hours after a check)
//   STRIPE_WEBHOOK_SECRET      whsec_  for identity-webhook
//   IDENTITY_DOC_SALT          random  keys the document fingerprint
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const STRIPE_VERSION = "2026-10-28.endive";

export const identityConfigured = () =>
  Boolean(Deno.env.get("STRIPE_SECRET_KEY") && Deno.env.get("STRIPE_IDENTITY_READ_KEY") && Deno.env.get("IDENTITY_DOC_SALT"));

type Params = Record<string, string | string[]>;
function form(params: Params): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) (Array.isArray(v) ? v : [v]).forEach(x => out.append(k, x));
  return out.toString();
}

async function stripe<T>(method: "GET" | "POST", path: string, key: string, params: Params = {}): Promise<T> {
  const body = form(params);
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? body : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Stripe ${path}: ${json?.error?.message ?? r.status}`);
  return json as T;
}

/** A new check for this person: a Stripe session (photo ID plus a live selfie) and the single-use key the phone needs. */
export async function startCheck(admin: SupabaseClient, userId: string): Promise<{ session_id: string; ephemeral_key_secret: string }> {
  const sk = Deno.env.get("STRIPE_SECRET_KEY")!;
  const session = await stripe<{ id: string }>("POST", "identity/verification_sessions", sk, {
    type: "document",
    "options[document][require_matching_selfie]": "true",
    "options[document][require_live_capture]": "true",
    "options[document][allowed_types][]": ["driving_license", "passport", "id_card"],
    client_reference_id: userId,
    "metadata[user_id]": userId,
  });
  // Record the session before anything else can fail, so every Stripe session is accounted for.
  const { error } = await admin.from("identity_checks").insert({ session_id: session.id, user_id: userId });
  if (error) throw new Error(error.message);
  const key = await stripe<{ secret: string }>("POST", "ephemeral_keys", sk, { verification_session: session.id });
  return { session_id: session.id, ephemeral_key_secret: key.secret };
}

interface Session {
  id: string;
  status: "requires_input" | "processing" | "verified" | "canceled";
  metadata?: { user_id?: string };
  client_reference_id?: string | null;
  last_error?: { code?: string; reason?: string } | null;
  verified_outputs?: { dob?: { day: number; month: number; year: number } | null } | null;
  last_verification_report?: { document?: { type?: string; issuing_country?: string; number?: string | null } | null } | null;
}

async function docHash(type: string, country: string, number: string): Promise<string> {
  const salt = new TextEncoder().encode(Deno.env.get("IDENTITY_DOC_SALT")!);
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const msg = `${type}|${country}|${number.replace(/[^0-9A-Za-z]/g, "").toUpperCase()}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
  return [...sig].map(b => b.toString(16).padStart(2, "0")).join("");
}

const ageOn = (dob: { day: number; month: number; year: number }, now = new Date()) =>
  now.getFullYear() - dob.year - ((now.getMonth() + 1 < dob.month || (now.getMonth() + 1 === dob.month && now.getDate() < dob.day)) ? 1 : 0);

export type CheckResult = "verified" | "processing" | "requires_input" | "canceled" | "duplicate" | "too_young" | "not_found";

/**
 * Reads a session's result and applies it: a verified, unique, 16+ person gets
 * verified_at and the verified date of birth; then Stripe deletes the images and
 * personal data (redaction). Safe to call more than once for the same session.
 */
export async function applyResult(admin: SupabaseClient, sessionId: string): Promise<{ status: CheckResult; reason?: string }> {
  const { data: row } = await admin.from("identity_checks").select("user_id, outcome").eq("session_id", sessionId).maybeSingle();
  if (!row) return { status: "not_found" };
  if (row.outcome === "verified" || row.outcome === "duplicate" || row.outcome === "too_young") return { status: row.outcome };

  const rk = Deno.env.get("STRIPE_IDENTITY_READ_KEY")!;
  const s = await stripe<Session>("GET", `identity/verification_sessions/${sessionId}`, rk, {
    "expand[]": ["verified_outputs.dob", "last_verification_report.document.number"],
  });
  const save = (status: string, outcome: string | null) =>
    admin.from("identity_checks").update({ status, outcome, updated_at: new Date().toISOString() }).eq("session_id", sessionId);

  if (s.status !== "verified") {
    await save(s.status, s.last_error?.code ?? null);
    return { status: s.status, reason: s.last_error?.reason };
  }

  const dob = s.verified_outputs?.dob;
  const doc = s.last_verification_report?.document;
  if (!dob || !doc?.number || !doc.type || !doc.issuing_country) {
    await save("requires_input", "missing_details");
    return { status: "requires_input", reason: "The check didn't return a date of birth and document. Try again." };
  }
  if (ageOn(dob) < 16) {
    await save("verified", "too_young");
    return { status: "too_young" };
  }

  const hash = await docHash(doc.type, doc.issuing_country, doc.number);
  const { data: used } = await admin.from("identity_documents").select("user_id").eq("doc_hash", hash).maybeSingle();
  if (used && used.user_id !== row.user_id) {
    await save("verified", "duplicate");
    return { status: "duplicate" };
  }
  await admin.from("identity_documents").upsert({ doc_hash: hash, user_id: row.user_id });

  const iso = `${dob.year}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`;
  const { data: before } = await admin.from("profiles").select("date_of_birth").eq("id", row.user_id).maybeSingle();
  const changed = before?.date_of_birth !== iso;
  const { error } = await admin.from("profiles").update({
    verified_at: new Date().toISOString(), date_of_birth: iso,
    // A different date of birth can move someone between age groups, so their chosen range starts again.
    ...(changed ? { match_age_min: null, match_age_max: null } : {}),
  }).eq("id", row.user_id);
  if (error) throw new Error(error.message);
  await save("verified", "verified");

  // Intro keeps only "verified" and the date of birth. Stripe deletes the rest (takes up to 4 days).
  try { await stripe("POST", `identity/verification_sessions/${sessionId}/redact`, Deno.env.get("STRIPE_SECRET_KEY")!); } catch { /* retried by the webhook */ }
  return { status: "verified" };
}

/** Stripe-Signature: t=<time>,v1=<sig>. HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret, within 5 minutes. */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").map(p => p.split("=")) as [string, string][];
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`)));
  const expected = [...mac].map(b => b.toString(16).padStart(2, "0")).join("");
  return sigs.some(s => s.length === expected.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}
