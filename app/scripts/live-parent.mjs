// Live check of parent mode against the real Supabase project.
// T is a 17-year-old (+61491570107), P is their parent (+61491570108, no
// profile of their own), C is a stranger (+61491570103). The test clears T's
// parent links and plans first, so it can be run again.
//   node scripts/live-parent.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY, MGMT = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(URL_).hostname.split(".")[0];
let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };
const must = r => { if (r.error) throw new Error(r.error.message + (r.error.details ? " | " + r.error.details : "")); return r.data; };

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`SQL failed: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function signIn(phone, code = "123456") {
  const db = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.auth.signInWithOtp({ phone });
  const { data, error } = await db.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw new Error(`Sign-in failed for ${phone}: ${error.message}`);
  return { db, id: data.user.id };
}

const dob = years => { const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setMonth(0, 15); return d.toISOString().slice(0, 10); };

(async () => {
  console.log("Project:", URL_);
  const T = await signIn("+61491570107"), P = await signIn("+61491570108"), C = await signIn("+61491570103");
  await sql(`delete from public.objectives where owner_id = '${T.id}'; delete from public.guardians where teen_id = '${T.id}';`);

  // The teen signs up.
  const existing = must(await T.db.from("profiles").select("id").eq("id", T.id).maybeSingle());
  const fields = { first_name: "Tess", city: undefined, interests: ["Football", "Music"], free_times: ["Saturdays"], date_of_birth: dob(17), school: null };
  delete fields.city;
  if (!existing) must(await T.db.from("profiles").insert({ id: T.id, ...fields }));
  const v = await T.db.functions.invoke("verify-stub", { body: { date_of_birth: fields.date_of_birth } });
  ok("T (17): profile and verified", !v.error && v.data?.status === "verified", v.error?.message);

  // T invites P. A stranger can't see or touch the invite.
  const invite1 = must(await T.db.from("guardians").insert({ teen_id: T.id, relationship: "mum", invite_phone: "+61491570108" }).select("id").single());
  const cInvites = must(await C.db.rpc("my_parent_invites"));
  ok("C: doesn't see an invite sent to someone else", !cInvites.some(i => i.invite_id === invite1.id));
  const cDecline = await C.db.rpc("decline_parent_invite", { p_invite: invite1.id });
  ok("C: can't decline it", Boolean(cDecline.error), cDecline.error?.message);
  const cClaim = await C.db.rpc("claim_guardian_invite", { p_invite: invite1.id });
  ok("C: can't claim it", Boolean(cClaim.error), cClaim.error?.message);

  // P sees it and declines.
  let pInvites = must(await P.db.rpc("my_parent_invites"));
  const seen = pInvites.find(i => i.invite_id === invite1.id);
  ok("P: sees Tess's invite with her age and 'mum'", seen?.teen_first_name === "Tess" && seen?.teen_age === 17 && seen?.relationship === "mum", JSON.stringify(seen));
  must(await P.db.rpc("decline_parent_invite", { p_invite: invite1.id }));
  const after = must(await T.db.from("guardians").select("status").eq("id", invite1.id).single());
  ok("P: declines; the invite is closed", after.status === "revoked", after.status);
  pInvites = must(await P.db.rpc("my_parent_invites"));
  ok("P: nothing waiting now", !pInvites.length);

  // T sends again; P approves.
  const invite2 = must(await T.db.from("guardians").insert({ teen_id: T.id, relationship: "mum", invite_phone: "0491 570 108" }).select("id").single());
  must(await P.db.rpc("claim_guardian_invite", { p_invite: invite2.id }));
  const links = must(await P.db.from("guardians").select("*").eq("guardian_id", P.id).eq("status", "approved"));
  ok("P: approves; linked to Tess", links.some(l => l.teen_id === T.id));
  const teenCard = must(await P.db.from("profiles").select("first_name, date_of_birth, can_be_put_forward").eq("id", T.id).maybeSingle());
  ok("P: can read Tess's profile", teenCard?.first_name === "Tess", JSON.stringify(teenCard));
  const cCard = must(await C.db.from("profiles").select("id").eq("id", T.id).maybeSingle());
  ok("C: can't", cCard === null);

  // T sets a plan; it waits for P.
  const plan = must(await T.db.from("objectives").insert({ owner_id: T.id, type: "sport", text: "A fifth player for Saturday football", when_text: "Saturdays", where_text: "Brisbane", group_size: 4 }).select("id, status").single());
  ok("T: plan waits for the parent", plan.status === "pending_guardian", plan.status);
  const pending = must(await P.db.from("objectives").select("id, text").eq("owner_id", T.id).eq("status", "pending_guardian"));
  ok("P: sees the plan waiting", pending.some(o => o.id === plan.id));
  const cPending = must(await C.db.from("objectives").select("id").eq("id", plan.id));
  ok("C: doesn't", cPending.length === 0);
  const decided = await P.db.rpc("guardian_decide_objective", { p_objective: plan.id, p_approve: true });
  ok("P: approves the plan", decided.data === "active", decided.error?.message ?? decided.data);
  const now = must(await T.db.from("objectives").select("status").eq("id", plan.id).single());
  ok("T: plan is active", now.status === "active", now.status);

  // Pause and controls.
  must(await P.db.rpc("guardian_set_paused", { p_teen: T.id, p_paused: true }));
  let tp = must(await T.db.from("profiles").select("can_be_put_forward").eq("id", T.id).single());
  ok("P: pauses Tess", tp.can_be_put_forward === false);
  const cPause = await C.db.rpc("guardian_set_paused", { p_teen: T.id, p_paused: false });
  ok("C: can't unpause her", Boolean(cPause.error), cPause.error?.message);
  must(await P.db.rpc("guardian_set_paused", { p_teen: T.id, p_paused: false }));
  tp = must(await T.db.from("profiles").select("can_be_put_forward").eq("id", T.id).single());
  ok("P: turns her back on", tp.can_be_put_forward === true);
  const link = links.find(l => l.teen_id === T.id);
  must(await P.db.from("guardians").update({ meet_checkin: false }).eq("id", link.id));
  const tSet = await T.db.from("guardians").update({ meet_checkin: true }).eq("id", link.id).select("id");
  const setting = must(await P.db.from("guardians").select("meet_checkin").eq("id", link.id).single());
  ok("P: changes a control; T can't change it back", setting.meet_checkin === false && (tSet.error || (tSet.data ?? []).length === 0), tSet.error?.message ?? "");
  must(await P.db.from("guardians").update({ meet_checkin: true }).eq("id", link.id));

  const activity = must(await P.db.rpc("guardian_activity", { p_teen: T.id }));
  ok("P: sees Tess's activity", activity.some(a => a.kind === "objective"), activity.map(a => a.title).join(", "));
  const cActivity = must(await C.db.rpc("guardian_activity", { p_teen: T.id }));
  ok("C: sees none of it", cActivity.length === 0);

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
