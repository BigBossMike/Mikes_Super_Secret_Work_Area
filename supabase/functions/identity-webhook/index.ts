// identity-webhook: Stripe tells us when an ID check finishes.
// Deployed without the sign-in check (Stripe has no Intro session); every
// request must carry a valid Stripe-Signature instead.
//   supabase functions deploy identity-webhook --no-verify-jwt --use-api
// Stripe events: identity.verification_session.verified, .requires_input,
// .processing, .canceled. Each is applied once per session (applyResult is
// safe to repeat), so Stripe's retries and out-of-order delivery don't matter.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { applyResult, identityConfigured, verifyStripeSignature } from "../_shared/identity.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !identityConfigured()) return new Response("Not set up", { status: 503 });

  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, req.headers.get("Stripe-Signature"), secret))) return new Response("Bad signature", { status: 400 });

  const event = JSON.parse(raw) as { type?: string; data?: { object?: { id?: string; object?: string } } };
  const session = event.data?.object;
  if (!event.type?.startsWith("identity.verification_session.") || session?.object !== "identity.verification_session" || !session.id) {
    return new Response("Ignored", { status: 200 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const r = await applyResult(admin, session.id);
    return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    // A 500 makes Stripe retry later.
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
});
