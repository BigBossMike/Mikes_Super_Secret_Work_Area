-- =====================================================================
-- Intro: initial database
--
-- What this file sets up, in plain English:
--   * Who people are (profiles), with private bits kept separate.
--   * Parents/guardians for 16 and 17 year olds.
--   * Objectives ("a fifth player for Tuesday football") and the people
--     Intro asks to be put forward (match requests).
--   * Chat that blocks phone numbers, emails, handles and links until two
--     people have met and tapped phones (connections).
--   * Safety: blocks, reports, meet-up check-ins, parent notifications and
--     flags for possible ganging-up.
--   * Plans: 1 free objective a month, $5 extra objectives, $10 unlimited.
--
-- Security model: every table has row-level security (RLS) switched on.
-- The app's users ("authenticated") can only read and change what the
-- policies below allow. Anything sensitive (matching, connecting, payments)
-- happens in functions that check the rules themselves.
-- =====================================================================

create schema if not exists private;   -- helper functions, not exposed to the app's API

-- Turns a mobile number into E.164 form, e.g. '0491 570 101' -> '+61491570101'.
-- The app must normalise contact-book numbers the SAME way before hashing
-- them for "hide me from my contacts" (see README).
create function private.normalise_phone(raw text) returns text
language sql immutable as $$
  select case
    when s ~ '^\+[1-9][0-9]{7,14}$' then s                    -- already international
    when s ~ '^0[0-9]{9}$'          then '+61' || substr(s, 2) -- Australian local
    when s ~ '^61[0-9]{9}$'         then '+' || s              -- Australian without the +
  end
  from (select regexp_replace(coalesce(raw, ''), '[^0-9+]', '', 'g') as s) d
$$;

-- Lowercase hex SHA-256 of the normalised number, e.g.
-- phone_hash('0491 570 101') = sha256('+61491570101'). (Marked immutable:
-- the database text encoding is fixed, so the answer never changes.)
create function private.phone_hash(raw text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(private.normalise_phone(raw), 'UTF8')), 'hex')
$$;

-- ---------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------

-- Suburb centre points. We only ever store a person's suburb, never their
-- exact location, and distances are worked out between suburb centres.
create table public.suburbs (
  name text primary key,
  lat  double precision not null,
  lng  double precision not null
);

insert into public.suburbs (name, lat, lng) values
  ('Ashgrove', -27.4446, 152.9870), ('Bardon', -27.4610, 152.9770),
  ('Bulimba', -27.4520, 153.0580), ('Carindale', -27.5030, 153.1010),
  ('Chermside', -27.3850, 153.0310), ('Indooroopilly', -27.4997, 152.9728),
  ('Kangaroo Point', -27.4770, 153.0360), ('Kelvin Grove', -27.4483, 153.0130),
  ('New Farm', -27.4677, 153.0497), ('Newstead', -27.4440, 153.0450),
  ('Paddington', -27.4598, 152.9966), ('Red Hill', -27.4560, 153.0040),
  ('Spring Hill', -27.4600, 153.0230), ('St Lucia', -27.4975, 153.0000),
  ('Sunnybank', -27.5800, 153.0600), ('Toowong', -27.4848, 152.9925),
  ('West End', -27.4820, 153.0090), ('Windsor', -27.4330, 153.0280);

-- Kinds of objective, and which interests make someone a good fit.
create table public.objective_types (
  id    text primary key,
  label text not null,
  tags  text[] not null default '{}'
);

insert into public.objective_types (id, label, tags) values
  ('dinner', 'Dinner or coffee', '{Food}'),
  ('walk',   'Walking buddy',  '{Walking,Running}'),
  ('trivia', 'Trivia team',    '{Trivia,Movies,Music}'),
  ('sport',  'Sports team',    '{Football,Cricket,Running,Gym}'),
  ('movie',  'Movie buddy',    '{Movies}'),
  ('study',  'Study partner',  '{Study}'),
  ('gaming', 'Gaming',         '{Gaming}'),
  ('event',  'Event partner',  '{Dance,Music}'),
  ('other',  'Something else', '{}');

-- ---------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------

-- One row per person using the app. Only the person themselves (and their
-- approved parent) can read this row directly. Other people only ever see
-- a small "card" (first name, photo, age, suburb) through profile_card().
create table public.profiles (
  id                 uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  first_name         text not null check (char_length(first_name) between 1 and 30),
  photo_url          text,
  suburb             text not null references public.suburbs (name),
  interests          text[] not null default '{}',
  free_times         text[] not null default '{}',
  school             text,                                -- optional, only used for "keep my school out"
  keep_school_out    boolean not null default true,
  workplace          text,                                -- optional, only used for "keep my workplace out"
  keep_workplace_out boolean not null default true,
  match_age_min      smallint,                            -- adults: who I'm happy to meet (null = my age - 10)
  match_age_max      smallint,                            -- (null = my age + 10)
  hide_contacts      boolean not null default true,      -- hide me from people in my phone's contacts
  discreet_notifications boolean not null default false, -- push notifications say only "Intro: you have an update"
  can_be_put_forward boolean not null default true,      -- "pause" switch
  date_of_birth      date not null,
  verified_at        timestamptz,                         -- set only by the ID-check service
  created_at         timestamptz not null default now(),
  constraint match_age_bounds check (
        (match_age_min is null or match_age_min between 16 and 99)
    and (match_age_max is null or match_age_max between 16 and 99)
    and (match_age_min is null or match_age_max is null or match_age_min <= match_age_max))
);

-- Things nobody else should ever see.
create table public.profile_private (
  id                  uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  cultural_background text
);

-- Contact details. Locked until two people have connected in person.
create table public.private_contacts (
  id         uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  full_name  text not null,
  mobile     text,
  instagram  text,
  -- Worked out automatically from mobile. Used to match against people's
  -- hidden-contacts lists without ever storing anyone's contact book.
  mobile_e164 text generated always as (private.normalise_phone(mobile)) stored,
  mobile_hash text generated always as (private.phone_hash(mobile)) stored,
  constraint mobile_recognised check (mobile is null or private.normalise_phone(mobile) is not null)
);
create index on public.private_contacts (mobile_hash);

-- "Hide me from my contacts". The app uploads a fingerprint (SHA-256) of each
-- number in the person's phone, never the numbers themselves. Only the owner
-- can read their own list. If either person has hide_contacts on and the
-- other's number is in their list, Intro never matches them.
create table public.hidden_contacts (
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (owner_id, phone_hash)
);
create index on public.hidden_contacts (phone_hash);

-- Parent or guardian links for 16 and 17 year olds. The teen creates an
-- invite with the parent's mobile; the parent signs in with that mobile and
-- claims it. Only the parent can change the settings.
create table public.guardians (
  id                 uuid primary key default gen_random_uuid(),
  teen_id            uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  guardian_id        uuid references auth.users (id) on delete cascade,
  relationship       text not null default 'parent' check (relationship in ('mum', 'dad', 'parent', 'guardian')),
  invite_phone       text not null,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  approve_objectives boolean not null default true,   -- parent OKs each objective first
  notify_connect     boolean not null default true,   -- parent told when teen meets someone
  meet_checkin       boolean not null default true,   -- teen shares place/time before meeting
  created_at         timestamptz not null default now(),
  approved_at        timestamptz,
  unique (teen_id, guardian_id)
);

-- ---------------------------------------------------------------------
-- Plans and payments (written only by the server after the App Store /
-- Google Play confirms a purchase, e.g. via a RevenueCat webhook)
-- ---------------------------------------------------------------------

create table public.subscriptions (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  plan               text not null default 'free' check (plan in ('free', 'unlimited')),
  current_period_end timestamptz,
  store              text,
  updated_at         timestamptz not null default now()
);

-- Extra objectives bought for $5 each.
create table public.objective_credits (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance int not null default 0 check (balance >= 0)
);

-- ---------------------------------------------------------------------
-- Objectives and matching
-- ---------------------------------------------------------------------

create table public.objectives (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type        text not null references public.objective_types (id),
  text        text not null check (char_length(text) between 8 and 120),
  when_text   text check (char_length(when_text) <= 80),
  where_text  text check (char_length(where_text) <= 80),
  group_size  int not null default 0 check (group_size between 0 and 5),   -- "Me + N others"
  status      text not null default 'active'
              check (status in ('pending_guardian', 'active', 'done', 'cancelled', 'rejected')),
  month       date not null default (date_trunc('month', now() at time zone 'Australia/Brisbane'))::date,
  used_credit boolean not null default false,
  decided_by  uuid references auth.users (id),
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.objectives (owner_id, month);

-- One row per person Intro asks to be put forward for an objective.
-- The person who set the objective can NOT read this table directly; they use
-- my_matches(), which hides who someone is until they say yes.
create table public.match_requests (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.objectives (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'asking' check (status in ('asking', 'agreed', 'passed', 'expired')),
  score        int not null,
  reasons      text[] not null default '{}',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (objective_id, candidate_id)
);
create index on public.match_requests (candidate_id, created_at);

-- An in-person connection: both phones were together and both pressed Connect.
create table public.connections (
  id               uuid primary key default gen_random_uuid(),
  match_request_id uuid not null unique references public.match_requests (id) on delete cascade,
  user_a           uuid not null references public.profiles (id) on delete cascade,
  user_b           uuid not null references public.profiles (id) on delete cascade,
  method           text not null check (method in ('ble', 'qr', 'uwb')),
  suburb           text references public.suburbs (name),   -- rough place only
  connected_at     timestamptz not null default now(),
  check (user_a < user_b)
);
create index on public.connections (user_a);
create index on public.connections (user_b);

-- Chat messages, one conversation per agreed match request.
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  match_request_id uuid not null references public.match_requests (id) on delete cascade,
  sender_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 1000),
  created_at       timestamptz not null default now()
);
create index on public.messages (match_request_id, created_at);

-- ---------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported_id      uuid not null references public.profiles (id) on delete cascade,
  match_request_id uuid references public.match_requests (id) on delete set null,
  reason           text not null check (reason in ('unsafe', 'bullying', 'fake', 'inappropriate', 'spam', 'other')),
  details          text check (char_length(details) <= 2000),
  status           text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at       timestamptz not null default now()
);

-- "We're meeting at Toowong Sports Centre, Thursday 6pm" shared before a meet-up.
create table public.meetup_checkins (
  id               uuid primary key default gen_random_uuid(),
  match_request_id uuid not null references public.match_requests (id) on delete cascade,
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  place            text not null check (char_length(place) between 2 and 120),
  meet_at          timestamptz not null,
  created_at       timestamptz not null default now()
);

-- What a parent sees in the parent app's notifications.
create table public.guardian_notifications (
  id          uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users (id) on delete cascade,
  teen_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('objective_pending', 'connected', 'meetup', 'report')),
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index on public.guardian_notifications (guardian_id, created_at desc);

-- Things for the Intro safety team to look at. Not visible in the app.
create table public.safety_flags (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  subject_id  uuid not null references public.profiles (id) on delete cascade,
  related_ids uuid[] not null default '{}',
  note        text,
  flagged_on  date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (kind, subject_id, flagged_on)
);

-- Working data for the phone handshake. Only the connect-handshake server
-- function reads and writes this.
create table public.handshake_presses (
  id               uuid primary key default gen_random_uuid(),
  match_request_id uuid not null references public.match_requests (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  session_key      text not null,
  method           text not null default 'ble' check (method in ('ble', 'qr', 'uwb')),
  pressed_at       timestamptz not null default now(),
  reported_at      timestamptz,
  heard            jsonb not null default '[]',
  lat              double precision,
  lng              double precision,
  accuracy_m       double precision,
  result           text
);
create index on public.handshake_presses (match_request_id, pressed_at desc);

-- =====================================================================
-- Helper functions (private schema, used by the rules below)
-- =====================================================================

create function private.age_years(dob date) returns int
language sql stable as $$
  select date_part('year', age((now() at time zone 'Australia/Brisbane')::date, dob))::int
$$;

-- '16-17' or '18+'. Minors and adults are never matched with each other.
create function private.age_band(dob date) returns text
language sql stable as $$
  select case when private.age_years(dob) < 18 then '16-17' else '18+' end
$$;

create function private.is_minor(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.age_years(p.date_of_birth) < 18 from public.profiles p where p.id = uid), false)
$$;

create function private.is_guardian_of(guardian uuid, teen uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardians g
    where g.guardian_id = guardian and g.teen_id = teen and g.status = 'approved')
$$;

-- Verified, and if under 18 has an approved parent or guardian.
create function private.is_active(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.verified_at is not null
      and (private.age_years(p.date_of_birth) >= 18
           or exists (select 1 from public.guardians g where g.teen_id = uid and g.status = 'approved')))
$$;

create function private.connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.connections c
    where c.user_a = least(a, b) and c.user_b = greatest(a, b))
$$;

create function private.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b) or (bl.blocker_id = b and bl.blocked_id = a))
$$;

-- The two people in a match request: the objective owner and the candidate.
create function private.match_people(p_match uuid, out owner_id uuid, out candidate_id uuid, out status text)
language sql stable security definer set search_path = '' as $$
  select o.owner_id, mr.candidate_id, mr.status
  from public.match_requests mr join public.objectives o on o.id = mr.objective_id
  where mr.id = p_match
$$;

create function private.is_match_participant(p_match uuid, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select uid in (m.owner_id, m.candidate_id) from private.match_people(p_match) m), false)
$$;

create function private.is_candidate_for(p_objective uuid, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.match_requests mr where mr.objective_id = p_objective and mr.candidate_id = uid)
$$;

-- Can this person send a message in this conversation right now?
create function private.can_message(p_match uuid, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.status = 'agreed'
       and uid in (m.owner_id, m.candidate_id)
       and not private.blocked_between(m.owner_id, m.candidate_id)
       and o.status in ('active', 'done')
    from private.match_people(p_match) m
    join public.match_requests mr on mr.id = p_match
    join public.objectives o on o.id = mr.objective_id), false)
$$;

-- Have these two people agreed to talk (either way round)?
create function private.has_agreed_link(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.match_requests mr join public.objectives o on o.id = mr.objective_id
    where mr.status = 'agreed'
      and ((o.owner_id = a and mr.candidate_id = b) or (o.owner_id = b and mr.candidate_id = a)))
$$;

-- Who may see whose card (first name, photo, age, suburb)?
create function private.can_see_card(viewer uuid, target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = target
    or (not private.blocked_between(viewer, target) and (
         private.has_agreed_link(viewer, target)
         or private.connected(viewer, target)
         -- someone who was asked can see who's asking, so they can decide
         or exists (select 1 from public.match_requests mr join public.objectives o on o.id = mr.objective_id
                    where mr.candidate_id = viewer and o.owner_id = target)))
    -- a parent can see their teen, and anyone their teen has agreed to talk to or met
    or exists (select 1 from public.guardians g
               where g.guardian_id = viewer and g.status = 'approved'
                 and (g.teen_id = target or private.has_agreed_link(g.teen_id, target) or private.connected(g.teen_id, target)))
$$;

-- Returns what kind of contact detail a piece of text seems to contain, or
-- null if it looks clean. Mirrors the checks in the app so the server has
-- the final say.
create function private.contact_detail_kind(t text) returns text
language sql immutable as $$
  select case
    when t ~ '\+?\d[\d\s().-]{7,}\d' then 'a phone number'
    when t ~ '[\w.+-]+@[\w-]+\.[\w.]+' then 'an email address'
    when t ~ '(^|\s)@[\w.]{2,}' then 'a social handle'
    when t ~* '(https?://|www\.|\.(com|net|org|au|io|me)\y)' then 'a link'
    when t ~* '\y(insta(gram)?|snap(chat)?|whats ?app|facebook|fb|tik ?tok|discord|my number|phone number|add me)\y' then 'a social account'
  end
$$;

-- The ages someone is happy to be matched with.
--   16-17: always 16 to 17.
--   Adults: what they've set, otherwise their own age -10 to +10.
--   Never more than 20 years either side, and never under 18.
create function private.age_range(dob date, mn smallint, mx smallint, out lo int, out hi int)
language sql stable as $$
  with a as (select private.age_years(dob) as age),
       r as (select age,
                    case when age < 18 then greatest(16, coalesce(mn, 16))
                         else greatest(18, age - 20, coalesce(mn, age - 10)) end as lo,
                    case when age < 18 then least(17, coalesce(mx, 17))
                         else least(age + 20, coalesce(mx, age + 10)) end as hi
             from a)
  select lo, greatest(lo, hi) from r
$$;

-- Does "other" fall inside the seeker's age range?
create function private.age_fits(seeker_dob date, seeker_min smallint, seeker_max smallint, other_dob date) returns boolean
language sql stable as $$
  select private.age_years(other_dob) between r.lo and r.hi
  from private.age_range(seeker_dob, seeker_min, seeker_max) r
$$;

-- True if either person has asked to be hidden from the other (their number
-- is in the other's hidden-contacts list and that person has hiding switched on).
create function private.contact_hidden(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles pa, public.profiles pb
    where pa.id = a and pb.id = b
      and ((pa.hide_contacts and exists (
              select 1 from public.hidden_contacts h join public.private_contacts c on c.mobile_hash = h.phone_hash
              where h.owner_id = a and c.id = b))
        or (pb.hide_contacts and exists (
              select 1 from public.hidden_contacts h join public.private_contacts c on c.mobile_hash = h.phone_hash
              where h.owner_id = b and c.id = a))))
$$;

-- Straight-line distance between two suburb centres, in whole km (min 1).
create function private.distance_km(a text, b text) returns int
language sql stable set search_path = '' as $$
  select greatest(1, round(6371 * 2 * asin(sqrt(
           power(sin(radians(s2.lat - s1.lat) / 2), 2)
           + cos(radians(s1.lat)) * cos(radians(s2.lat)) * power(sin(radians(s2.lng - s1.lng) / 2), 2)))))::int
  from public.suburbs s1, public.suburbs s2
  where s1.name = a and s2.name = b
$$;

-- Tell a teen's parent(s) about something, respecting their settings.
create function private.notify_guardians(p_teen uuid, p_kind text, p_payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.guardian_notifications (guardian_id, teen_id, kind, payload)
  select g.guardian_id, p_teen, p_kind, p_payload
  from public.guardians g
  where g.teen_id = p_teen and g.status = 'approved' and g.guardian_id is not null
    and case p_kind
          when 'objective_pending' then g.approve_objectives
          when 'connected' then g.notify_connect
          when 'meetup' then g.meet_checkin
          else true                                    -- reports always go to parents
        end
$$;

-- How many objectives someone has this month, and how many they may have.
create function private.allowance(uid uuid, out plan text, out used int, out credits int, out remaining int)
language sql stable security definer set search_path = '' as $$
  select
    case when s.plan = 'unlimited' and (s.current_period_end is null or s.current_period_end > now())
         then 'unlimited' else 'free' end,
    (select count(*)::int from public.objectives o
      where o.owner_id = uid and o.status <> 'rejected'
        and o.month = (date_trunc('month', now() at time zone 'Australia/Brisbane'))::date),
    coalesce(c.balance, 0),
    null::int
  from (select uid as id) me
  left join public.subscriptions s on s.user_id = me.id
  left join public.objective_credits c on c.user_id = me.id
$$;

-- =====================================================================
-- Triggers (rules checked every time data changes)
-- =====================================================================

-- Profiles: 16 or over. (Date of birth and verified_at can't be changed by
-- the app after sign-up; see the permissions at the bottom of this file.)
create function private.profiles_guard() returns trigger
language plpgsql as $$
begin
  if private.age_years(new.date_of_birth) < 16 then
    raise exception 'Intro is for people aged 16 and over' using errcode = 'P0001';
  end if;
  if new.school is not null then new.school := nullif(trim(new.school), ''); end if;
  if new.workplace is not null then new.workplace := nullif(trim(new.workplace), ''); end if;
  if private.age_years(new.date_of_birth) >= 18 then
    if new.match_age_min is not null and new.match_age_min < 18 then
      raise exception 'Adults can only be matched with people 18 and over' using errcode = 'P0001';
    end if;
    if (new.match_age_min is not null and new.match_age_min < private.age_years(new.date_of_birth) - 20)
       or (new.match_age_max is not null and new.match_age_max > private.age_years(new.date_of_birth) + 20) then
      raise exception 'Age range can be at most 20 years either side of your age' using errcode = 'P0001';
    end if;
  elsif (new.match_age_min is not null and new.match_age_min not between 16 and 17)
     or (new.match_age_max is not null and new.match_age_max not between 16 and 17) then
    raise exception '16 and 17 year olds are only matched with 16 and 17 year olds' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger profiles_guard before insert or update on public.profiles
for each row execute function private.profiles_guard();

-- Objectives: check the person can post one, apply plan limits, block
-- contact details, and send under-18s' objectives to a parent first.
create function private.objectives_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  needs_ok boolean;
  k text;
begin
  if not private.is_active(new.owner_id) then
    raise exception 'Finish your ID check (and parent sign-off if you''re under 18) first' using errcode = 'P0001';
  end if;

  k := coalesce(private.contact_detail_kind(new.text), private.contact_detail_kind(coalesce(new.when_text, '')),
                private.contact_detail_kind(coalesce(new.where_text, '')));
  if k is not null then
    raise exception 'contact_details_locked' using errcode = 'P0001', detail = k,
      hint = 'Objectives can''t include contact details.';
  end if;

  -- Plan limits: 1 free a month, then a $5 credit each, or unlimited.
  select * into a from private.allowance(new.owner_id);
  new.used_credit := false;
  if a.plan <> 'unlimited' and a.used >= 1 then
    update public.objective_credits set balance = balance - 1
    where user_id = new.owner_id and balance > 0;
    if not found then
      raise exception 'objective_limit_reached' using errcode = 'P0001',
        hint = 'You''ve used this month''s free objective. Buy one more, or go unlimited.';
    end if;
    new.used_credit := true;
  end if;

  needs_ok := private.is_minor(new.owner_id) and exists (
    select 1 from public.guardians g
    where g.teen_id = new.owner_id and g.status = 'approved' and g.approve_objectives);
  new.status := case when needs_ok then 'pending_guardian' else 'active' end;
  new.month := (date_trunc('month', now() at time zone 'Australia/Brisbane'))::date;
  new.decided_by := null;
  new.decided_at := null;
  return new;
end $$;

create trigger objectives_before_insert before insert on public.objectives
for each row execute function private.objectives_before_insert();

create function private.objectives_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending_guardian' then
    perform private.notify_guardians(new.owner_id, 'objective_pending',
      jsonb_build_object('objective_id', new.id, 'text', new.text, 'group_size', new.group_size));
  end if;
  return null;
end $$;

create trigger objectives_after_insert after insert on public.objectives
for each row execute function private.objectives_after_insert();

-- Messages: no contact details until the two people have met in person.
create function private.messages_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  k text;
begin
  select * into m from private.match_people(new.match_request_id);
  if not private.connected(m.owner_id, m.candidate_id) then
    k := private.contact_detail_kind(new.body);
    if k is not null then
      raise exception 'contact_details_locked' using errcode = 'P0001', detail = k,
        hint = 'Contact details unlock once you meet and tap phones.';
    end if;
  end if;
  return new;
end $$;

create trigger messages_before_insert before insert on public.messages
for each row execute function private.messages_before_insert();

-- Reports: parents of anyone under 18 involved are told straight away.
create function private.reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_guardians(new.reporter_id, 'report', jsonb_build_object('report_id', new.id, 'role', 'made a report'));
  perform private.notify_guardians(new.reported_id, 'report', jsonb_build_object('report_id', new.id, 'role', 'was reported'));
  return null;
end $$;

create trigger reports_after_insert after insert on public.reports
for each row execute function private.reports_after_insert();

-- Meet-up check-ins go to the teen's parent if they've asked for them.
create function private.meetups_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  other uuid;
begin
  select * into m from private.match_people(new.match_request_id);
  other := case when new.user_id = m.owner_id then m.candidate_id else m.owner_id end;
  perform private.notify_guardians(new.user_id, 'meetup', jsonb_build_object(
    'place', new.place, 'meet_at', new.meet_at,
    'with_first_name', (select p.first_name from public.profiles p where p.id = other)));
  return null;
end $$;

create trigger meetups_after_insert after insert on public.meetup_checkins
for each row execute function private.meetups_after_insert();

-- =====================================================================
-- Matching
-- =====================================================================

-- Everyone who could be asked for an objective, with a score and reasons.
-- Hard rules (anyone failing these is never asked):
--   * same age band (16-17 with 16-17, 18+ with 18+)
--   * verified, active, and not paused
--   * no block either way
--   * both people's ages inside each other's age range (mutual). Adults
--     default to their own age -10 to +10, so a 55-year-old is never
--     matched with a 19-year-old.
--   * not from the same school / workplace if either person has "keep my
--     school/workplace out" on
--   * not hidden from each other via "hide me from my contacts"
--   * not someone this person has asked before, or already met
--   * within 25 km
-- Score also gently prefers people closer in age (matters most for adults).
create function private.score_candidates(p_objective uuid)
returns table (candidate_id uuid, score int, reasons text[])
language sql stable security definer set search_path = '' as $$
  with o as (select * from public.objectives where id = p_objective),
       me as (select p.* from public.profiles p join o on p.id = o.owner_id),
       t as (select ot.tags from public.objective_types ot join o on ot.id = o.type),
       c as (
         select p.*,
                array(select unnest(p.interests) intersect select unnest(t.tags)) as fit,
                array(select unnest(p.interests) intersect select unnest(me.interests)) as shared,
                array(select unnest(p.free_times) intersect select unnest(me.free_times)) as times,
                private.distance_km(me.suburb, p.suburb) as km,
                abs(extract(year from age(p.date_of_birth)) - extract(year from age(me.date_of_birth)))::int as age_gap
         from public.profiles p, me, t
         where p.id <> me.id
           and p.verified_at is not null
           and p.can_be_put_forward
           and private.is_active(p.id)
           and private.age_band(p.date_of_birth) = private.age_band(me.date_of_birth)
           and private.age_fits(me.date_of_birth, me.match_age_min, me.match_age_max, p.date_of_birth)
           and private.age_fits(p.date_of_birth, p.match_age_min, p.match_age_max, me.date_of_birth)
           and not private.blocked_between(p.id, me.id)
           and not ((p.keep_school_out or me.keep_school_out)
                    and p.school is not null and me.school is not null
                    and lower(p.school) = lower(me.school))
           and not ((p.keep_workplace_out or me.keep_workplace_out)
                    and p.workplace is not null and me.workplace is not null
                    and lower(p.workplace) = lower(me.workplace))
           and not private.contact_hidden(me.id, p.id)
           and not exists (select 1 from public.match_requests mr join public.objectives o2 on o2.id = mr.objective_id
                           where o2.owner_id = me.id and mr.candidate_id = p.id)
           and not private.connected(p.id, me.id)
       )
  select c.id,
         least(97, 52 + cardinality(c.fit) * 14 + cardinality(c.shared) * 9 + cardinality(c.times) * 6
                   + greatest(0, 14 - c.km * 2) - least(20, c.age_gap)),
         array_remove(array[
           case when cardinality(c.shared) > 0 then 'Both into ' || lower(c.shared[1])
                when cardinality(c.fit) > 0 then 'Into ' || lower(c.fit[1]) end,
           case when cardinality(c.shared) > 1 then cardinality(c.shared) || ' shared interests' end,
           case when cardinality(c.times) > 0 then 'Both free ' || c.times[1] end,
           c.km || ' km apart'], null)
  from c
  where c.km <= 25
$$;

-- Ganging-up check. Skip a candidate if, in the last 14 days, they've had
-- requests from people who know this requester, or from 2+ people who know
-- each other. "Know" = have connected in person on Intro.
create function private.collusion_risk(p_candidate uuid, p_requester uuid, out risky boolean, out others uuid[])
language sql stable security definer set search_path = '' as $$
  with r as (
    select distinct o.owner_id as rid
    from public.match_requests mr join public.objectives o on o.id = mr.objective_id
    where mr.candidate_id = p_candidate and mr.created_at > now() - interval '14 days' and o.owner_id <> p_requester
  )
  select exists (select 1 from r where private.connected(r.rid, p_requester))
      or exists (select 1 from r r1 join r r2 on r1.rid < r2.rid where private.connected(r1.rid, r2.rid)),
         coalesce((select array_agg(rid) from r), '{}')
$$;

-- Ask up to 5 people for an objective. Returns how many were asked. It does
-- NOT return who they are: the requester only finds out when someone says yes.
create function public.find_matches(p_objective uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  o public.objectives;
  slots int;
  asked int := 0;
  cand record;
  risk record;
begin
  select * into o from public.objectives where id = p_objective for update;
  if not found then
    raise exception 'Objective not found' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and auth.uid() <> o.owner_id then
    raise exception 'Not your objective' using errcode = '42501';
  end if;
  if o.status <> 'active' then
    raise exception 'This objective isn''t active yet (status: %)', o.status using errcode = 'P0001';
  end if;

  slots := 5 - (select count(*) from public.match_requests where objective_id = o.id);

  for cand in
    select * from private.score_candidates(o.id) order by score desc, random()
  loop
    exit when slots <= 0;

    -- Nobody gets more than 3 requests a week.
    continue when (select count(*) from public.match_requests mr
                   where mr.candidate_id = cand.candidate_id and mr.created_at > now() - interval '7 days') >= 3;

    select * into risk from private.collusion_risk(cand.candidate_id, o.owner_id);
    if risk.risky then
      insert into public.safety_flags as sf (kind, subject_id, related_ids, note)
      values ('possible_collusion', cand.candidate_id, risk.others || o.owner_id,
              'Requests from people who know each other landed on the same person')
      on conflict (kind, subject_id, flagged_on) do update
        set related_ids = (select array_agg(distinct x) from unnest(sf.related_ids || excluded.related_ids) x);
      continue;
    end if;

    insert into public.match_requests (objective_id, candidate_id, score, reasons)
    values (o.id, cand.candidate_id, cand.score, cand.reasons);
    slots := slots - 1;
    asked := asked + 1;
  end loop;

  return asked;
end $$;

-- =====================================================================
-- App functions (called from the app through Supabase "rpc")
-- =====================================================================

-- A person's card, if you're allowed to see it.
create function public.profile_card(p_user uuid)
returns table (id uuid, first_name text, photo_url text, age int, suburb text, interests text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.photo_url, private.age_years(p.date_of_birth), p.suburb, p.interests
  from public.profiles p
  where p.id = p_user and private.can_see_card(auth.uid(), p.id)
$$;

-- The requester's view of their matches. People are anonymous until they agree.
create function public.my_matches(p_objective uuid)
returns table (request_id uuid, status text, score int, reasons text[],
               candidate_id uuid, first_name text, age int, suburb text, photo_url text)
language sql stable security definer set search_path = '' as $$
  select mr.id, mr.status,
         case when mr.status = 'agreed' then mr.score end,
         case when mr.status = 'agreed' then mr.reasons else '{}'::text[] end,
         case when mr.status = 'agreed' then p.id end,
         case when mr.status = 'agreed' then p.first_name end,
         case when mr.status = 'agreed' then private.age_years(p.date_of_birth) end,
         case when mr.status = 'agreed' then p.suburb end,
         case when mr.status = 'agreed' then p.photo_url end
  from public.match_requests mr
  join public.objectives o on o.id = mr.objective_id
  join public.profiles p on p.id = mr.candidate_id
  where mr.objective_id = p_objective and o.owner_id = auth.uid()
  order by (mr.status = 'agreed') desc, mr.created_at
$$;

-- Requests to be put forward that have come to me.
create function public.my_requests()
returns table (request_id uuid, status text, reasons text[], objective_id uuid, objective_text text,
               when_text text, where_text text, group_size int,
               requester_id uuid, first_name text, age int, suburb text, photo_url text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select mr.id, mr.status, mr.reasons, o.id, o.text, o.when_text, o.where_text, o.group_size,
         p.id, p.first_name, private.age_years(p.date_of_birth), p.suburb, p.photo_url, mr.created_at
  from public.match_requests mr
  join public.objectives o on o.id = mr.objective_id
  join public.profiles p on p.id = o.owner_id
  where mr.candidate_id = auth.uid() and o.status in ('active', 'done')
    and not private.blocked_between(auth.uid(), p.id)
  order by mr.created_at desc
$$;

-- Say yes or no to being put forward. Saying no is silent: the requester
-- only ever sees "Not this time", never who passed.
create function public.respond_to_request(p_request uuid, p_agree boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  new_status text := case when p_agree then 'agreed' else 'passed' end;
begin
  update public.match_requests
     set status = new_status, responded_at = now()
   where id = p_request and candidate_id = auth.uid() and status = 'asking';
  if not found then
    raise exception 'Request not found or already answered' using errcode = 'P0002';
  end if;
  return new_status;
end $$;

-- How many objectives I have left this month (null = unlimited).
create function public.objective_allowance()
returns table (plan text, used_this_month int, extra_credits int, remaining int)
language sql stable security definer set search_path = '' as $$
  select a.plan, a.used, a.credits,
         case when a.plan = 'unlimited' then null else greatest(0, 1 - a.used) + a.credits end
  from private.allowance(auth.uid()) a
$$;

-- Cancel one of my objectives. Anyone still being asked is quietly let go.
create function public.cancel_objective(p_objective uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.objectives set status = 'cancelled'
   where id = p_objective and owner_id = auth.uid() and status in ('pending_guardian', 'active');
  if not found then
    raise exception 'Objective not found or already finished' using errcode = 'P0002';
  end if;
  update public.match_requests set status = 'expired' where objective_id = p_objective and status = 'asking';
end $$;

-- Parent: claim an invite. The parent must be signed in with the same
-- mobile number the teen entered.
create function public.claim_guardian_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  my_phone text := regexp_replace(coalesce((select u.phone from auth.users u where u.id = auth.uid()), ''), '\D', '', 'g');
begin
  update public.guardians g
     set guardian_id = auth.uid(), status = 'approved', approved_at = now()
   where g.id = p_invite and g.status = 'pending' and g.teen_id <> auth.uid()
     and my_phone <> ''
     and right(regexp_replace(g.invite_phone, '\D', '', 'g'), 9) = right(my_phone, 9);
  if not found then
    raise exception 'Invite not found, or it was sent to a different mobile number' using errcode = 'P0002';
  end if;
end $$;

-- Parent: approve or turn down a teen's objective. A turned-down objective
-- gives back any $5 credit it used.
create function public.guardian_decide_objective(p_objective uuid, p_approve boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.objectives;
begin
  select * into o from public.objectives where id = p_objective for update;
  if not found or not private.is_guardian_of(auth.uid(), o.owner_id) then
    raise exception 'Objective not found' using errcode = 'P0002';
  end if;
  if o.status <> 'pending_guardian' then
    raise exception 'This objective has already been decided' using errcode = 'P0001';
  end if;
  update public.objectives
     set status = case when p_approve then 'active' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = o.id;
  if not p_approve and o.used_credit then
    insert into public.objective_credits as oc (user_id, balance) values (o.owner_id, 1)
    on conflict (user_id) do update set balance = oc.balance + 1;
  end if;
  return case when p_approve then 'active' else 'rejected' end;
end $$;

-- Parent: what my teen has been doing. Never includes chat messages.
create function public.guardian_activity(p_teen uuid)
returns table (kind text, title text, detail text, happened_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from (
    select 'objective'::text as kind,
           case o.status when 'pending_guardian' then 'Waiting for your OK'
                         when 'done' then 'Finished an objective'
                         when 'rejected' then 'Objective you turned down'
                         when 'cancelled' then 'Cancelled an objective'
                         else 'Set an objective' end as title,
           o.text || ' · ' || case o.group_size when 0 then 'Just me' else 'Me + ' || o.group_size || ' others' end as detail,
           o.created_at as happened_at
    from public.objectives o where o.owner_id = p_teen
    union all
    select 'match', 'Matched with ' || p.first_name || ', ' || private.age_years(p.date_of_birth),
           p.suburb || ' · ID verified', mr.responded_at
    from public.match_requests mr
    join public.objectives o on o.id = mr.objective_id
    join public.profiles p on p.id = mr.candidate_id
    where o.owner_id = p_teen and mr.status = 'agreed'
    union all
    select 'request', 'Said yes to ' || p.first_name || '''s objective', o.text, mr.responded_at
    from public.match_requests mr
    join public.objectives o on o.id = mr.objective_id
    join public.profiles p on p.id = o.owner_id
    where mr.candidate_id = p_teen and mr.status = 'agreed'
    union all
    select 'connection', 'Met ' || p.first_name || ' in person', coalesce(c.suburb, 'Place shared'), c.connected_at
    from public.connections c
    join public.profiles p on p.id = case when c.user_a = p_teen then c.user_b else c.user_a end
    where p_teen in (c.user_a, c.user_b)
    union all
    select 'report', 'Safety report', r.reason, r.created_at
    from public.reports r where p_teen in (r.reporter_id, r.reported_id)
  ) a
  where private.is_guardian_of(auth.uid(), p_teen)
  order by a.happened_at desc
$$;

-- Server only: record an in-person connection (called by the
-- connect-handshake function once both phones have checked out).
create function public.complete_connection(p_match uuid, p_method text, p_suburb text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  conn_id uuid;
begin
  select * into m from private.match_people(p_match);
  if m.owner_id is null or m.status <> 'agreed' then
    raise exception 'Only agreed matches can connect' using errcode = 'P0001';
  end if;
  if private.blocked_between(m.owner_id, m.candidate_id) then
    raise exception 'These people can''t connect' using errcode = 'P0001';
  end if;

  insert into public.connections (match_request_id, user_a, user_b, method, suburb)
  values (p_match, least(m.owner_id, m.candidate_id), greatest(m.owner_id, m.candidate_id), p_method, p_suburb)
  on conflict (match_request_id) do nothing
  returning id into conn_id;

  if conn_id is null then   -- already connected earlier: nothing more to do
    return (select id from public.connections where match_request_id = p_match);
  end if;

  update public.objectives o set status = 'done'
  from public.match_requests mr
  where mr.id = p_match and o.id = mr.objective_id and o.status = 'active';

  perform private.notify_guardians(m.owner_id, 'connected', jsonb_build_object(
    'with_first_name', (select first_name from public.profiles where id = m.candidate_id), 'suburb', p_suburb));
  perform private.notify_guardians(m.candidate_id, 'connected', jsonb_build_object(
    'with_first_name', (select first_name from public.profiles where id = m.owner_id), 'suburb', p_suburb));
  return conn_id;
end $$;

-- =====================================================================
-- Row-level security: who can read and write each table
-- =====================================================================

alter table public.suburbs                enable row level security;
alter table public.objective_types        enable row level security;
alter table public.profiles               enable row level security;
alter table public.profile_private        enable row level security;
alter table public.private_contacts       enable row level security;
alter table public.hidden_contacts        enable row level security;
alter table public.guardians              enable row level security;
alter table public.subscriptions          enable row level security;
alter table public.objective_credits      enable row level security;
alter table public.objectives             enable row level security;
alter table public.match_requests         enable row level security;
alter table public.connections            enable row level security;
alter table public.messages               enable row level security;
alter table public.blocks                 enable row level security;
alter table public.reports                enable row level security;
alter table public.meetup_checkins        enable row level security;
alter table public.guardian_notifications enable row level security;
alter table public.safety_flags           enable row level security;   -- no policies: staff/server only
alter table public.handshake_presses      enable row level security;   -- no policies: server only

-- Reference data: anyone signed in can read.
create policy "read suburbs" on public.suburbs for select to authenticated using (true);
create policy "read objective types" on public.objective_types for select to authenticated using (true);

-- Profiles: yourself, or your parent.
create policy "own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_guardian_of((select auth.uid()), id));
create policy "create own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own private details" on public.profile_private for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Contact details: yourself, or someone you've met in person through Intro.
create policy "contacts after meeting" on public.private_contacts for select to authenticated
  using (id = (select auth.uid()) or private.connected((select auth.uid()), id));
create policy "add own contacts" on public.private_contacts for insert to authenticated
  with check (id = (select auth.uid()));
create policy "edit own contacts" on public.private_contacts for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Hidden contacts: strictly your own list. Nobody else, including parents,
-- can read it.
create policy "own hidden contacts: read" on public.hidden_contacts for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "own hidden contacts: add" on public.hidden_contacts for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "own hidden contacts: remove" on public.hidden_contacts for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Guardians: the teen and the parent can see the link. The teen can invite;
-- only the parent can change the settings.
create policy "see guardian link" on public.guardians for select to authenticated
  using (teen_id = (select auth.uid()) or guardian_id = (select auth.uid()));
create policy "teen invites parent" on public.guardians for insert to authenticated
  with check (teen_id = (select auth.uid()) and guardian_id is null and status = 'pending');
create policy "teen cancels pending invite" on public.guardians for delete to authenticated
  using (teen_id = (select auth.uid()) and status = 'pending');
create policy "parent changes settings" on public.guardians for update to authenticated
  using (guardian_id = (select auth.uid())) with check (guardian_id = (select auth.uid()) and status in ('approved', 'revoked'));

-- Plans: read your own. Written by the server only.
create policy "own subscription" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "own credits" on public.objective_credits for select to authenticated using (user_id = (select auth.uid()));

-- Objectives: owner, owner's parent, and people asked about it.
create policy "see objectives" on public.objectives for select to authenticated
  using (owner_id = (select auth.uid())
         or private.is_guardian_of((select auth.uid()), owner_id)
         or private.is_candidate_for(id, (select auth.uid())));
create policy "create own objective" on public.objectives for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- Match requests: only the person being asked can read the row. Requesters
-- use my_matches(); parents use guardian_activity().
create policy "requests sent to me" on public.match_requests for select to authenticated
  using (candidate_id = (select auth.uid()));

-- Connections: the two people, and their parents.
create policy "see connections" on public.connections for select to authenticated
  using ((select auth.uid()) in (user_a, user_b)
         or private.is_guardian_of((select auth.uid()), user_a)
         or private.is_guardian_of((select auth.uid()), user_b));

-- Messages: only the two people in the conversation. Never parents.
create policy "read own conversations" on public.messages for select to authenticated
  using (private.is_match_participant(match_request_id, (select auth.uid())));
create policy "send in own conversations" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.can_message(match_request_id, (select auth.uid())));

-- Blocks: your own list.
create policy "own blocks" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- Reports: make one, see the ones you made.
create policy "make reports" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "see own reports" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- Meet-up check-ins: the two people in the conversation.
create policy "share meetup" on public.meetup_checkins for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_message(match_request_id, (select auth.uid())));
create policy "see meetups" on public.meetup_checkins for select to authenticated
  using (private.is_match_participant(match_request_id, (select auth.uid())));

-- Parent notifications: the parent's own.
create policy "own notifications" on public.guardian_notifications for select to authenticated
  using (guardian_id = (select auth.uid()));
create policy "mark notifications read" on public.guardian_notifications for update to authenticated
  using (guardian_id = (select auth.uid())) with check (guardian_id = (select auth.uid()));

-- =====================================================================
-- Table and function permissions
-- Start from nothing, then allow exactly what the app needs. Columns not
-- listed (verified_at, date_of_birth after sign-up, status, etc.) can only
-- be changed by the server.
-- =====================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon;

grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select on public.suburbs, public.objective_types to authenticated;

grant select on public.profiles to authenticated;
grant insert (id, first_name, photo_url, suburb, interests, free_times, school, keep_school_out,
              workplace, keep_workplace_out, match_age_min, match_age_max, hide_contacts,
              discreet_notifications, can_be_put_forward, date_of_birth) on public.profiles to authenticated;
grant update (first_name, photo_url, suburb, interests, free_times, school, keep_school_out,
              workplace, keep_workplace_out, match_age_min, match_age_max, hide_contacts,
              discreet_notifications, can_be_put_forward) on public.profiles to authenticated;

grant select, insert, update, delete on public.profile_private to authenticated;
grant select on public.private_contacts to authenticated;
grant insert (id, full_name, mobile, instagram), update (full_name, mobile, instagram) on public.private_contacts to authenticated;
grant select, insert (owner_id, phone_hash), delete on public.hidden_contacts to authenticated;

grant select on public.guardians to authenticated;
grant insert (teen_id, relationship, invite_phone) on public.guardians to authenticated;
grant update (approve_objectives, notify_connect, meet_checkin, status) on public.guardians to authenticated;
grant delete on public.guardians to authenticated;

grant select on public.subscriptions, public.objective_credits to authenticated;

grant select on public.objectives to authenticated;
grant insert (owner_id, type, text, when_text, where_text, group_size) on public.objectives to authenticated;

grant select on public.match_requests to authenticated;
grant select on public.connections to authenticated;
grant select on public.messages to authenticated;
grant insert (match_request_id, sender_id, body) on public.messages to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, reported_id, match_request_id, reason, details) on public.reports to authenticated;
grant select on public.meetup_checkins to authenticated;
grant insert (match_request_id, user_id, place, meet_at) on public.meetup_checkins to authenticated;
grant select on public.guardian_notifications to authenticated;
grant update (read_at) on public.guardian_notifications to authenticated;

grant execute on function
  public.find_matches(uuid),
  public.profile_card(uuid),
  public.my_matches(uuid),
  public.my_requests(),
  public.respond_to_request(uuid, boolean),
  public.objective_allowance(),
  public.cancel_objective(uuid),
  public.claim_guardian_invite(uuid),
  public.guardian_decide_objective(uuid, boolean),
  public.guardian_activity(uuid)
to authenticated;
-- public.complete_connection is deliberately NOT granted to app users.

-- Live chat updates (Supabase Realtime respects the rules above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.match_requests, public.guardian_notifications;
  end if;
end $$;
