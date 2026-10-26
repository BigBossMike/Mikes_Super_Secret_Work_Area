-- LOCAL TESTING ONLY. Run after local_stub.sql, the migration and seed.sql:
--   psql -d intro_test -v ON_ERROR_STOP=1 -f supabase/tests/run_tests.sql
-- Every check prints "PASS: ..." or stops with "FAIL: ...".

\set ON_ERROR_STOP 1
set client_min_messages = notice;

create schema test;
create table test.ctx (k text primary key, v uuid);
create function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
-- Runs a statement that should fail with an error containing `expect`.
create function test.fails(stmt text, expect text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm ilike '%' || expect || '%' then raise notice 'PASS: %', msg; return; end if;
    raise exception 'FAIL: % (got error: %)', msg, sqlerrm;
  end;
  raise exception 'FAIL: % (no error)', msg;
end $$;
create function test.get(key text) returns uuid language sql as $$ select v from test.ctx where k = key $$;
grant usage on schema test to anon, authenticated, service_role;
grant all on test.ctx to authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;

\set ALEX   '00000000-0000-4000-8000-000000000001'
\set JORDAN '00000000-0000-4000-8000-000000000002'
\set PRIYA  '00000000-0000-4000-8000-000000000003'
\set TOM    '00000000-0000-4000-8000-000000000004'
\set KAI    '00000000-0000-4000-8000-000000000008'
\set BEN    '00000000-0000-4000-8000-000000000101'
\set CHRIS  '00000000-0000-4000-8000-000000000901'
\set NOAH     '00000000-0000-4000-8000-000000000103'
\set MARGARET '00000000-0000-4000-8000-000000000107'
\set DAVE     '00000000-0000-4000-8000-000000000108'
\set LINDA    '00000000-0000-4000-8000-000000000109'
\set HELEN    '00000000-0000-4000-8000-000000000110'
\set GARY     '00000000-0000-4000-8000-000000000111'
\set PETE     '00000000-0000-4000-8000-000000000112'
\set TONY     '00000000-0000-4000-8000-000000000113'
\set SUE      '00000000-0000-4000-8000-000000000114'
\set ROB      '00000000-0000-4000-8000-000000000115'
\set PAT    '00000000-0000-4000-8000-000000000902'

\set as_alex   'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}'', true); set local role authenticated;'
\set as_jordan 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}'', true); set local role authenticated;'
\set as_priya  'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}'', true); set local role authenticated;'
\set as_kai    'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000008","role":"authenticated"}'', true); set local role authenticated;'
\set as_ben    'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}'', true); set local role authenticated;'
\set as_chris  'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}'', true); set local role authenticated;'
\set as_pat    'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated"}'', true); set local role authenticated;'
\set as_margaret 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000107","role":"authenticated"}'', true); set local role authenticated;'
\set as_kaimum 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-000000000903","role":"authenticated"}'', true); set local role authenticated;'
\set as_server 'select set_config(''request.jwt.claims'', ''{"role":"service_role"}'', true); set local role service_role;'

\echo '--- Sign-up rules'
insert into auth.users (id, phone) values ('00000000-0000-4000-8000-000000000050', '61491570150');
select test.fails($$insert into public.profiles (id, first_name, suburb, date_of_birth)
  values ('00000000-0000-4000-8000-000000000050', 'Young', 'Paddington', current_date - interval '15 years')$$,
  '16 and over', 'Under-16s cannot create a profile');

begin; :as_alex
select test.fails($$update public.profiles set verified_at = now() where id = auth.uid()$$, 'permission denied', 'Users cannot mark themselves ID-verified');
select test.fails($$update public.profiles set date_of_birth = '2000-01-01' where id = auth.uid()$$, 'permission denied', 'Users cannot change their date of birth');
update public.guardians set approve_objectives = false where teen_id = auth.uid();
commit;
select test.ok((select approve_objectives from public.guardians where teen_id = :'ALEX'), 'A teen cannot switch off their own parent controls');

begin; :as_kai
select test.fails($$insert into public.objectives (type, text) values ('sport', 'A fifth player for five-a-side')$$,
  'parent sign-off', 'A teen whose parent has not approved cannot post an objective');
commit;

\echo '--- Parent invite'
insert into auth.users (id, phone) values ('00000000-0000-4000-8000-000000000903', '61491570159'),
                                          ('00000000-0000-4000-8000-000000000904', '61491570199');
insert into test.ctx select 'kai_invite', id from public.guardians where teen_id = :'KAI';
begin; select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000904","role":"authenticated"}', true); set local role authenticated;
select test.fails($$select public.claim_guardian_invite(test.get('kai_invite'))$$, 'different mobile', 'A stranger with a different mobile cannot claim a parent invite');
commit;
begin; :as_kaimum
select public.claim_guardian_invite(test.get('kai_invite'));
commit;
select test.ok((select status = 'approved' from public.guardians where teen_id = :'KAI'), 'The parent with the invited mobile can claim it');

\echo '--- Objective with parent approval'
begin; :as_alex
insert into public.objectives (type, text, when_text, where_text, group_size)
  values ('sport', 'A fifth player for our Tuesday night five-a-side team', 'Tuesdays, 7pm', 'Toowong Sports Centre', 4);
insert into test.ctx select 'alex_obj', id from public.objectives where owner_id = auth.uid();
select test.ok((select status from public.objectives where id = test.get('alex_obj')) = 'pending_guardian', 'Under-18 objective waits for a parent');
select test.fails($$select public.find_matches(test.get('alex_obj'))$$, 'isn''t active', 'Matching does not start before the parent OKs it');
select test.fails($$insert into public.objectives (type, text) values ('movie', 'Text me on 0491 570 101 for movies')$$,
  'contact_details_locked', 'Objectives cannot contain contact details');
commit;
select test.ok((select count(*) = 1 from public.guardian_notifications where guardian_id = :'CHRIS' and kind = 'objective_pending'), 'Parent is notified about the pending objective');

begin; :as_pat
select test.fails($$select public.guardian_decide_objective(test.get('alex_obj'), true)$$, 'not found', 'Another teen''s parent cannot approve it');
commit;
begin; :as_chris
select test.ok(public.guardian_decide_objective(test.get('alex_obj'), true) = 'active', 'Alex''s dad approves the objective');
commit;

\echo '--- Matching'
begin; :as_alex
select test.ok(public.find_matches(test.get('alex_obj')) between 1 and 5, 'find_matches asks between 1 and 5 people');
select test.ok((select count(*) = 0 from public.match_requests), 'Requester cannot read the match_requests table directly');
select test.ok((select bool_and(candidate_id is null and first_name is null) from public.my_matches(test.get('alex_obj'))),
  'Requester sees no names while people are still deciding');
commit;

select test.ok((select bool_and(private.age_years(p.date_of_birth) between 16 and 17)
                from public.match_requests mr join public.profiles p on p.id = mr.candidate_id
                where mr.objective_id = test.get('alex_obj')), 'A 17-year-old is only matched with 16 and 17 year olds');
select test.ok(not exists (select 1 from public.match_requests where objective_id = test.get('alex_obj') and candidate_id = :'TOM'),
  'Keep-my-school-out: Tom (same school) is never asked');
select test.ok(not exists (select 1 from public.match_requests where objective_id = test.get('alex_obj') and candidate_id = :'KAI') or
               exists (select 1 from public.guardians where teen_id = :'KAI' and status = 'approved'),
  'Teens without an approved parent are never asked');
select test.ok(exists (select 1 from public.match_requests where objective_id = test.get('alex_obj') and candidate_id = :'JORDAN'),
  'Jordan (football, nearby, free weeknights) is asked');
insert into test.ctx select 'alex_jordan', id from public.match_requests where objective_id = test.get('alex_obj') and candidate_id = :'JORDAN';

begin; :as_alex
select test.ok((select count(*) = 0 from public.profile_card(:'JORDAN')), 'Requester cannot see Jordan''s card before Jordan agrees');
select test.ok((select count(*) = 0 from public.private_contacts where id = :'JORDAN'), 'Requester cannot read Jordan''s contact details');
commit;

\echo '--- Being put forward'
begin; :as_jordan
select test.ok((select count(*) = 1 from public.my_requests() where requester_id = :'ALEX' and group_size = 4),
  'Jordan sees Alex''s request, including who''ll be there');
select test.ok((select first_name = 'Alex' from public.profile_card(:'ALEX')), 'Jordan can see Alex''s card to decide');
select test.ok(public.respond_to_request(test.get('alex_jordan'), true) = 'agreed', 'Jordan says yes');
select test.fails($$select public.respond_to_request(test.get('alex_jordan'), false)$$, 'already answered', 'An answer cannot be changed afterwards');
commit;

-- Someone else passes, and stays anonymous.
update public.match_requests set status = 'passed'
where id = (select id from public.match_requests where objective_id = test.get('alex_obj') and status = 'asking' limit 1);

begin; :as_alex
select test.ok((select first_name = 'Jordan' from public.my_matches(test.get('alex_obj')) where status = 'agreed'), 'Requester sees Jordan once Jordan agrees');
select test.ok((select bool_and(candidate_id is null) from public.my_matches(test.get('alex_obj')) where status = 'passed'),
  'People who pass stay anonymous');
select test.ok((select first_name = 'Jordan' from public.profile_card(:'JORDAN')), 'Requester can now see Jordan''s card');
commit;

\echo '--- Locked chat'
begin; :as_alex
insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'Hey! Want to come to training Thursday?');
select test.fails($$insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'call me on 0491 570 101')$$, 'contact_details_locked', 'Phone numbers are blocked');
select test.fails($$insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'add my insta')$$, 'contact_details_locked', 'Social app names are blocked');
select test.fails($$insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'I''m @alex.example')$$, 'contact_details_locked', 'Handles are blocked');
select test.fails($$insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'alex@example.com')$$, 'contact_details_locked', 'Emails are blocked');
select test.fails($$insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'see www.example.com')$$, 'contact_details_locked', 'Links are blocked');
select test.fails($$insert into public.messages (match_request_id, sender_id, body) values (test.get('alex_jordan'), '00000000-0000-4000-8000-000000000002', 'pretending to be Jordan')$$,
  'row-level security', 'You cannot send a message as someone else');
commit;
begin; :as_jordan
select test.ok((select count(*) = 1 from public.messages where match_request_id = test.get('alex_jordan')), 'Jordan can read the chat');
commit;
begin; :as_priya
select test.ok((select count(*) = 0 from public.messages), 'Outsiders cannot read the chat');
commit;

\echo '--- Parent view'
begin; :as_chris
select test.ok((select count(*) = 0 from public.messages), 'Parents can never read chats');
select test.ok((select count(*) >= 2 from public.guardian_activity(:'ALEX')), 'Parent sees their teen''s activity');
select test.ok((select count(*) = 0 from public.guardian_activity(:'JORDAN')), 'Parent cannot see another teen''s activity');
select test.ok((select first_name = 'Jordan' from public.profile_card(:'JORDAN')), 'Parent can see who their teen matched with');
commit;

\echo '--- In-person connection'
begin; :as_alex
select test.fails($$select public.complete_connection(test.get('alex_jordan'), 'ble', 'Toowong')$$, 'permission denied', 'The app cannot mark itself connected');
commit;
begin; :as_server
select test.ok(public.complete_connection(test.get('alex_jordan'), 'ble', 'Toowong') is not null, 'Server records the connection');
select test.ok(public.complete_connection(test.get('alex_jordan'), 'ble', 'Toowong') is not null, 'Recording it twice is harmless');
commit;
select test.ok((select count(*) = 1 from public.connections), 'Exactly one connection row');
select test.ok((select status = 'done' from public.objectives where id = test.get('alex_obj')), 'Objective is marked done');
select test.ok((select count(*) = 1 from public.guardian_notifications where guardian_id = :'CHRIS' and kind = 'connected'), 'Alex''s dad is told about the meet-up');
begin; :as_alex
select test.ok((select mobile = '0491 570 102' from public.private_contacts where id = :'JORDAN'), 'Contact details unlock after meeting');
insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'my number is 0491 570 101');
select test.ok(true, 'Contact details can be sent in chat after meeting');
select test.ok((select count(*) = 0 from public.private_contacts where id = :'PRIYA'), 'Contact details of people you have not met stay locked');
commit;

\echo '--- Plan limits'
begin; :as_alex
select test.fails($$insert into public.objectives (type, text) values ('movie', 'Someone to see a movie with on Saturday')$$,
  'objective_limit_reached', 'Free plan: only 1 objective a month');
commit;
insert into public.objective_credits (user_id, balance) values (:'ALEX', 1);
begin; :as_alex
insert into public.objectives (type, text) values ('movie', 'Someone to see a movie with on Saturday');
insert into test.ctx select 'alex_obj2', id from public.objectives where owner_id = auth.uid() and type = 'movie';
select test.ok((select remaining = 0 and extra_credits = 0 from public.objective_allowance()), 'A $5 credit is used for the second objective');
commit;
begin; :as_chris
select test.ok(public.guardian_decide_objective(test.get('alex_obj2'), false) = 'rejected', 'Parent turns down the second objective');
commit;
select test.ok((select balance = 1 from public.objective_credits where user_id = :'ALEX'), 'The credit is refunded when a parent says no');
insert into public.subscriptions (user_id, plan) values (:'ALEX', 'unlimited');
begin; :as_alex
select test.ok((select plan = 'unlimited' and remaining is null from public.objective_allowance()), 'Unlimited plan shows no limit');
commit;

\echo '--- Age ranges'
begin; :as_margaret
select test.fails($$update public.profiles set match_age_min = 16 where id = auth.uid()$$, '18 and over', 'Adults cannot set a minimum age under 18');
select test.fails($$update public.profiles set match_age_min = 50, match_age_max = 40 where id = auth.uid()$$, 'match_age_bounds', 'Minimum age cannot be above maximum age');
select test.fails($$update public.profiles set match_age_min = 30 where id = auth.uid()$$, 'at most 20 years', 'A 55-year-old cannot reach down to 30');
select test.fails($$update public.profiles set match_age_max = 80 where id = auth.uid()$$, 'at most 20 years', 'A 55-year-old cannot reach up to 80');
commit;
select test.ok((select lo = 35 and hi = 75 from private.age_range((select date_of_birth from public.profiles where id = :'MARGARET'), 1::smallint, 99::smallint)),
  'Stored values outside 20 years are clamped to 35-75 for a 55-year-old');
select test.ok((select lo = 18 and hi = 45 from private.age_range((current_date - interval '25 years 1 day')::date, 18::smallint, 60::smallint)),
  'A 25-year-old can go from 18 to at most 45');
begin; :as_alex
select test.fails($$update public.profiles set match_age_max = 25 where id = auth.uid()$$, '16 and 17', 'Teens cannot widen their age range beyond 16-17');
commit;
select test.ok((select lo = 45 and hi = 65 from private.age_range((select date_of_birth from public.profiles where id = :'MARGARET'), null, null)),
  'A 55-year-old''s default range is 45-65');
select test.ok((select lo = 18 and hi = 29 from private.age_range((select date_of_birth from public.profiles where id = :'NOAH'), null, null)),
  'A 19-year-old''s default range is 18-29 (never under 18)');

\echo '--- Hidden contacts and workplace'
begin; :as_margaret
select test.ok((select count(*) = 1 from public.hidden_contacts), 'Margaret can see her own hidden contacts list');
commit;
begin; :as_ben
select test.ok((select count(*) = 0 from public.hidden_contacts), 'Nobody else can read anyone''s hidden contacts');
select test.fails($$insert into public.hidden_contacts (owner_id, phone_hash) values ('00000000-0000-4000-8000-000000000107', repeat('a', 64))$$,
  'row-level security', 'Nobody can add to someone else''s hidden contacts');
commit;
begin; :as_chris
select test.ok((select count(*) = 0 from public.hidden_contacts), 'Parents cannot read hidden contacts either');
commit;
select test.ok((select mobile_e164 = '+61491570131' and mobile_hash = encode(sha256('+61491570131'::bytea), 'hex')
                from public.private_contacts where id = :'DAVE'), 'Mobiles are normalised to +61 form before hashing');
select test.ok((select mobile_e164 = '+61491570130' from public.private_contacts where id = :'MARGARET'), 'Local format 0491 570 130 normalises to +61491570130');
select test.fails($$insert into public.private_contacts (id, full_name, mobile) values ('00000000-0000-4000-8000-000000000114', 'Sue', '12345')$$,
  'mobile_recognised', 'Unrecognisable mobile numbers are rejected');

\echo '--- Matching a 55-year-old'
begin; :as_margaret
insert into public.objectives (type, text) values ('trivia', 'A fifth person for our Thursday pub trivia team');
select public.find_matches((select id from public.objectives where owner_id = auth.uid()));
commit;
create view test.margaret_asked as
  select mr.candidate_id from public.match_requests mr join public.objectives o on o.id = mr.objective_id where o.owner_id = :'MARGARET';
select test.ok((select bool_and(private.age_years(p.date_of_birth) between 45 and 65)
                from test.margaret_asked a join public.profiles p on p.id = a.candidate_id), 'A 55-year-old is never matched outside 45-65');
select test.ok(not exists (select 1 from test.margaret_asked where candidate_id in (:'SUE', :'ROB')), 'Sue (44) and Rob (70) are never asked');
select test.ok((select count(*) = 2 from test.margaret_asked where candidate_id in (:'HELEN', :'GARY')), 'Custom ranges respected when both fit (Helen 50-60, Gary 40-56)');
select test.ok(not exists (select 1 from test.margaret_asked where candidate_id = :'PETE'), 'Matching is mutual: Pete (60) wants 60-70, so Margaret (55) is not matched');
select test.ok(not exists (select 1 from test.margaret_asked where candidate_id = :'DAVE'), 'Hidden contacts: Dave is in Margaret''s contacts, so never asked');
select test.ok(not exists (select 1 from test.margaret_asked where candidate_id = :'LINDA'), 'Hidden contacts work both ways: Linda has Margaret in hers');
select test.ok(exists (select 1 from test.margaret_asked where candidate_id = :'HELEN'), 'A hidden-contacts list is ignored when that person has hiding off');
select test.ok(not exists (select 1 from test.margaret_asked where candidate_id = :'TONY'), 'Same workplace is kept out (case-insensitive)');
select test.ok(not exists (select 1 from test.margaret_asked a join public.profiles p on p.id = a.candidate_id
                           where private.age_years(p.date_of_birth) < 45), 'No young adults for a 55-year-old');

insert into public.objectives (owner_id, type, text) values (:'LINDA', 'trivia', 'A fifth person for trivia night');
select public.find_matches((select id from public.objectives where owner_id = :'LINDA'));
select test.ok(not exists (select 1 from public.match_requests mr join public.objectives o on o.id = mr.objective_id
                           where o.owner_id = :'LINDA' and mr.candidate_id = :'MARGARET'), 'Linda never gets Margaret either');

\echo '--- Matching a 19-year-old'
insert into public.objectives (owner_id, type, text) values (:'NOAH', 'sport', 'Someone for social touch footy');
select public.find_matches((select id from public.objectives where owner_id = :'NOAH'));
select test.ok((select count(*) > 0 and bool_and(private.age_years(p.date_of_birth) between 18 and 29)
                from public.match_requests mr join public.objectives o on o.id = mr.objective_id
                join public.profiles p on p.id = mr.candidate_id where o.owner_id = :'NOAH'), 'A 19-year-old is only matched with 18-29 year olds');
select test.ok(not exists (select 1 from public.match_requests mr join public.objectives o on o.id = mr.objective_id
                           where o.owner_id = :'NOAH' and mr.candidate_id = :'MARGARET'), 'A 19-year-old never gets the 55-year-old');

\echo '--- Adults stay with adults, weekly cap'
begin; :as_ben
insert into public.objectives (type, text) values ('sport', 'Someone for social touch footy on Tuesdays');
select test.ok((select status = 'active' from public.objectives where owner_id = auth.uid()), 'Adult objectives start straight away');
select public.find_matches((select id from public.objectives where owner_id = auth.uid()));
commit;
select test.ok((select bool_and(private.age_years(p.date_of_birth) >= 18)
                from public.match_requests mr join public.objectives o on o.id = mr.objective_id
                join public.profiles p on p.id = mr.candidate_id where o.owner_id = :'BEN'), 'Adults are only matched with adults');
-- Every other adult posts an objective too.
insert into public.objectives (owner_id, type, text)
select id, 'movie', 'Someone to see a movie with this weekend' from public.profiles
where private.age_years(date_of_birth) >= 18 and id <> :'BEN'
  and not exists (select 1 from public.objectives o where o.owner_id = public.profiles.id);
select public.find_matches(o.id) from public.objectives o join public.profiles p on p.id = o.owner_id
where private.age_years(p.date_of_birth) >= 18 and o.owner_id <> :'BEN' order by o.created_at;
select test.ok((select max(n) <= 3 from (select count(*) n from public.match_requests
                where created_at > now() - interval '7 days' group by candidate_id) x), 'Nobody gets more than 3 requests a week');
select test.ok(not exists (
  select 1 from public.match_requests mr join public.objectives o on o.id = mr.objective_id
  join public.profiles a on a.id = o.owner_id join public.profiles b on b.id = mr.candidate_id
  where not (private.age_fits(a.date_of_birth, a.match_age_min, a.match_age_max, b.date_of_birth)
             and private.age_fits(b.date_of_birth, b.match_age_min, b.match_age_max, a.date_of_birth))),
  'Every request in the database respects both people''s age ranges');

\echo '--- Ganging-up protection'
-- Priya and Jordan have met (connected). Priya targets someone; then Jordan's
-- objective must not land on the same person within 14 days.
insert into public.objectives (owner_id, type, text) values (:'PRIYA', 'study', 'A study buddy for Maths Methods');
update public.objectives set status = 'active' where owner_id = :'PRIYA';
insert into public.match_requests (objective_id, candidate_id, score, status)
select id, :'JORDAN', 80, 'agreed' from public.objectives where owner_id = :'PRIYA';
select public.complete_connection((select mr.id from public.match_requests mr join public.objectives o on o.id = mr.objective_id
                                   where o.owner_id = :'PRIYA' and mr.candidate_id = :'JORDAN'), 'qr', 'Toowong');
delete from public.objective_credits where user_id = :'PRIYA';
insert into public.subscriptions (user_id, plan) values (:'PRIYA', 'unlimited'), (:'JORDAN', 'unlimited');
insert into public.objectives (owner_id, type, text) values (:'PRIYA', 'event', 'Someone to go to the school dance with');
update public.objectives set status = 'active' where owner_id = :'PRIYA' and type = 'event';
select public.find_matches((select id from public.objectives where owner_id = :'PRIYA' and type = 'event'));
insert into public.objectives (owner_id, type, text) values (:'JORDAN', 'event', 'Someone to go to the school dance with');
update public.objectives set status = 'active' where owner_id = :'JORDAN' and type = 'event';
select public.find_matches((select id from public.objectives where owner_id = :'JORDAN' and type = 'event'));
select test.ok(not exists (
  select 1 from public.match_requests mj join public.objectives oj on oj.id = mj.objective_id
  where oj.owner_id = :'JORDAN'
    and exists (select 1 from public.match_requests mp join public.objectives op on op.id = mp.objective_id
                where op.owner_id = :'PRIYA' and mp.candidate_id = mj.candidate_id and mp.created_at > now() - interval '14 days')),
  'Two friends cannot both send requests to the same person');
\echo 'Safety flags raised for review:'
select f.kind, p.first_name as subject, cardinality(f.related_ids) as requesters from public.safety_flags f join public.profiles p on p.id = f.subject_id;

\echo '--- Blocking'
begin; :as_jordan
insert into public.blocks (blocked_id) values (:'ALEX');
commit;
begin; :as_alex
select test.fails($$insert into public.messages (match_request_id, body) values (test.get('alex_jordan'), 'hello?')$$, 'row-level security', 'Blocked people cannot message');
select test.ok((select count(*) = 0 from public.profile_card(:'JORDAN')), 'Blocked people cannot see your card');
commit;

\echo '--- Reports'
begin; :as_alex
insert into public.reports (reported_id, reason, details) values (:'JORDAN', 'other', 'Test report');
commit;
select test.ok((select count(*) = 1 from public.guardian_notifications where kind = 'report' and teen_id = :'ALEX'), 'Reporter''s parent is told');
select test.ok((select count(*) = 1 from public.guardian_notifications where kind = 'report' and teen_id = :'JORDAN'), 'Reported teen''s parent is told');

\echo '--- Anonymous visitors'
begin; set local role anon;
select test.fails($$select * from public.profiles$$, 'permission denied', 'Signed-out visitors can read nothing');
select test.fails($$select public.find_matches(gen_random_uuid())$$, 'permission denied', 'Signed-out visitors cannot run matching');
commit;

\echo 'ALL TESTS PASSED'
