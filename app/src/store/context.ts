// What the screens see: the app's state and the actions they can take.
// Two providers fill this in: the demo (AppStore.tsx, sample people on the
// phone) and the live one (LiveStore.tsx, Supabase). Screens never know which.
import { createContext, useContext } from "react";
import type { ContactsAccess } from "@/contacts/hideContacts";
import type { Contact } from "@/handshake/api";
import { ageFrom, agesCompatible } from "@/lib/age";
import type { PickedPhoto } from "@/lib/photos";
import { SAMPLE_PEOPLE } from "@/lib/data";
import type { Match, Objective, ObjectiveDraft, Person } from "@/lib/types";

export type Plan = "free" | "unlimited";
/** 7-day free trial, then $7.99 a month. pilot = payments not live yet, so everyone can set plans free. */
export interface Billing { pilot: boolean; subscribed: boolean; inTrial: boolean; renewsAt: string | null }
export type SearchPhase = "idle" | "guardian" | "finding" | "done" | "failed";

export interface ChatMessage { from: "me" | "them" | "sys" | "blocked"; text: string }
export interface Chat { msgs: ChatMessage[]; replyIdx: number; connected: boolean }
export interface IncomingRequest {
  id: string; name: string; age: number; suburb: string; hue: number; group: number;
  text: string; why: string[]; status: "pending" | "accepted" | "declined";
  /** A URL for the requester's photo, when there is one. */
  photo?: string | null;
}
export interface Guardian {
  name: string; rel: "Mum" | "Dad" | "Guardian"; email: string; status: "none" | "sent" | "approved";
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
  /** Shared only with people I've met in person. The mobile also keeps me from people who have it in their contacts. */
  fullName: string; mobile: string; instagram: string;
  /** A URL for my photo the app can show (demo: the local file). Null when there isn't one. */
  photo: string | null;
  /** Live: where the photo is stored (profiles.photo_url). */
  photoPath?: string | null;
}
/** Parent mode (live). */
export interface ParentInvite { id: string; teenName: string; teenAge: number; rel: Guardian["rel"] }
export interface TeenPlan { id: string; text: string; when: string; where: string; group: number }
export interface TeenActivity { title: string; detail: string; at: string | null }
export interface TeenMeetup { with: string; place: string; at: string | null }
export interface ParentTeen {
  linkId: string; id: string; name: string; age: number | null; photoPath: string | null; photo: string | null;
  verified: boolean; paused: boolean; approveObjectives: boolean; notifyConnect: boolean; meetCheckin: boolean;
  pending: TeenPlan[]; activity: TeenActivity[]; meetups: TeenMeetup[];
}
export interface ParentState { invites: ParentInvite[]; teens: ParentTeen[] }
export type ParentSettingKey = "approveObjectives" | "notifyConnect" | "meetCheckin";

export type PrivacyKey = "keepSchoolOut" | "keepWorkplaceOut" | "hideContacts" | "discreet";

export interface State {
  user: User; guardian: Guardian; plan: Plan; credits: number; used: number; billing: Billing;
  /** Hide me from my contacts: whether the phone let Intro read them (live). */
  contactsAccess?: ContactsAccess;
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
  /** Live app: invites waiting for me as a parent, and the teens I'm linked to. */
  parent?: ParentState;
}

export interface Actions {
  /** Checks the date of birth. Demo: also marks the person verified. Live: the ID check runs when the profile is saved. */
  verify(dob: string): Promise<{ ok: true; age: number } | { ok: false; error: string }>;
  sendGuardianRequest(g: Pick<Guardian, "name" | "rel" | "email">): void;
  /** Saves the profile. Resolves true when saved (live: after the server accepted it). */
  saveProfile(p: Partial<User>): Promise<boolean>;
  /** Sets or removes my profile photo. Live: uploads it and stores the path. Resolves true when done. */
  setPhoto(photo: PickedPhoto | null): Promise<boolean>;
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
  /** Live: the App Store or Google Play subscription (RevenueCat, not built yet). Demo: a pretend free trial. */
  startTrial(): void;
  /** Never paired or chatting again. The other person isn't told. */
  block(id: string): void;
  /** Meet-up check-in: tell my parent where and when. */
  shareMeetup(id: string, place: string, meetAtIso: string, label: string): Promise<boolean>;
  /** Live: deletes the account. Demo: starts again. */
  deleteAccount(): Promise<boolean>;
  /** ID check: "stripe" once the Stripe keys are on the server, otherwise "pilot" (the typed date of birth). */
  idCheckMode(): Promise<"stripe" | "pilot">;
  /** Stripe: open the sheet, then wait for the result. */
  runIdCheck(): Promise<{ status: string; reason?: string }>;
  /** Pilot: verified from the typed date of birth. */
  pilotVerify(): Promise<boolean>;
  /** Demo: start over. Live: sign out. */
  reset(): void;
  // Live only. The demo returns at once.
  /** An email address (development builds also take the test mobile numbers). */
  sendSignInCode(address: string): Promise<string>;
  checkSignInCode(address: string, code: string): Promise<SignInResult>;
  refresh(): Promise<SignInResult>;
  // Parent mode. Live only; the demo shows a note instead.
  refreshParent(): Promise<void>;
  acceptInvite(id: string): Promise<boolean>;
  declineInvite(id: string): Promise<boolean>;
  decideTeenPlan(objectiveId: string, approve: boolean): Promise<boolean>;
  setTeenSetting(linkId: string, k: ParentSettingKey, v: boolean): void;
  setTeenPaused(teenId: string, paused: boolean): void;
}

/** After sign-in: does this person have their own profile, and are they someone's parent (or invited to be)? */
export interface SignInResult { hasProfile: boolean; isParent: boolean }

export const isParentUser = (s: State) => Boolean(s.parent && (s.parent.invites.length || s.parent.teens.length));

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
