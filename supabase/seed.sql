-- Fictional Brisbane test users for a local or test project. NOT for the live app.
-- Ages are worked out from today's date, so they stay right over time.
-- Phone numbers are from the 0491 570 xxx range reserved for fiction.
--
-- IDs follow a pattern so they're easy to spot in tests:
--   ...0001 to ...0099   16 and 17 year olds
--   ...0100 to ...0199   adults
--   ...0900 and up       parents (sign-in accounts only, no profile)

insert into auth.users (id, aud, role, email, phone) values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'alex@example.com',   '61491570101'),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'jordan@example.com', '61491570102'),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'priya@example.com',  '61491570103'),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'tom@example.com',    '61491570104'),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'mia@example.com',    '61491570105'),
  ('00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'lachie@example.com', '61491570106'),
  ('00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'ava@example.com',    '61491570107'),
  ('00000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'kai@example.com',    '61491570108'),
  ('00000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'sam@example.com',    '61491570109'),
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'ben@example.com',    '61491570121'),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'chloe@example.com',  '61491570122'),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'noah@example.com',   '61491570123'),
  ('00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'grace@example.com',  '61491570124'),
  ('00000000-0000-4000-8000-000000000105', 'authenticated', 'authenticated', 'zoe@example.com',    '61491570125'),
  ('00000000-0000-4000-8000-000000000106', 'authenticated', 'authenticated', 'ethan@example.com',  '61491570126'),
  ('00000000-0000-4000-8000-000000000901', 'authenticated', 'authenticated', 'chris@example.com',  '61491570157'),
  ('00000000-0000-4000-8000-000000000902', 'authenticated', 'authenticated', 'pat@example.com',    '61491570158');

insert into public.profiles (id, first_name, suburb, interests, free_times, school, keep_school_out, date_of_birth, verified_at) values
  ('00000000-0000-4000-8000-000000000001', 'Alex',   'Paddington',    '{Football,Music,Movies}',        '{Saturdays,Weeknights}',        'Example State High',   true,  current_date - interval '17 years 3 months', now()),
  ('00000000-0000-4000-8000-000000000002', 'Jordan', 'Toowong',       '{Football,Music,Dance,Movies}',  '{Weeknights,Saturdays}',        'Riverside College',    true,  current_date - interval '17 years 1 month',  now()),
  ('00000000-0000-4000-8000-000000000003', 'Priya',  'Indooroopilly', '{Study,Movies,Running,Music}',   '{Weeknights,Sundays}',          null,                   false, current_date - interval '16 years 6 months', now()),
  ('00000000-0000-4000-8000-000000000004', 'Tom',    'New Farm',      '{Football,Gym,Gaming}',          '{"Tuesday nights",Saturdays}',  'Example State High',   false, current_date - interval '17 years 8 months', now()),
  ('00000000-0000-4000-8000-000000000005', 'Mia',    'Kelvin Grove',  '{Dance,Music,Movies,Art}',       '{Saturdays}',                   null,                   true,  current_date - interval '16 years 2 months', now()),
  ('00000000-0000-4000-8000-000000000006', 'Lachie', 'Spring Hill',   '{Football,Cricket,Gaming}',      '{"Tuesday nights",Sundays}',    'Hillside Grammar',     true,  current_date - interval '17 years 5 months', now()),
  ('00000000-0000-4000-8000-000000000007', 'Ava',    'Toowong',       '{Art,Movies,Study}',             '{Weeknights}',                  null,                   true,  current_date - interval '17 years',          now()),
  ('00000000-0000-4000-8000-000000000008', 'Kai',    'Paddington',    '{Football,Gym,Music}',           '{Saturdays,"Tuesday nights"}',  'Hillside Grammar',     true,  current_date - interval '16 years 9 months', now()),
  ('00000000-0000-4000-8000-000000000009', 'Sam',    'Paddington',    '{Movies,Music,Art}',             '{Saturdays}',                   null,                   true,  current_date - interval '17 years 2 months', now()),
  ('00000000-0000-4000-8000-000000000101', 'Ben',    'Paddington',    '{Football,Gym,Music}',           '{"Tuesday nights"}',            null,                   true,  current_date - interval '22 years',          now()),
  ('00000000-0000-4000-8000-000000000102', 'Chloe',  'New Farm',      '{Movies,Music,Dance}',           '{Saturdays}',                   null,                   true,  current_date - interval '24 years',          now()),
  ('00000000-0000-4000-8000-000000000103', 'Noah',   'Kelvin Grove',  '{Football,Gaming,Study}',        '{Weeknights}',                  null,                   true,  current_date - interval '19 years',          now()),
  ('00000000-0000-4000-8000-000000000104', 'Grace',  'Spring Hill',   '{Study,Running,Movies}',         '{Sundays}',                     null,                   true,  current_date - interval '20 years',          now()),
  ('00000000-0000-4000-8000-000000000105', 'Zoe',    'Indooroopilly', '{Dance,Music,Art}',              '{Saturdays}',                   null,                   true,  current_date - interval '18 years 2 months', now()),
  ('00000000-0000-4000-8000-000000000106', 'Ethan',  'Toowong',       '{Cricket,Gym,Movies}',           '{"Tuesday nights"}',            null,                   true,  current_date - interval '26 years',          now());

insert into public.private_contacts (id, full_name, mobile, instagram) values
  ('00000000-0000-4000-8000-000000000001', 'Alex Example',  '0491 570 101', '@alex.example'),
  ('00000000-0000-4000-8000-000000000002', 'Jordan Lee',    '0491 570 102', '@jordan.lee.example'),
  ('00000000-0000-4000-8000-000000000003', 'Priya Nair',    '0491 570 103', null),
  ('00000000-0000-4000-8000-000000000004', 'Tom Walsh',     '0491 570 104', '@tom.walsh.example'),
  ('00000000-0000-4000-8000-000000000101', 'Ben Hart',      '0491 570 121', null);

-- Parents. Alex's dad Chris has approved; Kai's invite is still pending,
-- so Kai can't use Intro (or be matched) yet. Every other teen gets a
-- pre-approved test parent (Pat) so they can be matched.
insert into public.guardians (teen_id, guardian_id, relationship, invite_phone, status, approved_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000901', 'dad', '0491 570 157', 'approved', now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000902', 'parent', '0491 570 158', 'approved', now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000902', 'parent', '0491 570 158', 'approved', now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000902', 'parent', '0491 570 158', 'approved', now()),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000902', 'parent', '0491 570 158', 'approved', now()),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000902', 'parent', '0491 570 158', 'approved', now()),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000902', 'parent', '0491 570 158', 'approved', now()),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000902', 'parent', '0491 570 158', 'approved', now());
insert into public.guardians (teen_id, relationship, invite_phone, status) values
  ('00000000-0000-4000-8000-000000000008', 'mum', '0491 570 159', 'pending');
