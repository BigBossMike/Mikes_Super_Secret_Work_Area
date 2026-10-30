// Live check of email sign-in and parent invites by email.
// Codes are made with the admin API (nothing is emailed), so this runs before
// Resend is set up. Tess (+61491570107, 17) invites a parent by email; the
// parent signs in with that email's code, sees the invite and approves it.
// A stranger with another email sees nothing. Cleans up after itself.
//   node scripts/live-email.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };
const sql = async q => (await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) })).json();

const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${MGMT}` } })).json();
const admin = createClient(URL_, keys.find(k => k.name === "service_role")?.api_key, { auth: { persistSession: false } });
const PARENT = "parent.intro.test@example.com", STRANGER = "stranger.intro.test@example.com";

async function emailSignIn(email) {
  const made = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (made.error && !/already|registered|exists/i.test(made.error.message)) throw made.error;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const db = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await db.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: "email" });
  if (error) throw error;
  return { db, id: data.user.id, email: data.user.email };
}

(async () => {
  const T = createClient(URL_, ANON, { auth: { persistSession: false } });
  await T.auth.signInWithOtp({ phone: "+61491570107" });
  const t = (await T.auth.verifyOtp({ phone: "+61491570107", token: "123456", type: "sms" })).data.user;
  await sql(`delete from public.guardians where teen_id = '${t.id}' and invite_email is not null`);

  const P = await emailSignIn(PARENT);
  ok("parent signs in with an emailed code", P.email === PARENT, P.email);
  const S = await emailSignIn(STRANGER);

  const bad = await T.from("guardians").insert({ teen_id: t.id, relationship: "mum", invite_email: "not-an-email" });
  ok("an invite to a malformed email is refused", Boolean(bad.error), bad.error?.message);
  const inv = await T.from("guardians").insert({ teen_id: t.id, relationship: "mum", invite_email: PARENT }).select("id").single();
  ok("Tess invites her parent by email", !inv.error, inv.error?.message);

  const sees = (await S.db.rpc("my_parent_invites")).data ?? [];
  ok("a stranger doesn't see it", !sees.some(i => i.invite_id === inv.data?.id));
  const steal = await S.db.rpc("claim_guardian_invite", { p_invite: inv.data?.id });
  ok("or claim it", Boolean(steal.error), steal.error?.message);
  const mine = (await P.db.rpc("my_parent_invites")).data ?? [];
  ok("the parent sees Tess's invite", mine.some(i => i.invite_id === inv.data?.id && i.teen_first_name === "Tess"), JSON.stringify(mine.map(i => i.teen_first_name)));
  const claim = await P.db.rpc("claim_guardian_invite", { p_invite: inv.data?.id });
  ok("the parent approves it", !claim.error, claim.error?.message);
  const [row] = await sql(`select status, guardian_id = '${P.id}' as linked from public.guardians where id = '${inv.data?.id}'`);
  ok("linked as Tess's parent", row?.status === "approved" && row?.linked === true, JSON.stringify(row));

  await sql(`delete from public.guardians where id = '${inv.data?.id}'`);
  await admin.auth.admin.deleteUser(P.id);
  await admin.auth.admin.deleteUser(S.id);
  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
