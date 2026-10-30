// Turns database rows into what the screens show. Pure functions, tested in
// backend.test.ts, so the screens never change when the database does.
import type {
  ConnectionRow, GuardianActivityRow, GuardianNotificationRow, GuardianRow, MessageRow, MyMatchRow, MyRequestRow, ObjectiveRow,
  ParentInviteRow, ProfileRow, TeenProfileRow,
} from "@/backend/types";
import { ageFrom } from "@/lib/age";
import type { Match, Objective, Person } from "@/lib/types";
import type { Chat, ChatMessage, Guardian, IncomingRequest, ParentInvite, ParentTeen, User } from "./context";

/** A steady avatar colour for a person, from their id. */
export function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function userFromProfile(p: ProfileRow, background = ""): User {
  return {
    name: p.first_name,
    dob: p.date_of_birth,
    age: ageFrom(p.date_of_birth),
    verified: p.verified_at !== null,
    suburb: p.suburb,
    interests: p.interests ?? [],
    times: p.free_times ?? [],
    school: p.school ?? "",
    background,
    keepSchoolOut: p.keep_school_out,
    paused: !p.can_be_put_forward,
    workplace: p.workplace ?? "",
    keepWorkplaceOut: p.keep_workplace_out,
    hideContacts: p.hide_contacts,
    discreet: p.discreet_notifications,
    ageMin: p.match_age_min,
    ageMax: p.match_age_max,
    fullName: "",
    mobile: "",
    instagram: "",
    photo: null,
    photoPath: p.photo_url,
  };
}

const REL: Record<GuardianRow["relationship"], Guardian["rel"]> = { mum: "Mum", dad: "Dad", parent: "Guardian", guardian: "Guardian" };
export const relToDb = (rel: Guardian["rel"]): GuardianRow["relationship"] => (rel === "Mum" ? "mum" : rel === "Dad" ? "dad" : "guardian");

export function guardianFromRow(g: GuardianRow | null, name: string): Guardian {
  if (!g) return { name: name || "your parent", rel: "Guardian", email: "", status: "none", approveObjectives: true, notifyConnect: true, meetCheckin: true };
  return {
    name: name || "your parent",
    rel: REL[g.relationship],
    email: g.invite_email ?? g.invite_phone ?? "",
    status: g.status === "approved" ? "approved" : g.status === "pending" ? "sent" : "none",
    approveObjectives: g.approve_objectives,
    notifyConnect: g.notify_connect,
    meetCheckin: g.meet_checkin,
  };
}

export function inviteFromRow(r: ParentInviteRow): ParentInvite {
  return { id: r.invite_id, teenName: r.teen_first_name, teenAge: r.teen_age, rel: REL[r.relationship] };
}

/** One teen on the parent screen, from their link, profile, waiting plans, activity and meet-up alerts. */
export function teenFromRows(link: GuardianRow, p: TeenProfileRow, pending: ObjectiveRow[], activity: GuardianActivityRow[], meetups: GuardianNotificationRow[]): ParentTeen {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    linkId: link.id, id: p.id, name: p.first_name, age: ageFrom(p.date_of_birth), photoPath: p.photo_url, photo: null,
    verified: p.verified_at !== null, paused: !p.can_be_put_forward,
    approveObjectives: link.approve_objectives, notifyConnect: link.notify_connect, meetCheckin: link.meet_checkin,
    pending: pending.filter(o => o.owner_id === p.id && o.status === "pending_guardian")
      .map(o => ({ id: o.id, text: o.text, when: o.when_text ?? "", where: o.where_text ?? "", group: o.group_size })),
    activity: activity.map(a => ({ title: a.title, detail: a.detail ?? "", at: a.happened_at })),
    meetups: meetups.filter(n => n.teen_id === p.id && n.kind === "meetup")
      .map(n => ({ with: str(n.payload.with_first_name) ?? "someone", place: str(n.payload.place) ?? "Place not given", at: str(n.payload.meet_at) })),
  };
}

export function objectiveFromRow(o: ObjectiveRow, monthName: string): Objective {
  return { type: o.type, text: o.text, when: o.when_text ?? "", where: o.where_text ?? "", group: o.group_size, month: monthName, done: o.status === "done" };
}

/** The requester's view: a match is keyed by its request id, and people stay anonymous until they agree. */
export function matchFromRow(m: MyMatchRow): { match: Match; person: Person | null } {
  const agreed = m.status === "agreed" && m.candidate_id && m.first_name;
  return {
    match: {
      id: m.request_id,
      score: m.score ?? 0,
      why: m.reasons ?? [],
      status: m.status === "agreed" ? "agreed" : m.status === "asking" ? "asking" : "passed",
    },
    person: agreed
      ? { id: m.request_id, name: m.first_name!, lastName: "", age: m.age ?? 0, suburb: m.suburb ?? "", interests: [], times: [], hue: hueFor(m.candidate_id!), photoPath: m.photo_url }
      : null,
  };
}

/** Someone else's plan that I've been asked about. Keyed by the request id. */
export function requestFromRow(r: MyRequestRow): { request: IncomingRequest; person: Person } {
  return {
    request: {
      id: r.request_id,
      name: r.first_name,
      age: r.age,
      suburb: r.suburb,
      hue: hueFor(r.requester_id),
      group: r.group_size,
      text: r.objective_text,
      why: r.reasons ?? [],
      status: r.status === "asking" ? "pending" : r.status === "agreed" ? "accepted" : "declined",
    },
    person: { id: r.request_id, name: r.first_name, lastName: "", age: r.age, suburb: r.suburb, interests: [], times: [], hue: hueFor(r.requester_id), photoPath: r.photo_url },
  };
}

export function messageFromRow(m: MessageRow, myId: string): ChatMessage {
  return { from: m.sender_id === myId ? "me" : "them", text: m.body };
}

export function chatFromRows(rows: MessageRow[], myId: string, otherName: string, connected: boolean): Chat {
  const opener: ChatMessage = { from: "sys", text: `${otherName} agreed to be put forward. You can see each other's first name and photo.` };
  const msgs = [opener, ...rows.map(m => messageFromRow(m, myId))];
  if (connected) msgs.push({ from: "sys", text: "You connected in person. Details unlocked." });
  return { msgs, replyIdx: 0, connected };
}

/** Which match requests I've met in person through, newest first. */
export const connectedRequestIds = (rows: ConnectionRow[]) => rows.map(c => c.match_request_id);

/** The other person's user id in a connection. */
export const otherUserIn = (c: ConnectionRow, myId: string) => (c.user_a === myId ? c.user_b : c.user_a);
