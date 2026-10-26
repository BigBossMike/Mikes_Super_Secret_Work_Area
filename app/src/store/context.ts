// What the screens see: the app's state and the actions they can take.
// Two providers fill this in: the demo (AppStore.tsx, sample people on the
// phone) and the live one (LiveStore.tsx, Supabase). Screens never know which.
import { createContext, useContext } from "react";
import type { Contact } from "@/handshake/api";
import { ageFrom, agesCompatible } from "@/lib/age";
import { SAMPLE_PEOPLE } from "@/lib/data";
import type { Match, Objective, ObjectiveDraft, Person } from "@/lib/types";

export type Plan = "free" | "unlimited";
export type SearchPhase = "idle" | "guardian" | "finding" | "done" | "failed";

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
  workplace: string; keepWorkplaceOut: boolean;
  /** Never pair me with people in my phone contacts (and hide me from them). */
  hideContacts: boolean;
  /** Notifications say only "Intro: you have an update". */
  discreet: boolean;
  /** Adults only: ages I'm happy to be paired with. Null means the default, my age ±10. */
  ageMin: number | null; ageMax: number | null;
}
export type PrivacyKey = "keepSchoolOut" | "keepWorkplaceOut" | "hideContacts" | "discreet";

export interface State {
  user: User; guardian: Guardian; plan: Plan; credits: number; used: number;
  draft: ObjectiveDraft; draftEdited: boolean; objective: Objective | null; matches: Match[]; searchPhase: SearchPhase;
  chats: Record<string, Chat>; requests: IncomingRequest[]; lastConnected: string | null;
  /** Live app: people keyed by match request id (the demo uses sample people instead). */
  people?: Record<string, Person>;
  /** Live app: contact details unlocked by meeting in person, keyed by match request id. */
  contacts?: Record<string, Contact | null>;
  /** Live app: objectives left this month (null = unlimited). */
  remaining?: number | null;
  /** Live app: the objective's database id. */
  objectiveId?: string | null;
  /** Live app: sign-in state. The demo is always "in". */
  session: "loading" | "out" | "in";
  hasProfile: boolean;
}

export interface Actions {
  /** Checks the date of birth. Demo: also marks the person verified. Live: the ID check runs when the profile is saved. */
  verify(dob: string): Promise<{ ok: true; age: number } | { ok: false; error: string }>;
  sendGuardianRequest(g: Pick<Guardian, "name" | "rel" | "phone">): void;
  /** Saves the profile. Resolves true when saved (live: after the server accepted it). */
  saveProfile(p: Partial<User>): Promise<boolean>;
  toggleInList(key: "interests" | "times", v: string): void;
  setDraft(d: Partial<ObjectiveDraft>): void;
  pickType(id: string): void;
  prepareDraft(): void;
  canStart(): boolean;
  objectivesLeft(): number;
  isMinor(): boolean;
  submitObjective(): void;
  openChat(id: string): void;
  sendMessage(id: string, text: string): "sent" | "blocked";
  /** Called once the connect handshake confirmed both phones. */
  completeConnect(id: string, contact?: Contact | null): void;
  report(id?: string): void;
  answerRequest(id: string, yes: boolean): void;
  setPaused(v: boolean): void;
  setPrivacy(k: PrivacyKey, v: boolean): void;
  setAgeRange(min: number, max: number): void;
  setGuardianSetting(k: "approveObjectives" | "notifyConnect" | "meetCheckin", v: boolean): void;
  buyOne(): void;
  setPlan(p: Plan): void;
  /** Demo: start over. Live: sign out. */
  reset(): void;
  // Live only. The demo returns at once.
  sendSignInCode(phone: string): Promise<string>;
  checkSignInCode(phone: string, code: string): Promise<{ hasProfile: boolean }>;
  refresh(): Promise<{ hasProfile: boolean }>;
}

export interface Store { state: State; actions: Actions }

export const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export const MONTH_NAME = new Date().toLocaleString("en-AU", { month: "long" });

/** Requests follow the same rule as matches: both people inside each other's age range. */
export function visibleRequests(s: State) {
  const me = { age: s.user.age ?? ageFrom(s.user.dob) ?? 17, ageMin: s.user.ageMin ?? undefined, ageMax: s.user.ageMax ?? undefined };
  return s.requests.filter(r => agesCompatible(me, { age: r.age }));
}

/** The person behind a match, chat or request id. Live people first, then the demo's sample people. */
export function personById(s: State, id: string): Person | undefined {
  const live = s.people?.[id];
  if (live) return live;
  const p = SAMPLE_PEOPLE.find(x => x.id === id);
  if (p) return p;
  const r = s.requests.find(x => x.id === id);
  return r ? { id: r.id, name: r.name, lastName: "Taylor", age: r.age, suburb: r.suburb, interests: [], times: [], hue: r.hue } : undefined;
}
