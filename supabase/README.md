# Intro backend (Supabase)

This folder is Intro's "back end": the database that stores people, objectives, matches and chats, and the rules about who can see what. It runs on [Supabase](https://supabase.com), a hosted service that gives you a database, sign-in, file storage and server functions without running your own servers.

## What's in here

| File | What it is |
|---|---|
| `migrations/0001_init.sql` | Builds the whole database: tables, safety rules, matching, and permissions. |
| `migrations/0002_contacts_upsert.sql` | Lets a person update their own contact row with an upsert. |
| `migrations/0003_photos.sql` | The private `photos` Storage bucket and who may read each photo. |
| `migrations/0004_city.sql` | One city (Brisbane), no suburb question, no distance in matching. |
| `migrations/0008_pricing_and_account.sql` | 7-day trial then $7.99 a month (free during the pilot), and Delete my account (reports kept by phone fingerprint). |
| `migrations/0007_plan_screening.sql` | Refuses plans that read as dating, put someone down or single someone out (and for 16-17: alcohol, vapes, drugs, homes). |
| `migrations/0006_parent_mode.sql` | Parent mode: invites to my number, decline, a parent pausing their teen, and the teen told when a parent declines. |
| `migrations/0005_push.sql` | Push notifications: phone tokens, and triggers that send through Expo (pg_net). A parent's approval now starts the matching. |
| `config.toml` | The Supabase command-line tool's settings for this project. No secrets. |
| `functions/connect-handshake/index.ts` | The server code for the in-person "tap phones" connect. |
| `functions/verify-stub/index.ts` | Pilot-only: marks a person verified from the date of birth they type. Off unless the secret `STUB_VERIFY_ENABLED` is `true`. |
| `seed.sql` | Made-up Brisbane test people. For testing only, never the live app. |
| `tests/` | Automated checks that the safety rules work (90 of them). |

## The tables, in plain English

| Table | What it holds | Who can see it |
|---|---|---|
| `profiles` | First name, photo, suburb, interests, free times, school, workplace, the age range you're happy to meet, privacy settings, date of birth, ID-verified date. | You and your parent. Everyone else only sees a small card (first name, photo, age, suburb), and only when allowed. |
| `profile_private` | Cultural background (optional). | Only you. |
| `private_contacts` | Full name, mobile, Instagram. The mobile is also stored in a standard +61 form and as a fingerprint (see below). | You, and people you've **met in person** through Intro. |
| `hidden_contacts` | Fingerprints of the numbers in your phone's contacts, for "hide me from my contacts". | **Only you.** Not other users, not parents. |
| `guardians` | The link between a 16 or 17 year old and their parent, plus the parent's settings. | The teen and the parent. Only the parent can change the settings. |
| `objectives` | "A fifth player for Tuesday football", when, where, and who'll be there. | The owner, their parent, and the people asked about it. |
| `match_requests` | Who Intro asked to be put forward, and whether they said yes. | The person asked. The person asking only sees names once someone says **yes**. People who pass stay anonymous. |
| `messages` | Chat. | Only the two people talking. **Never parents.** |
| `connections` | Two people who met and tapped phones. | The two people and their parents. |
| `blocks`, `reports` | Safety tools. | Your own. Reports alert the parents of any under-18 involved. |
| `meetup_checkins` | "Meeting at Toowong Sports Centre, Thursday 6pm". | The two people. The teen's parent gets a notification. |
| `guardian_notifications` | What shows in the parent app. | That parent. |
| `subscriptions` | Subscribed or not, in the free trial, and when it renews. (`objective_credits` is no longer used.) | Your own. Only the server can change them, after Apple or Google confirms payment. |
| `safety_flags` | Possible ganging-up, for the Intro safety team. | Staff only. |
| `suburbs`, `objective_types` | Reference lists. | Everyone signed in. |

## The rules the database enforces

These are checked by the database itself, so they hold even if someone tampers with the app.

- **16+ only**, and only the ID-check service can mark someone verified or change their date of birth.
- **16 and 17 year olds need an approved parent** before they can post an objective or be matched. A parent sees the invite (`my_parent_invites`) by signing in with the mobile number the teen entered, then approves it (`claim_guardian_invite`) or declines it (`decline_parent_invite`). An approved parent can see their teen's profile, plans, connections and activity, decide plans, change their own alert settings and pause the teen (`guardian_set_paused`). Never chats.
- **Minors are only ever matched with minors (16–17), and adults with adults.**
- **Age ranges for adults are hard limits, and both people must fit.** Each adult can set the youngest and oldest age they're happy to meet. If they haven't, it's their own age minus 10 to plus 10. They can widen it to at most 20 years either side, and never under 18. Matching only happens when each person's age is inside the *other* person's range. So a 55-year-old (45–65) is never matched with a 19-year-old (18–29). Within the range, people closer in age still score a little higher.
- **Keep my school out / keep my workplace out:** if either person has it switched on and they share a school or workplace (capital letters don't matter), they're never matched. Both are on by default.
- **Hide me from my contacts:** this is on by default, so nobody can find out who uses Intro by being matched with someone they know. If either person has it on and the other's mobile is in their phone contacts, they're never matched. This works in both directions.
- **Matching** (`find_matches`) asks up to 5 people. It skips:
  - anyone paused or blocked
  - anyone from the same school if either person has "keep my school out" on
  - anyone this person has asked before or already met
  - anyone who's already had 3 requests this week
- **Ganging-up protection:** if, in the last 14 days, someone has had requests from people who know each other, Intro skips them and raises a safety flag. "Know each other" means they've met through Intro.
- **Parent approval:** under-18 objectives wait for the parent's OK if the parent has that setting on. If a parent says no, the plan is closed and nothing is charged.
- **Plan screening:** before anyone is asked, a plan (text, when and where) that reads as dating, puts someone down or singles someone out is refused with a plain reason (`objective_not_allowed`). For 16 and 17 year olds, so is alcohol, vapes, drugs or meeting at someone's home. Same lists as `app/src/lib/planScreen.ts` and the mock-up.
- **Locked chat:** messages with phone numbers, emails, @handles, links or social app names are rejected until the two people have connected in person.
- **Pricing:** setting a plan needs a subscription ($7.99 a month after a 7-day free trial, through Apple or Google). Being asked, saying yes and meeting are always free. Until `private.settings.payments_live` is true, everyone can set plans free (the pilot).
- **Contact details unlock only after an in-person connection**, which only the server can record.
- **Profile photos** sit in a private bucket, in a folder named after the owner. A person can only upload into their own folder and only point their profile at their own folder. Reading follows the card rule: the person, people who agreed to talk to them, people who were asked about their plan, people they've met, and a teen's parent. The app shows photos through signed URLs that last an hour.

## "Hide me from my contacts": how the app must hash numbers

The app never uploads anyone's contact book. For each number in the phone it uploads a fingerprint, and the database compares fingerprints. For this to work, the app must make fingerprints **exactly** the way the database does:

1. **Normalise the number to E.164 form.** Remove everything except digits and a leading `+`. Then:
   - Australian local numbers (`0` followed by 9 digits) become `+61` plus the 9 digits. So `0491 570 101` becomes `+61491570101`.
   - Numbers starting `61` with 9 more digits get a `+` in front.
   - Numbers already starting with `+` are kept as they are.
   - Skip anything else.
2. **Hash it.** Take the SHA-256 of the UTF-8 text, e.g. `+61491570101`.
3. **Send lowercase hex.** That's 64 characters, inserted into `hidden_contacts.phone_hash`.

The database does the same to each person's mobile in `private_contacts`. The functions are `private.normalise_phone` and `private.phone_hash`. A mobile number the database can't recognise is rejected.

Note: phone numbers are a small set, so a fingerprint could in principle be reversed by trying every number. That's why only the owner can ever read their own list.

## Push notifications

The database sends them itself. Each phone registers its Expo push token (`register_push_token`); triggers call `private.push`, which posts to Expo's push service with `pg_net` after the change is saved. A failed send never blocks the change.

| Event | Who hears | Opens |
|---|---|---|
| Asked if keen on a plan | The person asked | Requests |
| Someone said yes | The person who set the plan | Matches |
| Chat message | The other person | The chat |
| Parent approved or turned down a plan | The teen | Home |
| Parent approved the account | The teen | Home |
| Plan to OK, met someone, meet-up, report | The parent | Parent screen |

Passes send nothing; people who pass stay anonymous. Parents never hear about chats.

**Discreet notifications** (`profiles.discreet_notifications`, off by default): the notification has no title and says only **"Intro: you have an update"**. No names, no plan text.

`app/scripts/live-push.mjs` checks every notification's wording inside a rolled-back transaction and sends one real push to a made-up token to prove the database reaches Expo.

## How the phone handshake works

See the comments at the top of `functions/connect-handshake/index.ts`. In short:

1. Both people press Connect.
2. Their phones swap codes over Bluetooth that change every 5 seconds, or one shows its code as a QR and the other scans it.
3. The server checks that they pressed at the same time (Bluetooth: within 10 seconds; QR: while the shown code is live, up to 2 minutes), heard each other with a strong signal, and are in the same place.
4. Only then are contact details unlocked.

The app side is in `app/src/handshake/`. The code recipe and the checks are mirrored in `app/src/lib/handshake.ts` with tests, so change the settings in both files together. The signal strength and distance limits will need tuning with real phones.

## Setting it up (about 15 minutes)

Done for the Intro project (Sydney, `ap-southeast-2`) on 28th October 2026. Steps 2, 4 and 5 were run from the command line; the record is in `../docs/decisions.md`.

1. **Create a project.** Sign up at supabase.com and create a new project. Choose the **Sydney** region so data stays in Australia.
2. **Build the database.** In the project, open **SQL Editor**, paste in the whole of `migrations/0001_init.sql`, and press **Run**.
   - Alternatively, with the Supabase command-line tool: `supabase link --project-ref <ref>` then `supabase db push --linked`. The tool reads `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` from the environment (the app's `.env.local` holds them).
3. **Optional test data.** For a test project only, run `seed.sql` the same way. Don't do this on the live project.
4. **Turn on phone sign-in** under Authentication → Providers → Phone. Everyone signs in with a mobile number and an SMS code, and parents claim invites the same way. Sending real SMS needs an SMS provider (Twilio or similar) set up on that page. For testing, add **test phone numbers with fixed codes** on the same page, so no SMS is sent. The same setting can be made with the Management API (`PATCH /v1/projects/<ref>/config/auth` with `external_phone_enabled`, `sms_test_otp` and `sms_test_otp_valid_until`, which must be given together).
5. **Deploy the server functions** with the command-line tool: `supabase functions deploy connect-handshake --use-api` and `supabase functions deploy verify-stub --use-api` (`--use-api` means no Docker is needed).
   - `verify-stub` marks people verified from the date of birth they type. **Pilot only.** Switch it on with `supabase secrets set STUB_VERIFY_ENABLED=true`, and turn it off (`supabase secrets unset STUB_VERIFY_ENABLED`) once the ID-check provider is in.
6. **Connect the app.** Copy the **Project URL** (built from the Project ID: `https://<id>.supabase.co`) and the **publishable key** from Project Settings → API Keys into `app/.env.local` (see `app/.env.example`). Never put a **secret** or **service_role** key in the app. Those are for server code only.
7. **Check it end to end:** `cd app && TEST_PHONES="61491570101=123456,61491570102=123456" node scripts/live-smoke.mjs` finishes with `ALL PASSED`. Each run needs a pair of test numbers that haven't been matched before.

## Still to do before launch

- **ID verification:** connect a provider (Stripe Identity, Persona, ConnectID, etc.). Its webhook should set `verified_at` and the real date of birth using the service role.
- **Payments:** connect RevenueCat (or Apple and Google directly). Its webhook updates `subscriptions` and `objective_credits`.
- **AI plan screening:** the word lists catch the obvious. A model (Claude) should read each plan for meaning before launch, with people making the serious calls.
- **Contact hashing in the app** must follow the recipe above exactly. Test it against `private.phone_hash` before launch.
- **Ganging-up detection** only knows about people who've met through Intro. It can't yet see friendships that exist outside the app. Same-school and same-device signals could be added.

## Running the tests on a computer

With a local Postgres installed (not a live Supabase project):

```
PGHOST=localhost PGUSER=postgres supabase/tests/run_local.sh
```

It finishes with `ALL TESTS PASSED`, or stops at the first `FAIL`.
