// Turns database and network errors into plain sentences for the screen.
// The database raises named errors for the rules it enforces (see the
// triggers in supabase/migrations/0001_init.sql).
import { PLAN_ISSUE_MESSAGE, type PlanIssue } from "@/lib/planScreen";

export interface DbError { message?: string; details?: string | null; hint?: string | null; code?: string | null }

const asDb = (e: unknown): DbError => (e && typeof e === "object" ? (e as DbError) : e == null ? {} : { message: String(e) });

/** The kind of contact detail the server refused ("a phone number"), or null if that isn't what went wrong. */
export function contactLockedKind(e: unknown): string | null {
  const d = asDb(e);
  return d.message?.includes("contact_details_locked") ? d.details || "contact details" : null;
}

export const isLimitReached = (e: unknown) => Boolean(asDb(e).message?.includes("objective_limit_reached"));

/** Why the server refused a plan ("dating", "mocking"...), or null if that isn't what went wrong. */
export function planRefusedKind(e: unknown): string | null {
  const d = asDb(e);
  return d.message?.includes("objective_not_allowed") ? d.details || "other" : null;
}

export function friendlyError(e: unknown): string {
  const d = asDb(e);
  const kind = contactLockedKind(e);
  if (kind) return `Not sent: it looks like ${kind}. ${d.hint ?? "Contact details unlock once you meet and tap phones."}`;
  if (isLimitReached(e)) return d.hint ?? "You've used this month's free objective. Buy one more, or go unlimited.";
  const refused = planRefusedKind(e);
  if (refused) return d.hint ?? PLAN_ISSUE_MESSAGE[refused as PlanIssue] ?? "This plan can't go out as written. Change the wording and try again.";
  const m = d.message ?? "";
  if (/network|fetch|failed to connect|timeout/i.test(m)) return "No connection. Check your internet and try again.";
  if (/jwt|not authenticated|sign in|session/i.test(m)) return "Sign in to Intro again.";
  if (d.code === "P0001" || d.code === "P0002" || d.code === "42501") return m;   // the database's own plain-English messages
  return m || "Something went wrong. Try again.";
}
