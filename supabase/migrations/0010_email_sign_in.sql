-- Sign in by email code (decided 30th October 2026), not SMS.
--
-- Parent invites now go to the parent's email: the teen enters it, the parent
-- signs in with that email and sees the invite. Invites to a mobile number
-- (the test people) still work. The mobile number moves to the person's own
-- contact details (private_contacts), where "hide me from my contacts" already
-- looks for it.

alter table public.guardians alter column invite_phone drop not null;
alter table public.guardians add column invite_email text check (invite_email is null or invite_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.guardians add constraint invite_has_address check (invite_phone is not null or invite_email is not null);
grant insert (invite_email) on public.guardians to authenticated;

-- Is this invite addressed to me: my confirmed sign-in email, or my sign-in mobile?
create function private.invite_is_mine(p_invite_phone text, p_invite_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (p_invite_email is not null and u.email is not null and u.email_confirmed_at is not null
            and lower(trim(p_invite_email)) = lower(u.email))
        or (p_invite_phone is not null and regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') <> ''
            and right(regexp_replace(p_invite_phone, '\D', '', 'g'), 9) = right(regexp_replace(u.phone, '\D', '', 'g'), 9))
    from auth.users u where u.id = auth.uid()), false)
$$;
revoke all on function private.invite_is_mine(text, text) from public, anon;

create or replace function public.my_parent_invites()
returns table (invite_id uuid, teen_first_name text, teen_age int, relationship text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, p.first_name, private.age_years(p.date_of_birth), g.relationship, g.created_at
  from public.guardians g
  join public.profiles p on p.id = g.teen_id
  where g.status = 'pending' and g.teen_id <> auth.uid() and private.invite_is_mine(g.invite_phone, g.invite_email)
  order by g.created_at desc
$$;

create or replace function public.decline_parent_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.guardians g set status = 'revoked'
   where g.id = p_invite and g.status = 'pending' and g.teen_id <> auth.uid()
     and private.invite_is_mine(g.invite_phone, g.invite_email);
  if not found then
    raise exception 'Invite not found, or it was sent to a different email' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.claim_guardian_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.guardians g
     set guardian_id = auth.uid(), status = 'approved', approved_at = now()
   where g.id = p_invite and g.status = 'pending' and g.teen_id <> auth.uid()
     and private.invite_is_mine(g.invite_phone, g.invite_email);
  if not found then
    raise exception 'Invite not found, or it was sent to a different email' using errcode = 'P0002';
  end if;
end $$;

drop function private.invite_is_mine(text);

create or replace function private.push_on_invite_declined() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.push(new.teen_id, 'Parent sign-off not done',
                       coalesce(new.invite_email, new.invite_phone) || ' didn''t approve. Check it and send it again.', '/home');
  return null;
end $$;

-- Deleted-account fingerprint: the sign-in mobile if there is one, else the mobile on the profile, else the email.
create or replace function private.user_phone_hash(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when private.normalise_phone(u.phone) is not null then private.phone_hash(u.phone) end from auth.users u where u.id = uid),
    (select c.mobile_hash from public.private_contacts c where c.id = uid),
    (select encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex') from auth.users u where u.id = uid and u.email is not null))
$$;
