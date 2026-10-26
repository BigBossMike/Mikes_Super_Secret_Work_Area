// Rows as the database returns them (supabase/migrations/0001_init.sql).

export interface ProfileRow {
  id: string;
  first_name: string;
  photo_url: string | null;
  suburb: string;
  interests: string[];
  free_times: string[];
  school: string | null;
  keep_school_out: boolean;
  workplace: string | null;
  keep_workplace_out: boolean;
  match_age_min: number | null;
  match_age_max: number | null;
  hide_contacts: boolean;
  discreet_notifications: boolean;
  can_be_put_forward: boolean;
  date_of_birth: string;          // YYYY-MM-DD
  verified_at: string | null;
  created_at: string;
}

export type ProfileFields = Omit<ProfileRow, "id" | "verified_at" | "created_at">;

export interface GuardianRow {
  id: string;
  teen_id: string;
  guardian_id: string | null;
  relationship: "mum" | "dad" | "parent" | "guardian";
  invite_phone: string;
  status: "pending" | "approved" | "revoked";
  approve_objectives: boolean;
  notify_connect: boolean;
  meet_checkin: boolean;
  created_at: string;
  approved_at: string | null;
}

export interface AllowanceRow {
  plan: "free" | "unlimited";
  used_this_month: number;
  extra_credits: number;
  remaining: number | null;     // null = unlimited
}

export interface ObjectiveRow {
  id: string;
  owner_id: string;
  type: string;
  text: string;
  when_text: string | null;
  where_text: string | null;
  group_size: number;
  status: "pending_guardian" | "active" | "done" | "cancelled" | "rejected";
  month: string;
  created_at: string;
}

export interface MyMatchRow {
  request_id: string;
  status: "asking" | "agreed" | "passed" | "expired";
  score: number | null;
  reasons: string[];
  candidate_id: string | null;
  first_name: string | null;
  age: number | null;
  suburb: string | null;
  photo_url: string | null;
}

export interface MyRequestRow {
  request_id: string;
  status: "asking" | "agreed" | "passed" | "expired";
  reasons: string[];
  objective_id: string;
  objective_text: string;
  when_text: string | null;
  where_text: string | null;
  group_size: number;
  requester_id: string;
  first_name: string;
  age: number;
  suburb: string;
  photo_url: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  match_request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ConnectionRow {
  id: string;
  match_request_id: string;
  user_a: string;
  user_b: string;
  method: "ble" | "qr" | "uwb";
  suburb: string | null;
  connected_at: string;
}

export interface ContactRow {
  id: string;
  full_name: string;
  mobile: string | null;
  instagram: string | null;
}

export interface ProfileCardRow {
  id: string;
  first_name: string;
  photo_url: string | null;
  age: number;
  suburb: string;
  interests: string[];
}

export type ReportReason = "unsafe" | "bullying" | "fake" | "inappropriate" | "spam" | "other";
