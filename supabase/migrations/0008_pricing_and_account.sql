-- Pricing and account deletion.
--
-- Pricing (decided 28th October 2026): a 7-day free trial, then $7.99 a month.
-- Subscribers set as many plans as they like. Being asked to join someone
-- else's plan is always free. The trial and the monthly charge run through
-- Apple and Google (RevenueCat writes public.subscriptions). Until in-app
-- purchases are live (the setting payments_live), everyone can set plans free:
-- that is the pilot. The $5 extra objective and the 1-free-a-month limit are gone.
--
-- Delete my account: removes the person and everything that cascades from them.
-- Reports they made or that were made about them are kept, without their
-- profile, so the safety team can still act; the mobile number is kept only as
-- a fingerprint, to recognise the same person joining again.

-- ---------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------

create table private.settings (
  key   text primary key,
  value jsonb not null
);
insert into private.settings (key, value) values ('payments_live', 'false');

create function private.payments_live() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (s.value)::boolean from private.settings s where s.key = 'payments_live'), false)
$$;

alter table public.subscriptions add column in_trial boolean not null default false;

-- plan is 'unlimited' for a subscriber (trial or paid) and for everyone during the pilot.
create or replace function private.allowance(uid uuid, out plan text, out used int, out credits int, out remaining int)
language sql stable security definer set search_path = '' as $$
  select
    case when not private.payments_live() then 'unlimited'
         when s.plan = 'unlimited' and (s.current_period_end is null or s.current_period_end > now()) then 'unlimited'
         else 'free' end,
    (select count(*)::int from public.objectives o
      where o.owner_id = uid and o.status <> 'rejected'
        and o.month = (date_trunc('month', now() at time zone 'Australia/Brisbane'))::date),
    0,
    null::int
  from (select uid as id) me
  left join public.subscriptions s on s.user_id = me.id
$$;

create or replace function public.objective_allowance()
returns table (plan text, used_this_month int, extra_credits int, remaining int)
language sql stable security definer set search_path = '' as $$
  select a.plan, a.used, 0, case when a.plan = 'unlimited' then null else 0 end
  from private.allowance(auth.uid()) a
$$;

-- What the app shows on the plans screen.
create function public.my_plan()
returns table (subscribed boolean, in_trial boolean, renews_at timestamptz, payments_live boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(s.plan = 'unlimited' and (s.current_period_end is null or s.current_period_end > now()), false),
         coalesce(s.in_trial, false),
         s.current_period_end,
         private.payments_live()
  from (select auth.uid() as id) me
  left join public.subscriptions s on s.user_id = me.id
$$;

-- Same as 0007 except the plan check: a subscription (or the pilot) instead of 1 free a month plus $5 credits.
create or replace function private.objectives_before_insert() returns trigger
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

  k := private.plan_issue(concat_ws(' ', new.text, new.when_text, new.where_text), private.is_minor(new.owner_id));
  if k is not null then
    raise exception 'objective_not_allowed' using errcode = 'P0001', detail = k, hint = private.plan_issue_message(k);
  end if;

  select * into a from private.allowance(new.owner_id);
  if a.plan <> 'unlimited' then
    raise exception 'subscription_needed' using errcode = 'P0001',
      hint = 'Start your 7-day free trial to set a plan. Being asked to join someone else''s plan is always free.';
  end if;
  new.used_credit := false;

  needs_ok := private.is_minor(new.owner_id) and exists (
    select 1 from public.guardians g
    where g.teen_id = new.owner_id and g.status = 'approved' and g.approve_objectives);
  new.status := case when needs_ok then 'pending_guardian' else 'active' end;
  new.month := (date_trunc('month', now() at time zone 'Australia/Brisbane'))::date;
  new.decided_by := null;
  new.decided_at := null;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Delete my account
-- ---------------------------------------------------------------------

create table private.deleted_accounts (
  id              uuid primary key default gen_random_uuid(),
  phone_hash      text,
  deleted_at      timestamptz not null default now(),
  reports_made    int not null default 0,
  reports_against int not null default 0
);

create table private.retained_reports (
  report_id           uuid primary key,
  reporter_phone_hash text,
  reported_phone_hash text,
  reason              text not null,
  details             text,
  status              text not null,
  created_at          timestamptz not null,
  retained_at         timestamptz not null default now()
);

create function private.user_phone_hash(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when private.normalise_phone(u.phone) is not null then private.phone_hash(u.phone) end
  from auth.users u where u.id = uid
$$;

-- The app removes the profile photo through Storage first (Storage files can't be deleted from SQL).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  insert into private.retained_reports (report_id, reporter_phone_hash, reported_phone_hash, reason, details, status, created_at)
  select r.id, private.user_phone_hash(r.reporter_id), private.user_phone_hash(r.reported_id), r.reason, r.details, r.status, r.created_at
  from public.reports r
  where uid in (r.reporter_id, r.reported_id)
  on conflict (report_id) do nothing;
  insert into private.deleted_accounts (phone_hash, reports_made, reports_against)
  values (private.user_phone_hash(uid),
          (select count(*) from public.reports where reporter_id = uid),
          (select count(*) from public.reports where reported_id = uid));
  -- Everything else goes with the sign-in: profile, photo record, plans, matches, chats, contacts, tokens, parent links.
  delete from auth.users where id = uid;
end $$;

revoke all on function public.my_plan(), public.delete_my_account() from public, anon;
grant execute on function public.my_plan(), public.delete_my_account() to authenticated;
revoke all on function private.payments_live(), private.user_phone_hash(uuid) from public, anon, authenticated;
grant execute on function private.payments_live() to authenticated;
