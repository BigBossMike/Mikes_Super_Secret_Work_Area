-- Push notifications.
--
-- Each phone that allows notifications registers its Expo push token
-- (register_push_token). When something happens that a person should hear
-- about, a trigger calls private.push, which sends through Expo's push service
-- with pg_net. Sending runs after the change is saved and never blocks it.
-- Discreet notifications: the text is only "Intro: you have an update".
--
-- Who hears about what:
--   * asked if they're keen on a plan                 -> the person asked
--   * someone said yes                                 -> the person who set the plan
--   * a new chat message                               -> the other person
--   * a parent approved or turned down a plan          -> the teen
--   * a parent approved the account                    -> the teen
--   * parent alerts (plan to OK, met someone, meet-up, report) -> the parent
--
-- Also: a parent's approval now starts the matching straight away, instead of
-- waiting for the teen to open the app (private.run_matching).

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- Tokens
-- ---------------------------------------------------------------------

create table public.push_tokens (
  token      text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
-- No direct access. The app registers and removes its token through the two functions below.
revoke all on public.push_tokens from anon, authenticated;
grant all on public.push_tokens to service_role;

-- A phone's token belongs to whoever is signed in on it now.
create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid()
$$;

revoke all on function public.register_push_token(text, text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------

create function private.clip(t text, n int) returns text
language sql immutable as $$
  select case when t is null then null when char_length(t) > n then left(t, n - 1) || '…' else t end
$$;

create function private.first_name(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.first_name from public.profiles p where p.id = uid), 'Someone')
$$;

-- "Mum", "Dad" or "Your parent", for the parent who did something.
create function private.parent_label(p_teen uuid, p_guardian uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select case g.relationship when 'mum' then 'Mum' when 'dad' then 'Dad' else 'Your parent' end
                   from public.guardians g
                   where g.teen_id = p_teen and (p_guardian is null or g.guardian_id = p_guardian)
                   order by g.approved_at desc nulls last limit 1), 'Your parent')
$$;

-- Send one notification to every phone a person has signed in on. Never raises.
create function private.push(p_user uuid, p_title text, p_body text, p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  discreet boolean := coalesce((select p.discreet_notifications from public.profiles p where p.id = p_user), false);
  msgs jsonb;
begin
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'to', t.token,
           'title', case when discreet then null else private.clip(p_title, 60) end,
           'body', case when discreet then 'Intro: you have an update' else private.clip(p_body, 160) end,
           'data', jsonb_build_object('url', p_url),
           'sound', 'default',
           'priority', 'high')))
    into msgs
  from public.push_tokens t
  where t.user_id = p_user;
  if msgs is null then
    return;
  end if;
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := msgs,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'));
  exception when others then
    raise warning 'push to % not sent: %', p_user, sqlerrm;
  end;
end $$;

revoke all on function private.push(uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- What triggers a notification
-- ---------------------------------------------------------------------

-- Asked if they're keen.
create function private.push_on_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o record;
begin
  if new.status = 'asking' then
    select ob.owner_id, ob.text into o from public.objectives ob where ob.id = new.objective_id;
    perform private.push(new.candidate_id, private.first_name(o.owner_id) || ' asked if you''re keen', o.text, '/requests');
  end if;
  return null;
end $$;

create trigger push_on_request after insert on public.match_requests
for each row execute function private.push_on_request();

-- Someone said yes. People who pass stay anonymous, so a pass sends nothing.
create function private.push_on_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := (select ob.owner_id from public.objectives ob where ob.id = new.objective_id);
begin
  if old.status = 'asking' and new.status = 'agreed' then
    perform private.push(owner, private.first_name(new.candidate_id) || ' is keen', 'Said yes to your plan. Say hi in the chat.', '/matches');
  end if;
  return null;
end $$;

create trigger push_on_answer after update of status on public.match_requests
for each row when (old.status is distinct from new.status) execute function private.push_on_answer();

-- A chat message.
create function private.push_on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m record;
begin
  select * into m from private.match_people(new.match_request_id);
  perform private.push(case when new.sender_id = m.owner_id then m.candidate_id else m.owner_id end,
                       private.first_name(new.sender_id), new.body, '/chat/' || new.match_request_id);
  return null;
end $$;

create trigger push_on_message after insert on public.messages
for each row execute function private.push_on_message();

-- A parent decided on a teen's plan.
create function private.push_on_plan_decided() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' then
    perform private.push(new.owner_id, 'Your plan is approved', 'Intro is asking people now.', '/home');
  elsif new.status = 'rejected' then
    perform private.push(new.owner_id, 'Plan not approved',
                         private.parent_label(new.owner_id, new.decided_by) || ' turned down: ' || new.text, '/home');
  end if;
  return null;
end $$;

create trigger push_on_plan_decided after update of status on public.objectives
for each row when (old.status = 'pending_guardian' and new.status in ('active', 'rejected'))
execute function private.push_on_plan_decided();

-- A parent approved the teen's account.
create function private.push_on_account_approved() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.push(new.teen_id, 'You''re all set',
                       private.parent_label(new.teen_id, new.guardian_id) || ' approved your account. You can set your first plan.', '/home');
  return null;
end $$;

create trigger push_on_account_approved after update of status on public.guardians
for each row when (old.status = 'pending' and new.status = 'approved')
execute function private.push_on_account_approved();

-- Parent alerts. Parents never hear about chats.
create function private.push_on_guardian_alert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  teen text := private.first_name(new.teen_id);
  p jsonb := new.payload;
  title text;
  body text;
begin
  case new.kind
    when 'objective_pending' then
      title := teen || ' has a new plan';
      body := coalesce(p->>'text', 'A new plan') || '. Tap to approve or turn it down.';
    when 'connected' then
      title := teen || ' met ' || coalesce(p->>'with_first_name', 'someone');
      body := 'They connected in person' || coalesce(' near ' || nullif(p->>'suburb', ''), '') || '.';
    when 'meetup' then
      title := teen || ' is meeting ' || coalesce(p->>'with_first_name', 'someone');
      body := coalesce(p->>'place', 'Place not given')
              || coalesce(', ' || to_char((p->>'meet_at')::timestamptz at time zone 'Australia/Brisbane', 'FMDay FMHH12:MIam'), '');
    when 'report' then
      title := teen || ' ' || coalesce(p->>'role', 'was part of a report');
      body := 'Intro''s safety team will look at it.';
    else
      return null;
  end case;
  perform private.push(new.guardian_id, title, body, '/parent');
  return null;
end $$;

create trigger push_on_guardian_alert after insert on public.guardian_notifications
for each row execute function private.push_on_guardian_alert();

-- ---------------------------------------------------------------------
-- A parent's approval starts the matching
-- ---------------------------------------------------------------------

-- The matching itself, with no check on who is asking. Called by
-- find_matches (the owner) and by guardian_decide_objective (the parent).
create function private.run_matching(p_objective uuid) returns int
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

revoke all on function private.run_matching(uuid) from public, anon, authenticated;

create or replace function public.find_matches(p_objective uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := (select o.owner_id from public.objectives o where o.id = p_objective);
begin
  if owner is null then
    raise exception 'Objective not found' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and auth.uid() <> owner then
    raise exception 'Not your objective' using errcode = '42501';
  end if;
  return private.run_matching(p_objective);
end $$;

create or replace function public.guardian_decide_objective(p_objective uuid, p_approve boolean) returns text
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
  if p_approve then
    perform private.run_matching(o.id);
  end if;
  return case when p_approve then 'active' else 'rejected' end;
end $$;
