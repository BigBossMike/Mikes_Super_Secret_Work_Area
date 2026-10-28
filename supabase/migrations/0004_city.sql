-- One city, no suburbs.
--
-- Matching is city-wide ("close enough, not next door"), so the app no longer
-- asks for a suburb and distance plays no part in who is put forward.
-- profiles.suburb keeps its name and holds the city, 'Brisbane' for now. The
-- suburbs table becomes the list of places Intro knows; the connect function
-- still records the nearest row to where two people met, never the exact spot.

insert into public.suburbs (name, lat, lng) values ('Brisbane', -27.4698, 153.0251)
on conflict (name) do nothing;

alter table public.profiles alter column suburb set default 'Brisbane';

-- Same as before minus distance: no km term in the score, no "km apart" reason, no 25 km cap.
create or replace function private.score_candidates(p_objective uuid)
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
         least(97, 62 + cardinality(c.fit) * 14 + cardinality(c.shared) * 9 + cardinality(c.times) * 6
                   - least(20, c.age_gap)),
         array_remove(array[
           case when cardinality(c.shared) > 0 then 'Both into ' || lower(c.shared[1])
                when cardinality(c.fit) > 0 then 'Into ' || lower(c.fit[1]) end,
           case when cardinality(c.shared) > 1 then cardinality(c.shared) || ' shared interests' end,
           case when cardinality(c.times) > 0 then 'Both free ' || c.times[1] end], null)
  from c
$$;
