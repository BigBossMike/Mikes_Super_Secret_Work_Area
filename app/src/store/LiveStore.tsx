// The live store: the same state and actions as the demo, backed by Supabase.
// Screens never know the difference. Rows become screen state through
// liveMapping.ts; every database call goes through backend/supabaseBackend.ts.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/backend/client";
import { contactLockedKind, friendlyError } from "@/backend/errors";
import { SupabaseBackend } from "@/backend/supabaseBackend";
import type { ProfileFields } from "@/backend/types";
import { useToast } from "@/components/ui";
import { ageFrom, isMinor as minorAge } from "@/lib/age";
import { blockedReason } from "@/lib/contactFilter";
import { newPhotoPath, PHOTO_URL_TTL_S } from "@/lib/photos";
import { fromBase64 } from "@/lib/sha256";
import { CITY, defaultTypeFor, OBJECTIVE_TYPES } from "@/lib/data";
import type { Person } from "@/lib/types";
import { type Actions, Ctx, type Guardian, MONTH_NAME, type State, type Store, type User } from "./context";
import { chatFromRows, guardianFromRow, matchFromRow, messageFromRow, objectiveFromRow, relToDb, requestFromRow, userFromProfile } from "./liveMapping";

const MATCH_POLL_MS = 5000;
const GUARDIAN_POLL_MS = 4000;

function empty(): State {
  const first = OBJECTIVE_TYPES.find(t => t.id === "sport")!;
  return {
    user: { name: "", dob: "", age: null, verified: false, suburb: CITY, interests: [], times: [], school: "", background: "",
      keepSchoolOut: true, paused: false, workplace: "", keepWorkplaceOut: true, hideContacts: true, discreet: false, ageMin: null, ageMax: null, photo: null, photoPath: null },
    guardian: guardianFromRow(null, ""),
    plan: "free", credits: 0, used: 0, remaining: 1,
    draft: { type: first.id, text: first.text, when: first.when, where: first.where, group: first.group }, draftEdited: false,
    objective: null, objectiveId: null, matches: [], searchPhase: "idle", chats: {}, requests: [], lastConnected: null,
    people: {}, contacts: {}, session: "loading", hasProfile: false,
  };
}

/** Everything the profile screen can change, as the database wants it. */
function profileFields(u: User): ProfileFields {
  return {
    first_name: u.name, photo_url: u.photoPath ?? null, suburb: u.suburb, interests: u.interests, free_times: u.times,
    school: u.school || null, keep_school_out: u.keepSchoolOut, workplace: u.workplace || null, keep_workplace_out: u.keepWorkplaceOut,
    match_age_min: u.ageMin, match_age_max: u.ageMax, hide_contacts: u.hideContacts, discreet_notifications: u.discreet,
    can_be_put_forward: !u.paused, date_of_birth: u.dob,
  };
}

function useLiveStore(): Store {
  const toast = useToast();
  const backend = useMemo(() => new SupabaseBackend(supabase!), []);
  const [state, setState] = useState<State>(empty);
  const ref = useRef(state);
  ref.current = state;
  const me = useRef<string | null>(null);
  const guardianLinkId = useRef<string | null>(null);
  const otherUser = useRef<Record<string, string>>({});          // match request id -> the other person's user id
  const seenMessages = useRef<Set<string>>(new Set());
  const chatSubs = useRef<Record<string, () => void>>({});

  const update = useCallback((fn: (s: State) => void) => {
    setState(prev => { const next: State = JSON.parse(JSON.stringify(prev)); fn(next); return next; });
  }, []);
  const fail = (e: unknown) => toast(friendlyError(e));

  // Photos are stored as paths; the screens need URLs. Signed URLs are cached until just before they expire.
  const photoCache = useRef<Record<string, { url: string; until: number }>>({});
  const photoUrl = (path: string | null | undefined) => (path && photoCache.current[path]?.url) || null;
  const resolvePhotos = useCallback(async (paths: string[]) => {
    const now = Date.now();
    const missing = [...new Set(paths)].filter(p => !(photoCache.current[p]?.until > now));
    if (missing.length) {
      try {
        const urls = await backend.photoUrls(missing);
        Object.entries(urls).forEach(([p, url]) => { photoCache.current[p] = { url, until: now + (PHOTO_URL_TTL_S - 300) * 1000 }; });
      } catch { /* photos are nice to have; the initial shows instead */ }
    }
    update(s => {
      s.user.photo = photoUrl(s.user.photoPath);
      Object.values(s.people ?? {}).forEach(p => { p.photo = photoUrl(p.photoPath); });
      s.requests.forEach(r => { r.photo = photoUrl(s.people?.[r.id]?.photoPath); });
    });
  }, [backend, update]);

  // ---- Loading -------------------------------------------------------------

  const guardianNameKey = () => `intro.guardianName.${me.current}`;

  const loadMatches = useCallback(async (objectiveId: string) => {
    const rows = await backend.myMatches(objectiveId);
    const mapped = rows.map(matchFromRow);
    rows.forEach(r => { if (r.candidate_id) otherUser.current[r.request_id] = r.candidate_id; });
    update(s => {
      s.matches = mapped.map(m => m.match);
      mapped.forEach(m => { if (m.person) s.people![m.person.id] = m.person; });
    });
    await resolvePhotos(mapped.map(m => m.person?.photoPath).filter((p): p is string => Boolean(p)));
  }, [backend, update, resolvePhotos]);

  const loadRequests = useCallback(async () => {
    const rows = await backend.myRequests();
    rows.forEach(r => { otherUser.current[r.request_id] = r.requester_id; });
    const mapped = rows.map(requestFromRow);
    update(s => { s.requests = mapped.map(m => m.request); mapped.forEach(m => { s.people![m.person.id] = m.person; }); });
    await resolvePhotos(mapped.map(m => m.person.photoPath).filter((p): p is string => Boolean(p)));
  }, [backend, update, resolvePhotos]);

  const loadConnections = useCallback(async () => {
    const rows = await backend.myConnections();
    update(s => {
      rows.forEach(c => { if (s.chats[c.match_request_id]) s.chats[c.match_request_id].connected = true; });
      s.lastConnected = rows[0]?.match_request_id ?? s.lastConnected;
    });
    return rows;
  }, [backend, update]);

  /** Pulls everything for the signed-in person. Resolves with whether they have a profile yet. */
  const loadAll = useCallback(async (): Promise<{ hasProfile: boolean }> => {
    const session = await backend.session();
    if (!session) { me.current = null; setState({ ...empty(), session: "out" }); return { hasProfile: false }; }
    me.current = session.user.id;
    const profile = await backend.myProfile();
    if (!profile) { update(s => { s.session = "in"; s.hasProfile = false; }); return { hasProfile: false }; }
    const [background, link, allowance, objective, guardianName] = await Promise.all([
      backend.myBackground(), backend.myGuardianLink(), backend.allowance(), backend.currentObjective(),
      AsyncStorage.getItem(`intro.guardianName.${session.user.id}`).catch(() => null),
    ]);
    guardianLinkId.current = link?.id ?? null;
    update(s => {
      s.session = "in"; s.hasProfile = true;
      s.user = { ...userFromProfile(profile, background), photo: photoUrl(profile.photo_url) };
      s.guardian = guardianFromRow(link, guardianName ?? "");
      s.plan = allowance.plan; s.used = allowance.used_this_month; s.credits = allowance.extra_credits; s.remaining = allowance.remaining;
      s.objective = objective ? objectiveFromRow(objective, MONTH_NAME) : null;
      s.objectiveId = objective?.id ?? null;
      if (!objective) s.matches = [];
      if (objective?.status === "pending_guardian") s.searchPhase = "guardian";
      else if (objective?.status === "active" || objective?.status === "done") s.searchPhase = "done";
    });
    await Promise.all([objective ? loadMatches(objective.id) : Promise.resolve(), loadRequests()]);
    await loadConnections();
    await resolvePhotos(profile.photo_url ? [profile.photo_url] : []);
    return { hasProfile: true };
  }, [backend, update, loadMatches, loadRequests, loadConnections, resolvePhotos]);

  useEffect(() => {
    loadAll().catch(fail);
    const off = backend.onAuthChange(() => { loadAll().catch(fail); });
    const sub = AppState.addEventListener("change", st => { if (st === "active" && me.current) loadAll().catch(() => {}); });
    return () => { off(); sub.remove(); Object.values(chatSubs.current).forEach(u => u()); };
  }, [backend, loadAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // New requests to be put forward arrive live.
  useEffect(() => {
    if (state.session !== "in" || !me.current) return;
    return backend.subscribeMyRequests(me.current, () => { loadRequests().catch(() => {}); });
  }, [backend, state.session, loadRequests]);

  // While people are still deciding, check for answers every few seconds (the
  // requester can't get live updates: they're not allowed to see the rows).
  useEffect(() => {
    const id = state.objectiveId;
    if (!id || state.searchPhase !== "done" || !state.matches.some(m => m.status === "asking")) return;
    const t = setInterval(() => loadMatches(id).catch(() => {}), MATCH_POLL_MS);
    return () => clearInterval(t);
  }, [state.objectiveId, state.searchPhase, state.matches, loadMatches]);

  // Waiting on a parent: for sign-off, or for an objective's OK.
  useEffect(() => {
    const waitingSignOff = state.guardian.status === "sent";
    const waitingObjective = state.searchPhase === "guardian" && state.objectiveId;
    if (!waitingSignOff && !waitingObjective) return;
    const t = setInterval(async () => {
      try {
        if (waitingSignOff) {
          const link = await backend.myGuardianLink();
          if (link?.status === "approved") { guardianLinkId.current = link.id; update(s => { s.guardian = guardianFromRow(link, s.guardian.name); }); toast(`${ref.current.guardian.name} approved your account.`); }
        }
        if (waitingObjective) {
          const o = await backend.objective(state.objectiveId!);
          if (o?.status === "active") {
            update(s => { s.searchPhase = "finding"; });
            toast(`${ref.current.guardian.name} approved your objective.`);
            await backend.findMatches(o.id);
            await loadMatches(o.id);
            update(s => { s.searchPhase = "done"; });
          } else if (o?.status === "rejected") {
            update(s => { s.searchPhase = "failed"; s.objective = null; s.objectiveId = null; });
            toast(`${ref.current.guardian.name} didn't approve this one.`);
          }
        }
      } catch { /* try again next tick */ }
    }, GUARDIAN_POLL_MS);
    return () => clearInterval(t);
  }, [backend, state.guardian.status, state.searchPhase, state.objectiveId, loadMatches, update, toast]);

  const isMinor = () => minorAge(ref.current.user.age ?? ageFrom(ref.current.user.dob) ?? 18);
  const left = () => (ref.current.remaining === null || ref.current.remaining === undefined ? Infinity : ref.current.remaining);

  const actions: Actions = {
    async verify(dob) {
      const age = ageFrom(dob);
      if (age === null) return { ok: false, error: "Enter your date of birth as YYYY-MM-DD." };
      if (age < 16) return { ok: false, error: `Intro is for people aged 16 and over. Your date of birth makes you ${age}.` };
      update(s => { s.user.dob = dob; s.user.age = age; });
      return { ok: true, age };
    },

    sendGuardianRequest(g) {
      (async () => {
        try {
          const link = await backend.inviteGuardian(relToDb(g.rel), g.phone);
          guardianLinkId.current = link.id;
          await AsyncStorage.setItem(guardianNameKey(), g.name).catch(() => {});
          update(s => { s.guardian = guardianFromRow(link, g.name); });
        } catch (e) { fail(e); }
      })();
    },

    async saveProfile(p) {
      const u: User = { ...ref.current.user, ...p };
      update(s => { Object.assign(s.user, p); });
      try {
        if (!ref.current.hasProfile) {
          await backend.createProfile(profileFields(u));
          await backend.saveBackground(u.background);
          // Pilot: the server marks the person verified from the date of birth they typed.
          // Replaced by the ID-check provider (CLAUDE.md next step 2).
          try { await backend.verifyStub(u.dob); } catch (e) { toast(`ID check not done: ${friendlyError(e)}`); }
        } else {
          await backend.updateProfile(profileFields(u));
          await backend.saveBackground(u.background);
        }
        await loadAll();
        return true;
      } catch (e) { fail(e); return false; }
    },

    async setPhoto(photo) {
      const uid = me.current;
      if (!uid) return false;
      const old = ref.current.user.photoPath ?? null;
      try {
        let path: string | null = null;
        if (photo) {
          path = newPhotoPath(uid);
          await backend.uploadPhoto(path, fromBase64(photo.base64));
          // Show the local file straight away; the signed URL replaces it on the next load.
          photoCache.current[path] = { url: photo.uri, until: Date.now() + 10 * 60 * 1000 };
        }
        // Before the profile row exists (sign-up), the path rides along when the profile is saved.
        if (ref.current.hasProfile) await backend.updateProfile({ photo_url: path });
        update(s => { s.user.photoPath = path; s.user.photo = photo?.uri ?? null; });
        if (old && old !== path) backend.removePhoto(old).catch(() => {});
        return true;
      } catch (e) { fail(e); return false; }
    },

    toggleInList(key, v) {
      update(s => { const l = s.user[key]; const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); });
    },
    setDraft(d) { update(s => { Object.assign(s.draft, d); s.draftEdited = true; }); },
    pickType(id) {
      const t = OBJECTIVE_TYPES.find(x => x.id === id)!;
      update(s => { s.draft = { type: t.id, text: t.text, when: t.when, where: t.where, group: t.group }; s.draftEdited = true; });
    },
    prepareDraft() {
      if (ref.current.draftEdited) return;
      const t = OBJECTIVE_TYPES.find(x => x.id === defaultTypeFor(ref.current.user.age ?? 18))!;
      update(s => { s.draft = { type: t.id, text: t.text, when: t.when, where: t.where, group: t.group }; });
    },
    canStart: () => left() > 0,
    objectivesLeft: left,
    isMinor,

    submitObjective() {
      const d = ref.current.draft;
      update(s => { s.draftEdited = false; s.matches = []; s.chats = {}; s.searchPhase = "finding"; });
      (async () => {
        try {
          const o = await backend.createObjective({ type: d.type, text: d.text.trim(), when_text: d.when.trim() || null, where_text: d.where.trim() || null, group_size: d.group });
          update(s => { s.objective = objectiveFromRow(o, MONTH_NAME); s.objectiveId = o.id; s.searchPhase = o.status === "pending_guardian" ? "guardian" : "finding"; });
          if (o.status === "active") {
            await backend.findMatches(o.id);
            await loadMatches(o.id);
            update(s => { s.searchPhase = "done"; });
          }
          const a = await backend.allowance();
          update(s => { s.plan = a.plan; s.used = a.used_this_month; s.credits = a.extra_credits; s.remaining = a.remaining; });
        } catch (e) {
          update(s => { s.searchPhase = "failed"; });
          fail(e);
        }
      })();
    },

    openChat(id) {
      if (ref.current.chats[id] || !me.current) return;
      const myId = me.current;
      const name = ref.current.people?.[id]?.name ?? "They";
      update(s => { s.chats[id] = chatFromRows([], myId, name, false); });
      (async () => {
        try {
          const rows = await backend.messages(id);
          rows.forEach(r => seenMessages.current.add(r.id));
          const connected = (await backend.myConnections()).some(c => c.match_request_id === id);
          update(s => { s.chats[id] = chatFromRows(rows, myId, name, connected); });
          chatSubs.current[id]?.();
          chatSubs.current[id] = backend.subscribeMessages(id, m => {
            if (seenMessages.current.has(m.id)) return;
            seenMessages.current.add(m.id);
            update(s => { s.chats[id]?.msgs.push(messageFromRow(m, myId)); });
          });
        } catch (e) { fail(e); }
      })();
    },

    sendMessage(id, text) {
      const c = ref.current.chats[id];
      const what = c?.connected ? null : blockedReason(text);
      if (what) {
        update(s => { s.chats[id].msgs.push({ from: "blocked", text: `Not sent: it looks like ${what}. Contact details unlock once you meet and tap phones.` }); });
        return "blocked";
      }
      update(s => { s.chats[id].msgs.push({ from: "me", text }); });
      (async () => {
        try {
          const row = await backend.sendMessage(id, text);
          seenMessages.current.add(row.id);
        } catch (e) {
          // The server has the final say on contact details.
          update(s => {
            const msgs = s.chats[id]?.msgs ?? [];
            const i = msgs.map(m => m.from === "me" && m.text === text).lastIndexOf(true);
            if (i >= 0) msgs.splice(i, 1);
            msgs.push({ from: "blocked", text: contactLockedKind(e) ? friendlyError(e) : `Not sent: ${friendlyError(e)}` });
          });
        }
      })();
      return "sent";
    },

    completeConnect(id, contact) {
      update(s => {
        if (s.chats[id]) { s.chats[id].connected = true; s.chats[id].msgs.push({ from: "sys", text: "You connected in person. Details unlocked." }); }
        s.lastConnected = id;
        s.contacts![id] = contact ?? null;
        if (s.objective && s.matches.some(m => m.id === id)) s.objective.done = true;
      });
      loadAll().catch(() => {});
    },

    report(id) {
      const other = id ? otherUser.current[id] : undefined;
      if (!other) { toast("Reported. The Intro safety team will review this chat."); return; }
      backend.report(other, id ?? null, "other").then(() => toast("Reported. The Intro safety team will review this chat.")).catch(fail);
    },

    answerRequest(id, yes) {
      const name = ref.current.requests.find(x => x.id === id)?.name;
      update(s => { const r = s.requests.find(x => x.id === id); if (r) r.status = yes ? "accepted" : "declined"; });
      backend.respond(id, yes).then(() => { if (yes) toast(`${name} can now message you.`); }).catch(e => { fail(e); loadRequests().catch(() => {}); });
    },

    setPaused(v) { update(s => { s.user.paused = v; }); backend.updateProfile({ can_be_put_forward: !v }).catch(fail); },
    setPrivacy(k, v) {
      update(s => { s.user[k] = v; });
      const col = { keepSchoolOut: "keep_school_out", keepWorkplaceOut: "keep_workplace_out", hideContacts: "hide_contacts", discreet: "discreet_notifications" }[k] as keyof ProfileFields;
      backend.updateProfile({ [col]: v }).catch(fail);
    },
    setAgeRange(min, max) { update(s => { s.user.ageMin = min; s.user.ageMax = max; }); backend.updateProfile({ match_age_min: min, match_age_max: max }).catch(fail); },
    setGuardianSetting(k, v) {
      const col = { approveObjectives: "approve_objectives", notifyConnect: "notify_connect", meetCheckin: "meet_checkin" }[k] as "approve_objectives" | "notify_connect" | "meet_checkin";
      const link = guardianLinkId.current;
      if (!link) return;
      backend.updateGuardianSettings(link, { [col]: v }).then(() => update(s => { s.guardian[k] = v; }))
        .catch(() => toast(`Only ${ref.current.guardian.name} can change this, from the parent app.`));
    },
    buyOne() { toast("Payments aren't set up yet. Coming with the app store release."); },
    setPlan() { toast("Payments aren't set up yet. Coming with the app store release."); },
    reset() { backend.signOut().catch(fail); },

    sendSignInCode: phone => backend.sendSignInCode(phone),
    async checkSignInCode(phone, code) { await backend.checkSignInCode(phone, code); return loadAll(); },
    refresh: () => loadAll(),
  };

  return useMemo(() => ({ state, actions }), [state]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const value = useLiveStore();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type { Guardian, Person };
