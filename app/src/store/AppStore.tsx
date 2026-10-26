// App state for the demo build.
// Everything here runs on the phone with sample people. Each action is the
// place where a Supabase call goes in the live app (see supabase/README.md).
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import { ageFrom, isMinor as minorAge } from "@/lib/age";
import { blockedReason } from "@/lib/contactFilter";
import { OBJECTIVE_TYPES, SAMPLE_PEOPLE } from "@/lib/data";
import { findMatches } from "@/lib/matching";
import type { Match, Objective, ObjectiveDraft } from "@/lib/types";

export type Plan = "free" | "unlimited";
export type SearchPhase = "idle" | "guardian" | "finding" | "done";

export interface ChatMessage { from: "me" | "them" | "sys" | "blocked"; text: string }
export interface Chat { msgs: ChatMessage[]; replyIdx: number; connected: boolean }
export interface IncomingRequest {
  id: string; name: string; age: number; suburb: string; hue: number; group: number;
  text: string; why: string[]; status: "pending" | "accepted" | "declined";
}
export interface Guardian {
  name: string; rel: "Mum" | "Dad" | "Guardian"; phone: string; status: "none" | "sent" | "approved";
  approveObjectives: boolean; notifyConnect: boolean; meetCheckin: boolean;
}
export interface User {
  name: string; dob: string; age: number | null; verified: boolean; suburb: string;
  interests: string[]; times: string[]; school: string; background: string;
  keepSchoolOut: boolean; paused: boolean;
}
export interface State {
  user: User; guardian: Guardian; plan: Plan; credits: number; used: number;
  draft: ObjectiveDraft; objective: Objective | null; matches: Match[]; searchPhase: SearchPhase;
  chats: Record<string, Chat>; requests: IncomingRequest[]; lastConnected: string | null;
}

const MONTH = new Date().toLocaleString("en-AU", { month: "long" });
const first = OBJECTIVE_TYPES[0];
const REPLIES = [
  "Hey! Yeah, keen. What position are you short?",
  "Easy, I can play anywhere. Want me to come down Thursday to meet the team first? Toowong Sports Centre, 6pm?",
  "Sweet, see you there. We can tap phones then.",
];

function initial(): State {
  return {
    user: { name: "Alex", dob: "2009-03-14", age: null, verified: false, suburb: "Paddington", interests: ["Football", "Music", "Movies"],
      times: ["Saturdays", "Weeknights"], school: "", background: "", keepSchoolOut: true, paused: false },
    guardian: { name: "Chris", rel: "Dad", phone: "0491 570 157", status: "none", approveObjectives: true, notifyConnect: true, meetCheckin: true },
    plan: "free", credits: 0, used: 0,
    draft: { type: first.id, text: first.text, when: first.when, where: first.where, group: first.group },
    objective: null, matches: [], searchPhase: "idle", chats: {}, lastConnected: null,
    requests: [{ id: "sam", name: "Sam", age: 17, suburb: "Paddington", hue: 15, group: 2, text: "Someone to see a movie with on a Saturday",
      why: ["Both into movies", "Same suburb", "Free Saturdays"], status: "pending" }],
  };
}

export const MONTH_NAME = MONTH;

export function personById(s: State, id: string) {
  const p = SAMPLE_PEOPLE.find(x => x.id === id);
  if (p) return p;
  const r = s.requests.find(x => x.id === id);
  return r ? { id: r.id, name: r.name, lastName: "Taylor", age: r.age, suburb: r.suburb, interests: [], times: [], hue: r.hue } : undefined;
}

function useStoreValue() {
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

  const actions = {
    /** Live app: hand off to the ID verification provider, then read back the verified age. */
    verify(dob: string): Promise<{ ok: true; age: number } | { ok: false; error: string }> {
      const age = ageFrom(dob);
      if (age === null) return Promise.resolve({ ok: false, error: "Enter your date of birth as YYYY-MM-DD." });
      if (age < 16) return Promise.resolve({ ok: false, error: `Intro is for people aged 16 and over. Your ID shows you're ${age}.` });
      return new Promise(res => setTimeout(() => {
        update(s => { s.user.dob = dob; s.user.age = age; s.user.verified = true; });
        res({ ok: true, age });
      }, 1400));
    },
    /** Live app: text the parent a link to the parent app. */
    sendGuardianRequest(g: Pick<Guardian, "name" | "rel" | "phone">) {
      update(s => { Object.assign(s.guardian, g); s.guardian.status = "sent"; });
      setTimeout(() => update(s => { s.guardian.status = "approved"; }), 1400);
    },
    saveProfile(p: Partial<User>) { update(s => { Object.assign(s.user, p); }); },
    toggleInList(key: "interests" | "times", v: string) {
      update(s => { const l = s.user[key]; const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); });
    },
    setDraft(d: Partial<ObjectiveDraft>) { update(s => { Object.assign(s.draft, d); }); },
    pickType(id: string) {
      const t = OBJECTIVE_TYPES.find(x => x.id === id)!;
      update(s => { s.draft = { type: t.id, text: t.text, when: t.when, where: t.where, group: t.group }; });
    },
    canStart: () => ref.current.used < allowance(),
    objectivesLeft: () => allowance() - ref.current.used,
    isMinor,
    /** Live app: insert the objective; the server runs find_matches and sends the requests. */
    submitObjective() {
      const s0 = ref.current;
      const type = OBJECTIVE_TYPES.find(t => t.id === s0.draft.type)!;
      const needsOk = isMinor() && s0.guardian.approveObjectives;
      update(s => {
        s.used++;
        s.objective = { ...s.draft, month: MONTH, done: false };
        s.matches = []; s.chats = {}; s.searchPhase = needsOk ? "guardian" : "finding";
      });
      if (needsOk) setTimeout(() => { update(s => { s.searchPhase = "finding"; }); toast(`${s0.guardian.name} approved your objective.`); }, 1600);
      setTimeout(() => {
        const u = ref.current.user;
        const matches = findMatches({ age: u.age ?? 17, suburb: u.suburb, interests: u.interests, times: u.times, school: u.school, keepSchoolOut: u.keepSchoolOut }, type, SAMPLE_PEOPLE);
        update(s => { s.matches = matches; s.searchPhase = "done"; });
        // Demo: people answer over the next few seconds
        const answers: Match["status"][] = ["agreed", "agreed", "asking", "passed", "agreed"];
        answers.forEach((a, i) => setTimeout(() => update(s => { if (s.matches[i]) s.matches[i].status = a; }), 900 + i * 700));
        setTimeout(() => update(s => { if (s.matches[2]?.status === "asking") s.matches[2].status = "agreed"; }), 7000);
      }, needsOk ? 3400 : 1800);
    },
    openChat(id: string) {
      update(s => {
        if (s.chats[id]) return;
        const p = personById(s, id)!;
        s.chats[id] = { replyIdx: 0, connected: false, msgs: [
          { from: "sys", text: `${p.name} agreed to be put forward. You can see each other's first name and photo.` },
          { from: "them", text: `Hi ${s.user.name}! Happy to be put forward. What's the plan?` },
        ] };
      });
    },
    /** Live app: insert into messages; the server rejects contact details too. */
    sendMessage(id: string, text: string): "sent" | "blocked" {
      const c = ref.current.chats[id];
      const what = c?.connected ? null : blockedReason(text);
      if (what) {
        update(s => { s.chats[id].msgs.push({ from: "blocked", text: `Not sent: it looks like ${what}. Contact details unlock once you meet and tap phones.` }); });
        return "blocked";
      }
      update(s => { s.chats[id].msgs.push({ from: "me", text }); });
      if (c && c.replyIdx < REPLIES.length) {
        const reply = REPLIES[c.replyIdx];
        update(s => { s.chats[id].replyIdx++; });
        setTimeout(() => update(s => { s.chats[id]?.msgs.push({ from: "them", text: reply }); }), 1100);
      }
      return "sent";
    },
    /** Live app: called once the connect-handshake function confirms both phones. */
    completeConnect(id: string) {
      update(s => {
        s.chats[id].connected = true;
        s.chats[id].msgs.push({ from: "sys", text: "You connected in person. Details unlocked." });
        s.lastConnected = id;
        if (s.objective && s.matches.some(m => m.id === id)) s.objective.done = true;
      });
    },
    report() { toast("Reported. The Intro safety team will review this chat."); },
    answerRequest(id: string, yes: boolean) {
      update(s => { const r = s.requests.find(x => x.id === id); if (r) r.status = yes ? "accepted" : "declined"; });
      if (yes) toast(`${ref.current.requests.find(x => x.id === id)?.name} can now message you.`);
    },
    setPaused(v: boolean) { update(s => { s.user.paused = v; }); },
    setKeepSchoolOut(v: boolean) { update(s => { s.user.keepSchoolOut = v; }); },
    setGuardianSetting(k: "approveObjectives" | "notifyConnect" | "meetCheckin", v: boolean) { update(s => { s.guardian[k] = v; }); },
    buyOne() { update(s => { s.credits++; }); toast("Added 1 objective (demo, no charge)."); },
    setPlan(p: Plan) { update(s => { s.plan = p; }); toast(p === "unlimited" ? "You're on Unlimited (demo, no charge)." : "Back on the Free plan."); },
    reset() { setState(initial()); },
  };

  return useMemo(() => ({ state, actions }), [state]); // eslint-disable-line react-hooks/exhaustive-deps
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}
