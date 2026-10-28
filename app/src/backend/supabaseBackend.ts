// Every call the app makes to Supabase, in one place. Table, column and
// function names match supabase/migrations/0001_init.sql exactly.
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { normalisePhone } from "@/lib/phoneHash";
import { PHOTO_BUCKET, PHOTO_URL_TTL_S } from "@/lib/photos";
import type {
  AllowanceRow, ConnectionRow, ContactRow, GuardianRow, MessageRow, MyMatchRow, MyRequestRow,
  ObjectiveRow, ProfileCardRow, ProfileFields, ProfileRow, ReportReason,
} from "./types";

export interface ObjectiveDraftRow { type: string; text: string; when_text: string | null; where_text: string | null; group_size: number }

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export class SupabaseBackend {
  constructor(private db: SupabaseClient) {}

  /** Calls a database function. The result is whatever the function returns (a row set or a value). */
  private async rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(name, args);
    if (error) throw error;
    return data as unknown as T;
  }

  // ---- Sign in (phone number and a code by SMS) ----------------------------

  session(): Promise<Session | null> {
    return this.db.auth.getSession().then(r => r.data.session);
  }

  async userId(): Promise<string | null> {
    return (await this.session())?.user.id ?? null;
  }

  onAuthChange(cb: (session: Session | null) => void): () => void {
    const { data } = this.db.auth.onAuthStateChange((_e, s) => cb(s));
    return () => data.subscription.unsubscribe();
  }

  async sendSignInCode(phone: string): Promise<string> {
    const e164 = normalisePhone(phone);
    if (!e164) throw new Error("Enter an Australian mobile number, e.g. 0412 345 678.");
    const { error } = await this.db.auth.signInWithOtp({ phone: e164 });
    if (error) throw error;
    return e164;
  }

  async checkSignInCode(phone: string, code: string): Promise<void> {
    const { error } = await this.db.auth.verifyOtp({ phone, token: code.trim(), type: "sms" });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    await this.db.auth.signOut();
  }

  // ---- Me ------------------------------------------------------------------

  async myProfile(): Promise<ProfileRow | null> {
    const id = await this.userId();
    if (!id) return null;
    return must(await this.db.from("profiles").select("*").eq("id", id).maybeSingle<ProfileRow>());
  }

  async createProfile(fields: ProfileFields): Promise<void> {
    const id = await this.userId();
    if (!id) throw new Error("Sign in first.");
    must(await this.db.from("profiles").insert({ id, ...fields }));
  }

  async updateProfile(fields: Partial<ProfileFields>): Promise<void> {
    const id = await this.userId();
    if (!id) throw new Error("Sign in first.");
    must(await this.db.from("profiles").update(fields).eq("id", id));
  }

  async myBackground(): Promise<string> {
    const id = await this.userId();
    if (!id) return "";
    const row = must(await this.db.from("profile_private").select("cultural_background").eq("id", id).maybeSingle<{ cultural_background: string | null }>());
    return row?.cultural_background ?? "";
  }

  async saveBackground(text: string): Promise<void> {
    const id = await this.userId();
    if (!id) return;
    must(await this.db.from("profile_private").upsert({ id, cultural_background: text || null }));
  }

  async saveContacts(c: { full_name: string; mobile: string | null; instagram: string | null }): Promise<void> {
    const id = await this.userId();
    if (!id) return;
    must(await this.db.from("private_contacts").upsert({ id, ...c }));
  }

  /** Replace my hidden-contacts fingerprints (see lib/phoneHash.ts). */
  async setHiddenContacts(hashes: string[]): Promise<void> {
    const id = await this.userId();
    if (!id) return;
    must(await this.db.from("hidden_contacts").delete().eq("owner_id", id));
    for (let i = 0; i < hashes.length; i += 500) {
      must(await this.db.from("hidden_contacts").insert(hashes.slice(i, i + 500).map(phone_hash => ({ owner_id: id, phone_hash }))));
    }
  }

  /** Pilot only: marks me verified with the date of birth I typed. See supabase/functions/verify-stub. */
  async verifyStub(dateOfBirth: string): Promise<void> {
    const { data, error } = await this.db.functions.invoke("verify-stub", { body: { date_of_birth: dateOfBirth } });
    if (error) throw error;
    if (data && typeof data === "object" && "error" in data) throw new Error(String((data as { error: unknown }).error));
  }

  // ---- Parent or guardian (16 and 17 year olds) ------------------------------

  async myGuardianLink(): Promise<GuardianRow | null> {
    const id = await this.userId();
    if (!id) return null;
    const rows = must(await this.db.from("guardians").select("*").eq("teen_id", id).neq("status", "revoked")
      .order("created_at", { ascending: false }).limit(1).returns<GuardianRow[]>());
    return rows[0] ?? null;
  }

  async inviteGuardian(relationship: GuardianRow["relationship"], phone: string): Promise<GuardianRow> {
    const id = await this.userId();
    if (!id) throw new Error("Sign in first.");
    const e164 = normalisePhone(phone);
    if (!e164) throw new Error("Enter their Australian mobile number.");
    return must(await this.db.from("guardians").insert({ teen_id: id, relationship, invite_phone: e164 }).select("*").single<GuardianRow>());
  }

  /** Parent side: change my settings for a teen. The database only lets the parent do this. */
  async updateGuardianSettings(linkId: string, s: Partial<Pick<GuardianRow, "approve_objectives" | "notify_connect" | "meet_checkin">>): Promise<void> {
    must(await this.db.from("guardians").update(s).eq("id", linkId));
  }

  async claimGuardianInvite(inviteId: string): Promise<void> {
    must(await this.db.rpc("claim_guardian_invite", { p_invite: inviteId }));
  }

  async guardianDecideObjective(objectiveId: string, approve: boolean): Promise<void> {
    must(await this.db.rpc("guardian_decide_objective", { p_objective: objectiveId, p_approve: approve }));
  }

  // ---- Objectives and matches ------------------------------------------------

  async allowance(): Promise<AllowanceRow> {
    const rows = await this.rpc<AllowanceRow[]>("objective_allowance");
    return rows[0] ?? { plan: "free", used_this_month: 0, extra_credits: 0, remaining: 1 };
  }

  /** My latest objective that's still in play (or done) this month. */
  async currentObjective(): Promise<ObjectiveRow | null> {
    const id = await this.userId();
    if (!id) return null;
    const rows = must(await this.db.from("objectives").select("*").eq("owner_id", id)
      .in("status", ["pending_guardian", "active", "done"])
      .order("created_at", { ascending: false }).limit(1).returns<ObjectiveRow[]>());
    return rows[0] ?? null;
  }

  async objective(objectiveId: string): Promise<ObjectiveRow | null> {
    return must(await this.db.from("objectives").select("*").eq("id", objectiveId).maybeSingle<ObjectiveRow>());
  }

  async createObjective(d: ObjectiveDraftRow): Promise<ObjectiveRow> {
    const id = await this.userId();
    if (!id) throw new Error("Sign in first.");
    return must(await this.db.from("objectives").insert({ owner_id: id, ...d }).select("*").single<ObjectiveRow>());
  }

  /** Asks up to 5 people. Returns how many were asked, never who. */
  async findMatches(objectiveId: string): Promise<number> {
    return this.rpc<number>("find_matches", { p_objective: objectiveId });
  }

  async myMatches(objectiveId: string): Promise<MyMatchRow[]> {
    return this.rpc<MyMatchRow[]>("my_matches", { p_objective: objectiveId });
  }

  async cancelObjective(objectiveId: string): Promise<void> {
    must(await this.db.rpc("cancel_objective", { p_objective: objectiveId }));
  }

  // ---- Being put forward -------------------------------------------------------

  async myRequests(): Promise<MyRequestRow[]> {
    return this.rpc<MyRequestRow[]>("my_requests");
  }

  async respond(requestId: string, agree: boolean): Promise<void> {
    must(await this.db.rpc("respond_to_request", { p_request: requestId, p_agree: agree }));
  }

  /** Fires when a new request lands on me, or one of mine changes. */
  subscribeMyRequests(userId: string, cb: () => void): () => void {
    const ch = this.db.channel(`requests:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_requests", filter: `candidate_id=eq.${userId}` }, () => cb())
      .subscribe();
    return () => { this.db.removeChannel(ch); };
  }

  // ---- Chat ------------------------------------------------------------------

  async messages(matchId: string): Promise<MessageRow[]> {
    return must(await this.db.from("messages").select("*").eq("match_request_id", matchId)
      .order("created_at", { ascending: true }).returns<MessageRow[]>());
  }

  /** The database refuses contact details until the two people have met (see errors.ts). */
  async sendMessage(matchId: string, body: string): Promise<MessageRow> {
    const id = await this.userId();
    if (!id) throw new Error("Sign in first.");
    return must(await this.db.from("messages").insert({ match_request_id: matchId, sender_id: id, body }).select("*").single<MessageRow>());
  }

  subscribeMessages(matchId: string, cb: (m: MessageRow) => void): () => void {
    const ch = this.db.channel(`messages:${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_request_id=eq.${matchId}` },
        payload => cb(payload.new as MessageRow))
      .subscribe();
    return () => { this.db.removeChannel(ch); };
  }

  // ---- Met in person -----------------------------------------------------------

  async myConnections(): Promise<ConnectionRow[]> {
    const id = await this.userId();
    if (!id) return [];
    return must(await this.db.from("connections").select("*").or(`user_a.eq.${id},user_b.eq.${id}`)
      .order("connected_at", { ascending: false }).returns<ConnectionRow[]>());
  }

  /** Someone's contact details. The database only returns them once we've met. */
  async contactOf(userId: string): Promise<ContactRow | null> {
    return must(await this.db.from("private_contacts").select("id, full_name, mobile, instagram").eq("id", userId).maybeSingle<ContactRow>());
  }

  async profileCard(userId: string): Promise<ProfileCardRow | null> {
    const rows = await this.rpc<ProfileCardRow[]>("profile_card", { p_user: userId });
    return rows[0] ?? null;
  }

  // ---- Photos ----------------------------------------------------------------

  /** Uploads a JPEG to my folder in the photos bucket (the path comes from lib/photos.ts newPhotoPath). */
  async uploadPhoto(path: string, bytes: Uint8Array): Promise<void> {
    const { error } = await this.db.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
  }

  async removePhoto(path: string): Promise<void> {
    const { error } = await this.db.storage.from(PHOTO_BUCKET).remove([path]);
    if (error) throw error;
  }

  /** Short-lived URLs for the photos I'm allowed to see, keyed by path. Paths I may not see are left out. */
  async photoUrls(paths: string[]): Promise<Record<string, string>> {
    if (!paths.length) return {};
    const { data, error } = await this.db.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_TTL_S);
    if (error) throw error;
    const out: Record<string, string> = {};
    for (const r of data ?? []) if (r.path && r.signedUrl && !r.error) out[r.path] = r.signedUrl;
    return out;
  }

  // ---- Safety ----------------------------------------------------------------

  async report(reportedId: string, matchId: string | null, reason: ReportReason, details?: string): Promise<void> {
    const id = await this.userId();
    if (!id) throw new Error("Sign in first.");
    must(await this.db.from("reports").insert({ reporter_id: id, reported_id: reportedId, match_request_id: matchId, reason, details: details ?? null }));
  }

  async block(userId: string): Promise<void> {
    const id = await this.userId();
    if (!id) throw new Error("Sign in first.");
    must(await this.db.from("blocks").insert({ blocker_id: id, blocked_id: userId }));
  }
}
