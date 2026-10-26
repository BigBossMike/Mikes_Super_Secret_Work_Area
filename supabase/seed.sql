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
  ('00000000-0000-4000-8000-000000000107', 'authenticated', 'authenticated', 'margaret@example.com', '61491570130'),
  ('00000000-0000-4000-8000-000000000108', 'authenticated', 'authenticated', 'dave@example.com',     '61491570131'),
  ('00000000-0000-4000-8000-000000000109', 'authenticated', 'authenticated', 'linda@example.com',    '61491570132'),
  ('00000000-0000-4000-8000-000000000110', 'authenticated', 'authenticated', 'helen@example.com',    '61491570133'),
  ('00000000-0000-4000-8000-000000000111', 'authenticated', 'authenticated', 'gary@example.com',     '61491570134'),
  ('00000000-0000-4000-8000-000000000112', 'authenticated', 'authenticated', 'pete@example.com',     '61491570135'),
  ('00000000-0000-4000-8000-000000000113', 'authenticated', 'authenticated', 'tony@example.com',     '61491570136'),
  ('00000000-0000-4000-8000-000000000114', 'authenticated', 'authenticated', 'sue@example.com',      '61491570137'),
  ('00000000-0000-4000-8000-000000000115', 'authenticated', 'authenticated', 'rob@example.com',      '61491570138'),
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

-- Older adults, to test age ranges, hidden contacts and workplaces.
--   Margaret 55: default range 45-65. Works at Example Hospital (keep out on).
--   Dave 48: in range, but in Margaret's hidden contacts.
--   Linda 62: in range, but has Margaret in HER hidden contacts.
--   Helen 50: custom range 50-60. Has Margaret in her list but hiding is OFF.
--   Gary 58: custom range 40-56 (Margaret 55 fits).
--   Pete 60: custom range 60-70 (Margaret 55 does NOT fit, so not mutual).
--   Tony 52: same workplace as Margaret.
--   Sue 44 and Rob 70: outside Margaret's range.
insert into public.profiles (id, first_name, suburb, interests, free_times, workplace, keep_workplace_out,
                             match_age_min, match_age_max, hide_contacts, date_of_birth, verified_at) values
  ('00000000-0000-4000-8000-000000000107', 'Margaret', 'Paddington',  '{Walking,Trivia,Food}', '{Weeknights,Saturdays}', 'Example Hospital', true,  null, null, true,  current_date - interval '55 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000108', 'Dave',     'Red Hill',    '{Walking,Food}',        '{Saturdays}',            null,               true,  null, null, true,  current_date - interval '48 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000109', 'Linda',    'Ashgrove',    '{Trivia,Food}',         '{Weeknights}',           null,               true,  null, null, true,  current_date - interval '62 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000110', 'Helen',    'Bardon',      '{Walking,Trivia}',      '{Saturdays}',            null,               true,  50,   60,   false, current_date - interval '50 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000111', 'Gary',     'Spring Hill', '{Food,Trivia}',         '{Weeknights}',           null,               true,  40,   56,   true,  current_date - interval '58 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000112', 'Pete',     'New Farm',    '{Walking,Food,Trivia}', '{Weeknights,Saturdays}', null,               true,  60,   70,   true,  current_date - interval '60 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000113', 'Tony',     'Paddington',  '{Walking,Trivia,Food}', '{Weeknights,Saturdays}', 'example hospital', false, null, null, true,  current_date - interval '52 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000114', 'Sue',      'Paddington',  '{Walking,Trivia,Food}', '{Weeknights,Saturdays}', null,               true,  null, null, true,  current_date - interval '44 years 1 month', now()),
  ('00000000-0000-4000-8000-000000000115', 'Rob',      'Paddington',  '{Walking,Trivia,Food}', '{Weeknights,Saturdays}', null,               true,  null, null, true,  current_date - interval '70 years 1 month', now());

insert into public.private_contacts (id, full_name, mobile, instagram) values
  ('00000000-0000-4000-8000-000000000001', 'Alex Example',  '0491 570 101', '@alex.example'),
  ('00000000-0000-4000-8000-000000000002', 'Jordan Lee',    '0491 570 102', '@jordan.lee.example'),
  ('00000000-0000-4000-8000-000000000003', 'Priya Nair',    '0491 570 103', null),
  ('00000000-0000-4000-8000-000000000004', 'Tom Walsh',     '0491 570 104', '@tom.walsh.example'),
  ('00000000-0000-4000-8000-000000000101', 'Ben Hart',      '0491 570 121', null),
  ('00000000-0000-4000-8000-000000000107', 'Margaret Example', '0491 570 130', null),
  ('00000000-0000-4000-8000-000000000108', 'Dave Example',     '+61 491 570 131', null),
  ('00000000-0000-4000-8000-000000000109', 'Linda Example',    '0491 570 132', null),
  ('00000000-0000-4000-8000-000000000110', 'Helen Example',    '0491 570 133', null);

-- Hidden contacts, as the app would upload them:
-- lowercase hex SHA-256 of the E.164 number, e.g. sha256('+61491570131').
insert into public.hidden_contacts (owner_id, phone_hash) values
  ('00000000-0000-4000-8000-000000000107', encode(sha256('+61491570131'::bytea), 'hex')),  -- Margaret hides from Dave
  ('00000000-0000-4000-8000-000000000109', encode(sha256('+61491570130'::bytea), 'hex')),  -- Linda hides from Margaret
  ('00000000-0000-4000-8000-000000000110', encode(sha256('+61491570130'::bytea), 'hex'));  -- Helen lists Margaret, but hiding is off

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
