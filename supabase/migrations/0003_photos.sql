-- Profile photos.
--
-- Photos live in a private Storage bucket called "photos". profiles.photo_url
-- holds the object's path inside the bucket ("<user id>/<random>.jpg"), never a
-- public link. The app asks Storage for a short-lived signed URL when it needs
-- to show one. Who may read a photo follows who may see the person's card
-- (private.can_see_card): the person, people they've agreed to talk to, people
-- who were asked about their plan, people they've met, and a teen's parent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- The folder a photo sits in is the owner's user id. Null if the path isn't shaped like that.
create function private.photo_owner(object_name text) returns uuid
language sql immutable as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(object_name))[1]::uuid
  end
$$;
grant execute on function private.photo_owner(text) to authenticated, service_role;

create policy "photos: add my own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.photo_owner(name) = (select auth.uid()));

create policy "photos: replace my own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and private.photo_owner(name) = (select auth.uid()))
  with check (bucket_id = 'photos' and private.photo_owner(name) = (select auth.uid()));

create policy "photos: remove my own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and private.photo_owner(name) = (select auth.uid()));

create policy "photos: see who I may see" on storage.objects for select to authenticated
  using (bucket_id = 'photos'
         and private.photo_owner(name) is not null
         and private.can_see_card((select auth.uid()), private.photo_owner(name)));

-- A profile may only point at a photo in its own folder.
create or replace function private.profiles_guard() returns trigger
language plpgsql as $$
begin
  if private.age_years(new.date_of_birth) < 16 then
    raise exception 'Intro is for people aged 16 and over' using errcode = 'P0001';
  end if;
  if new.school is not null then new.school := nullif(trim(new.school), ''); end if;
  if new.workplace is not null then new.workplace := nullif(trim(new.workplace), ''); end if;
  if new.photo_url is not null
     and new.photo_url !~ ('^' || new.id::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$') then
    raise exception 'photo_path_invalid' using errcode = 'P0001',
      hint = 'A profile photo must be a file in your own folder of the photos bucket.';
  end if;
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
