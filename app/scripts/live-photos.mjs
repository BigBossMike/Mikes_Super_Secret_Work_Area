// Live check of the profile photo rules against the real Supabase project.
// Uses the smoke-test people: A (+61491570101) and B (+61491570102) have met,
// C (+61491570103) has no link to either. Run after live-smoke.mjs:
//   node scripts/live-photos.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let failures = 0;
const ok = (label, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); if (!cond) failures++; };

async function signIn(phone, code = "123456") {
  const db = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.auth.signInWithOtp({ phone });
  const { data, error } = await db.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw new Error(`Sign-in failed for ${phone}: ${error.message}`);
  return { db, id: data.user.id };
}

// The smallest valid JPEG (1x1, grey).
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const rand = () => Math.random().toString(36).slice(2, 10);

(async () => {
  console.log("Project:", URL_);
  const A = await signIn("+61491570101"), B = await signIn("+61491570102"), C = await signIn("+61491570103");

  // A uploads a photo into their own folder and points their profile at it.
  const pathA = `${A.id}/${rand()}.jpg`;
  const up = await A.db.storage.from("photos").upload(pathA, JPEG, { contentType: "image/jpeg" });
  ok("A: uploads into own folder", !up.error, up.error?.message);
  const setOwn = await A.db.from("profiles").update({ photo_url: pathA }).eq("id", A.id);
  ok("A: profile points at own photo", !setOwn.error, setOwn.error?.message);

  // Wrong folders are refused, both in Storage and on the profile.
  const wrongUp = await A.db.storage.from("photos").upload(`${B.id}/${rand()}.jpg`, JPEG, { contentType: "image/jpeg" });
  ok("A: can't upload into B's folder", Boolean(wrongUp.error), wrongUp.error?.message);
  const wrongSet = await A.db.from("profiles").update({ photo_url: `${B.id}/abc.jpg` }).eq("id", A.id);
  ok("A: profile can't point at B's folder", Boolean(wrongSet.error?.message.includes("photo_path_invalid")), wrongSet.error?.message);

  // Who can see it: A (own), B (met A), not C (no link).
  const selfUrl = await A.db.storage.from("photos").createSignedUrls([pathA], 60);
  ok("A: can sign own photo", !selfUrl.error && selfUrl.data?.[0]?.signedUrl && !selfUrl.data[0].error, selfUrl.error?.message ?? selfUrl.data?.[0]?.error);
  const bUrl = await B.db.storage.from("photos").createSignedUrls([pathA], 60);
  ok("B (met A): can sign A's photo", !bUrl.error && bUrl.data?.[0]?.signedUrl && !bUrl.data[0].error, bUrl.error?.message ?? bUrl.data?.[0]?.error);
  if (bUrl.data?.[0]?.signedUrl) {
    const r = await fetch(bUrl.data[0].signedUrl);
    ok("B: the signed URL serves the image", r.ok && (r.headers.get("content-type") ?? "").startsWith("image/"), `${r.status} ${r.headers.get("content-type")}`);
  }
  const cUrl = await C.db.storage.from("photos").createSignedUrls([pathA], 60);
  ok("C (no link): can't sign A's photo", Boolean(cUrl.error) || Boolean(cUrl.data?.[0]?.error) || !cUrl.data?.[0]?.signedUrl, cUrl.error?.message ?? cUrl.data?.[0]?.error ?? "");
  const cDel = await C.db.storage.from("photos").remove([pathA]);
  const stillThere = await A.db.storage.from("photos").createSignedUrls([pathA], 60);
  ok("C: can't delete A's photo", Boolean(stillThere.data?.[0]?.signedUrl), cDel.error?.message ?? "");

  // The cards carry the path, for B via profile_card and my_matches.
  const card = await B.db.rpc("profile_card", { p_user: A.id });
  ok("B: A's card carries the photo path", card.data?.[0]?.photo_url === pathA, JSON.stringify(card.data?.[0]));

  // A replaces, then removes, the photo.
  const pathA2 = `${A.id}/${rand()}.jpg`;
  await A.db.storage.from("photos").upload(pathA2, JPEG, { contentType: "image/jpeg" });
  await A.db.from("profiles").update({ photo_url: pathA2 }).eq("id", A.id);
  const del = await A.db.storage.from("photos").remove([pathA]);
  ok("A: removes the old photo", !del.error && del.data?.length === 1, del.error?.message ?? JSON.stringify(del.data));
  const clear = await A.db.from("profiles").update({ photo_url: null }).eq("id", A.id);
  await A.db.storage.from("photos").remove([pathA2]);
  ok("A: clears the photo", !clear.error, clear.error?.message);

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
