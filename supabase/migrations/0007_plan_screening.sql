-- Plan screening, before anyone is asked.
--
-- Plans that read as dating, put someone down or single someone out are
-- refused. For 16 and 17 year olds, so are alcohol, vapes and drugs, and
-- meeting at someone's home. Same lists as app/src/lib/planScreen.ts and the
-- mock-up; app/src/lib/planScreen.fixtures.json holds the phrases all three
-- must agree on (checked live by app/scripts/live-plan-screen.mjs).

create function private.plan_issue(t text, minor boolean) returns text
language sql immutable as $$
  select case
    when t ~* '\y(dating|date night|(go|going|looking for|find me) (on )?a date|hook ?ups?|sexy|sex|nudes?|flirt(ing|y)?|girlfriend|boyfriend)\y' then 'dating'
    when t ~* '\y(losers?|ugly|weirdos?|freaks?|retard(s|ed)?|idiots?|stupid|dumb|laugh at|make fun of|pranks?|pranking|bully|bullies|bullying|beat (him|her|them|someone) up|get back at|teach (him|her|them) a lesson)\y' then 'mocking'
    when t ~* '\y(the new (kid|girl|guy|boy)|from (my|our) (school|class|year|grade|work|office)|who (goes to|works at|lives (in|at|on))|lives at|(his|her|their) address)\y' then 'targeting'
    when minor and t ~* '\y(alcohol|beers?|wine|vodka|booze|drunk|drinking|vapes?|vaping|weed|drugs?)\y' then 'substances'
    when minor and t ~* '\y(my (place|house|home|room)|(your|ur) (place|house)|come over|sleep ?overs?)\y' then 'private_place'
  end
$$;

create function private.plan_issue_message(k text) returns text
language sql immutable as $$
  select case k
    when 'dating' then 'Intro is for plans with people, not dating. Change the wording and try again.'
    when 'mocking' then 'Plans can''t put anyone down. Change the wording and try again.'
    when 'targeting' then 'Plans can''t single anyone out. Intro picks who''s asked.'
    when 'substances' then 'Plans for 16 and 17 year olds can''t involve alcohol, vapes or drugs.'
    when 'private_place' then 'Plans for 16 and 17 year olds are in public places, not someone''s home.'
  end
$$;

-- Same as before, plus the screening check after the contact-details check.
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

revoke all on function private.plan_issue(text, boolean), private.plan_issue_message(text) from public, anon;
