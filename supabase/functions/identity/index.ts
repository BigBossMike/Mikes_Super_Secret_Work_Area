// identity: the app's side of the ID check (Stripe Identity).
//   { action: "config" }  -> { configured }       Stripe keys set on the server?
//   { action: "start" }   -> { session_id, ephemeral_key_secret } for the phone's Stripe sheet,
//                            or { status: "verified" } if this person is already verified
//   { action: "check" }   -> { status, reason? }   the latest check's result, applied to the profile
// identity-webhook applies the same results when Stripe sends them.
// Until the Stripe keys are set, the app falls back to verify-stub (the pilot).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { applyResult, identityConfigured, startCheck } from "../_shared/identity.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Please sign in" }, 401);

  let body: { action?: string };
  try { body = await req.json(); } catch { return json({ error: "Send JSON" }, 400); }

  if (body.action === "config") return json({ configured: identityConfigured() });
  if (!identityConfigured()) return json({ error: "ID checks aren't set up on this server yet." }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (body.action === "start") {
      const { data: p } = await admin.from("profiles").select("verified_at").eq("id", user.id).maybeSingle();
      if (!p) return json({ error: "Save your profile first" }, 409);
      if (p.verified_at) return json({ status: "verified" });
      return json(await startCheck(admin, user.id));
    }
    if (body.action === "check") {
      const { data: last } = await admin.from("identity_checks").select("session_id")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!last) return json({ status: "not_found" });
      return json(await applyResult(admin, last.session_id));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
