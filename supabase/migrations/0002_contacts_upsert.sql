-- The app saves contact details with an upsert (insert, or update the row if it exists).
-- An upsert updates every column it was given, including id, so the update grant needs id too.
-- Row security still holds: a person can only ever update their own row, and id must stay their own.
grant update (id, full_name, mobile, instagram) on public.private_contacts to authenticated;
