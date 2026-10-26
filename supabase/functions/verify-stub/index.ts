// verify-stub: PILOT ONLY. Marks the signed-in person as ID-verified using
// the date of birth they typed, with no real ID check.
//
// The real app replaces this with an ID-check provider (bank check via
// ConnectID, or photo ID plus a liveness selfie) whose webhook sets
// profiles.verified_at and date_of_birth with the service role.
//
// It only works when the secret STUB_VERIFY_ENABLED is "true":
//   supabase secrets set STUB_VERIFY_ENABLED=true
// Unset it (or set it to anything else) before the public launch.
//
// Deploy with:  supabase functions deploy verify-stub

import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (Deno.env.get("STUB_VERIFY_ENABLED") !== "true") return json({ error: "ID checks aren't set up on this server yet." }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Please sign in" }, 401);

  let body: { date_of_birth?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Send JSON" }, 400); }
  const dob = String(body.date_of_birth ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) return json({ error: "Date of birth must be YYYY-MM-DD" }, 400);

  const years = (Date.now() - Date.parse(dob)) / (365.25 * 24 * 3600 * 1000);
  if (years < 16) return json({ error: "Intro is for people aged 16 and over" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.from("profiles")
    .update({ verified_at: new Date().toISOString(), date_of_birth: dob })
    .eq("id", user.id).select("id").maybeSingle();
  if (error) return json({ error: error.message }, 400);
  if (!data) return json({ error: "Save your profile first" }, 409);
  return json({ status: "verified" });
});
