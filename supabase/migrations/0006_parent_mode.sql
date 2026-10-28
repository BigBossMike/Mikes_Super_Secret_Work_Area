-- Parent mode, in the same app.
--
-- A parent signs in with the mobile number their teen entered. They see the
-- invite (my_parent_invites), approve it (claim_guardian_invite, already there)
-- or say it isn't them (decline_parent_invite). Once linked they see the
-- parent screen: plans waiting for their OK, activity, meet-ups and the
-- controls. They can pause the teen's account (guardian_set_paused). They never
-- see chats.

-- Is this invite addressed to the mobile number I signed in with? Same check as claim_guardian_invite.
create function private.invite_is_mine(p_invite_phone text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') <> ''
            and right(regexp_replace(p_invite_phone, '\D', '', 'g'), 9) = right(regexp_replace(u.phone, '\D', '', 'g'), 9)
     from auth.users u where u.id = auth.uid()),
    false)
$$;

-- Invites waiting for me.
create function public.my_parent_invites()
returns table (invite_id uuid, teen_first_name text, teen_age int, relationship text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, p.first_name, private.age_years(p.date_of_birth), g.relationship, g.created_at
  from public.guardians g
  join public.profiles p on p.id = g.teen_id
  where g.status = 'pending' and g.teen_id <> auth.uid() and private.invite_is_mine(g.invite_phone)
  order by g.created_at desc
$$;

-- "This isn't me" or "I'm not approving this". The teen can send a new invite.
create function public.decline_parent_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.guardians g set status = 'revoked'
   where g.id = p_invite and g.status = 'pending' and g.teen_id <> auth.uid()
     and private.invite_is_mine(g.invite_phone);
  if not found then
    raise exception 'Invite not found, or it was sent to a different mobile number' using errcode = 'P0002';
  end if;
end $$;

-- A parent pauses (or turns back on) their teen's account.
create function public.guardian_set_paused(p_teen uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_guardian_of(auth.uid(), p_teen) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  update public.profiles set can_be_put_forward = not p_paused where id = p_teen;
end $$;

revoke all on function public.my_parent_invites(), public.decline_parent_invite(uuid), public.guardian_set_paused(uuid, boolean) from public, anon;
grant execute on function public.my_parent_invites(), public.decline_parent_invite(uuid), public.guardian_set_paused(uuid, boolean) to authenticated;
revoke all on function private.invite_is_mine(text) from public, anon;

-- The teen hears when a parent declines, so they can check the number and send again.
create function private.push_on_invite_declined() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.push(new.teen_id, 'Parent sign-off not done',
                       'The person at ' || new.invite_phone || ' didn''t approve. Check the number and send it again.', '/home');
  return null;
end $$;

create trigger push_on_invite_declined after update of status on public.guardians
for each row when (old.status = 'pending' and new.status = 'revoked')
execute function private.push_on_invite_declined();

-- Parent alerts now open the parent screen.
create or replace function private.push_on_guardian_alert() returns trigger
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
  perform private.push(new.guardian_id, title, body, '/parent-home');
  return null;
end $$;
