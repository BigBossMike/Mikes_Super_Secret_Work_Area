// The demo store: everything runs on the phone with sample people and a
// pretend other side. The live store (LiveStore.tsx) talks to Supabase.
// AppProvider picks one: live when the Supabase settings are set (see
// backend/client.ts), otherwise the demo.
import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { LIVE } from "@/backend/client";
import { useToast } from "@/components/ui";
import { ageFrom, isMinor as minorAge } from "@/lib/age";
import { blockedReason } from "@/lib/contactFilter";
import { DEMO_CONTACT_IDS, defaultTypeFor, OBJECTIVE_TYPES, SAMPLE_PEOPLE } from "@/lib/data";
import { findMatches } from "@/lib/matching";
import type { Match } from "@/lib/types";
import { type Actions, Ctx, type Guardian, MONTH_NAME, type State, type Store, type User } from "./context";
import { LiveProvider } from "./LiveStore";

export { MONTH_NAME, personById, useApp, visibleRequests } from "./context";
export type { Actions, Chat, ChatMessage, Guardian, IncomingRequest, Plan, PrivacyKey, SearchPhase, State, Store, User } from "./context";

const first = OBJECTIVE_TYPES.find(t => t.id === "sport")!;
// Demo replies from the other person, by plan type
const REPLIES: Record<string, string[]> = {
  sport: [
    "Hey! Yeah, keen. What position are you short?",
    "Easy, I can play anywhere. Want me to come down Thursday to meet the team first? Toowong Sports Centre, 6pm?",
    "Sweet, see you there. We can tap phones then.",
  ],
  dinner: [
    "Hi! Yes, I'd really like that. Any food you're keen on?",
    "Thai sounds great. There's a casual place on Given Terrace. Wednesday at 6:30?",
    "Perfect, see you there. We can tap phones then.",
  ],
  other: [
    "Hey! Yes, keen. What did you have in mind?",
    "Sounds good. Want to meet somewhere public first, like a café nearby?",
    "Great, see you there. We can tap phones then.",
  ],
};

function initial(): State {
  return {
    user: { name: "Alex", dob: "2009-03-14", age: null, verified: false, suburb: "Paddington", interests: ["Football", "Music", "Movies"],
      times: ["Saturdays", "Weeknights"], school: "", background: "", keepSchoolOut: true, paused: false,
      workplace: "", keepWorkplaceOut: true, hideContacts: true, discreet: false, ageMin: null, ageMax: null, photo: null },
    guardian: { name: "Chris", rel: "Dad", phone: "0491 570 157", status: "none", approveObjectives: true, notifyConnect: true, meetCheckin: true },
    plan: "free", credits: 0, used: 0,
    draft: { type: first.id, text: first.text, when: first.when, where: first.where, group: first.group }, draftEdited: false,
    objective: null, matches: [], searchPhase: "idle", chats: {}, lastConnected: null,
    requests: [{ id: "sam", name: "Sam", age: 17, suburb: "Paddington", hue: 15, group: 2, text: "Someone to see a movie with on a Saturday",
      why: ["Both into movies", "Same suburb", "Free Saturdays"], status: "pending" },
      { id: "dana", name: "Dana", age: 38, suburb: "Paddington", hue: 265, group: 0, text: "Someone to join me for a midweek dinner",
      why: ["Both into food", "Same suburb", "Free weeknights"], status: "pending" },
      { id: "pat", name: "Pat", age: 57, suburb: "Toowong", hue: 185, group: 0, text: "A walking buddy for early mornings along the river",
      why: ["Both into walking", "1 km away", "Free weeknights"], status: "pending" }],
    session: "in", hasProfile: true,
  };
}

function useDemoStore(): Store {
  const toast = useToast();
  const [state, setState] = useState<State>(initial);
  const ref = useRef(state);
  ref.current = state;

  // Small helper: copy the state, change the copy, save it.
  const update = useCallback((fn: (s: State) => void) => {
    setState(prev => {
      const next: State = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  }, []);

  const isMinor = () => minorAge(ref.current.user.age ?? ageFrom(ref.current.user.dob) ?? 17);
  const allowance = () => (ref.current.plan === "unlimited" ? Infinity : 1 + ref.current.credits);
  const personName = (s: State, id: string) => SAMPLE_PEOPLE.find(x => x.id === id)?.name ?? s.requests.find(x => x.id === id)?.name ?? "They";

  const actions: Actions = {
    /** Demo: a pretend ID scan. Live: see LiveStore. */
    verify(dob: string) {
      const age = ageFrom(dob);
      if (age === null) return Promise.resolve({ ok: false, error: "Enter your date of birth as YYYY-MM-DD." });
      if (age < 16) return Promise.resolve({ ok: false, error: `Intro is for people aged 16 and over. Your ID shows you're ${age}.` });
      return new Promise(res => setTimeout(() => {
        update(s => { s.user.dob = dob; s.user.age = age; s.user.verified = true; });
        res({ ok: true, age });
      }, 1400));
    },
    sendGuardianRequest(g: Pick<Guardian, "name" | "rel" | "phone">) {
      update(s => { Object.assign(s.guardian, g); s.guardian.status = "sent"; });
      setTimeout(() => update(s => { s.guardian.status = "approved"; }), 1400);
    },
    saveProfile(p: Partial<User>) { update(s => { Object.assign(s.user, p); }); return Promise.resolve(true); },
    toggleInList(key, v) {
      update(s => { const l = s.user[key]; const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); });
    },
    setDraft(d) { update(s => { Object.assign(s.draft, d); s.draftEdited = true; }); },
    pickType(id) {
      const t = OBJECTIVE_TYPES.find(x => x.id === id)!;
      update(s => { s.draft = { type: t.id, text: t.text, when: t.when, where: t.where, group: t.group }; s.draftEdited = true; });
    },
    /** Starts a new plan from an example that suits the person's age group, unless they've already edited one. */
    prepareDraft() {
      if (ref.current.draftEdited) return;
      const t = OBJECTIVE_TYPES.find(x => x.id === defaultTypeFor(ref.current.user.age ?? 17))!;
      update(s => { s.draft = { type: t.id, text: t.text, when: t.when, where: t.where, group: t.group }; });
    },
    canStart: () => ref.current.used < allowance(),
    objectivesLeft: () => allowance() - ref.current.used,
    isMinor,
    submitObjective() {
      const s0 = ref.current;
      const type = OBJECTIVE_TYPES.find(t => t.id === s0.draft.type)!;
      const needsOk = isMinor() && s0.guardian.approveObjectives;
      update(s => {
        s.used++; s.draftEdited = false;
        s.objective = { ...s.draft, month: MONTH_NAME, done: false };
        s.matches = []; s.chats = {}; s.searchPhase = needsOk ? "guardian" : "finding";
      });
      if (needsOk) setTimeout(() => { update(s => { s.searchPhase = "finding"; }); toast(`${s0.guardian.name} approved your objective.`); }, 1600);
      setTimeout(() => {
        const u = ref.current.user;
        const matches = findMatches({
          age: u.age ?? 17, suburb: u.suburb, interests: u.interests, times: u.times,
          school: u.school, keepSchoolOut: u.keepSchoolOut, workplace: u.workplace, keepWorkplaceOut: u.keepWorkplaceOut,
          ageMin: u.ageMin ?? undefined, ageMax: u.ageMax ?? undefined, hiddenIds: u.hideContacts ? DEMO_CONTACT_IDS : [],
        }, type, SAMPLE_PEOPLE);
        update(s => { s.matches = matches; s.searchPhase = "done"; });
        // Demo: people answer over the next few seconds
        const answers: Match["status"][] = ["agreed", "agreed", "asking", "passed", "agreed"];
        answers.forEach((a, i) => setTimeout(() => update(s => { if (s.matches[i]) s.matches[i].status = a; }), 900 + i * 700));
        setTimeout(() => update(s => { if (s.matches[2]?.status === "asking") s.matches[2].status = "agreed"; }), 7000);
      }, needsOk ? 3400 : 1800);
    },
    openChat(id) {
      update(s => {
        if (s.chats[id]) return;
        const name = personName(s, id);
        s.chats[id] = { replyIdx: 0, connected: false, msgs: [
          { from: "sys", text: `${name} agreed to be put forward. You can see each other's first name and photo.` },
          { from: "them", text: `Hi ${s.user.name}! Happy to be put forward. What's the plan?` },
        ] };
      });
    },
    sendMessage(id, text) {
      const c = ref.current.chats[id];
      const what = c?.connected ? null : blockedReason(text);
      if (what) {
        update(s => { s.chats[id].msgs.push({ from: "blocked", text: `Not sent: it looks like ${what}. Contact details unlock once you meet and tap phones.` }); });
        return "blocked";
      }
      update(s => { s.chats[id].msgs.push({ from: "me", text }); });
      const fromMatch = ref.current.matches.some(m => m.id === id);
      const script = REPLIES[(fromMatch && ref.current.objective?.type) || "other"] ?? REPLIES.other;
      if (c && c.replyIdx < script.length) {
        const reply = script[c.replyIdx];
        update(s => { s.chats[id].replyIdx++; });
        setTimeout(() => update(s => { s.chats[id]?.msgs.push({ from: "them", text: reply }); }), 1100);
      }
      return "sent";
    },
    completeConnect(id) {
      update(s => {
        s.chats[id].connected = true;
        s.chats[id].msgs.push({ from: "sys", text: "You connected in person. Details unlocked." });
        s.lastConnected = id;
        if (s.objective && s.matches.some(m => m.id === id)) s.objective.done = true;
      });
    },
    report() { toast("Reported. The Intro safety team will review this chat."); },
    answerRequest(id, yes) {
      update(s => { const r = s.requests.find(x => x.id === id); if (r) r.status = yes ? "accepted" : "declined"; });
      if (yes) toast(`${ref.current.requests.find(x => x.id === id)?.name} can now message you.`);
    },
    setPaused(v) { update(s => { s.user.paused = v; }); },
    async setPhoto(photo) { update(s => { s.user.photo = photo?.uri ?? null; }); return true; },
    setPrivacy(k, v) { update(s => { s.user[k] = v; }); },
    setAgeRange(min, max) { update(s => { s.user.ageMin = min; s.user.ageMax = max; }); },
    setGuardianSetting(k, v) { update(s => { s.guardian[k] = v; }); },
    buyOne() { update(s => { s.credits++; }); toast("Added 1 objective (demo, no charge)."); },
    setPlan(p) { update(s => { s.plan = p; }); toast(p === "unlimited" ? "You're on Unlimited (demo, no charge)." : "Back on the Free plan."); },
    reset() { setState(initial()); },
    sendSignInCode: phone => Promise.resolve(phone),
    checkSignInCode: () => Promise.resolve({ hasProfile: true }),
    refresh: () => Promise.resolve({ hasProfile: true }),
  };

  return useMemo(() => ({ state, actions }), [state]); // eslint-disable-line react-hooks/exhaustive-deps
}

function DemoProvider({ children }: { children: ReactNode }) {
  const value = useDemoStore();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  return LIVE ? <LiveProvider>{children}</LiveProvider> : <DemoProvider>{children}</DemoProvider>;
}
