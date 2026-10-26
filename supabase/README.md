# Intro backend (Supabase)

This folder is Intro's "back end": the database that stores people, objectives, matches and chats, and the rules about who can see what. It runs on [Supabase](https://supabase.com), a hosted service that gives you a database, sign-in, file storage and server functions without running your own servers.

## What's in here

| File | What it is |
|---|---|
| `migrations/0001_init.sql` | Builds the whole database: tables, safety rules, matching, and permissions. |
| `functions/connect-handshake/index.ts` | The server code for the in-person "tap phones" connect. |
| `seed.sql` | Made-up Brisbane test people. For testing only, never the live app. |
| `tests/` | Automated checks that the safety rules work (65 of them). |

## The tables, in plain English

| Table | What it holds | Who can see it |
|---|---|---|
| `profiles` | First name, photo, suburb, interests, free times, school, date of birth, ID-verified date. | You and your parent. Everyone else only sees a small card (first name, photo, age, suburb), and only when allowed. |
| `profile_private` | Cultural background (optional). | Only you. |
| `private_contacts` | Full name, mobile, Instagram. | You, and people you've **met in person** through Intro. |
| `guardians` | The link between a 16 or 17 year old and their parent, plus the parent's settings. | The teen and the parent. Only the parent can change the settings. |
| `objectives` | "A fifth player for Tuesday football", when, where, and who'll be there. | The owner, their parent, and the people asked about it. |
| `match_requests` | Who Intro asked to be put forward, and whether they said yes. | The person asked. The person asking only sees names once someone says **yes**. People who pass stay anonymous. |
| `messages` | Chat. | Only the two people talking. **Never parents.** |
| `connections` | Two people who met and tapped phones. | The two people and their parents. |
| `blocks`, `reports` | Safety tools. | Your own. Reports alert the parents of any under-18 involved. |
| `meetup_checkins` | "Meeting at Toowong Sports Centre, Thursday 6pm". | The two people. The teen's parent gets a notification. |
| `guardian_notifications` | What shows in the parent app. | That parent. |
| `subscriptions`, `objective_credits` | Plan (free or unlimited) and $5 extra-objective credits. | Your own. Only the server can change them, after Apple or Google confirms payment. |
| `safety_flags` | Possible ganging-up, for the Intro safety team. | Staff only. |
| `suburbs`, `objective_types` | Reference lists. | Everyone signed in. |

## The rules the database enforces

These are checked by the database itself, so they hold even if someone tampers with the app.

- **16+ only**, and only the ID-check service can mark someone verified or change their date of birth.
- **16 and 17 year olds need an approved parent** before they can post an objective or be matched. A parent claims the invite by signing in with the mobile number the teen entered.
- **Minors are only ever matched with minors (16–17), and adults with adults.**
- **Matching** (`find_matches`) asks up to 5 people. It skips:
  - anyone paused or blocked
  - anyone from the same school if either person has "keep my school out" on
  - anyone this person has asked before or already met
  - anyone more than 25 km away
  - anyone who's already had 3 requests this week
- **Ganging-up protection:** if, in the last 14 days, someone has had requests from people who know each other, Intro skips them and raises a safety flag. "Know each other" means they've met through Intro.
- **Parent approval:** under-18 objectives wait for the parent's OK if the parent has that setting on. If a parent says no, any $5 credit is refunded.
- **Locked chat:** messages with phone numbers, emails, @handles, links or social app names are rejected until the two people have connected in person.
- **Plans:** 1 free objective a month. After that, each one needs a $5 credit, unless the person is on the $10 unlimited plan.
- **Contact details unlock only after an in-person connection**, which only the server can record.

## How the phone handshake works

See the comments at the top of `functions/connect-handshake/index.ts`. In short:

1. Both people press Connect.
2. Their phones swap codes over Bluetooth that change every 5 seconds, or scan a QR code instead.
3. The server checks that they pressed at the same time, heard each other with a strong signal, and are in the same place.
4. Only then are contact details unlocked.

The settings at the top of that file, like the signal strength and distance limits, will need tuning with real phones.

## Setting it up (about 15 minutes)

1. **Create a project.** Sign up at supabase.com and create a new project. Choose the **Sydney** region so data stays in Australia.
2. **Build the database.** In the project, open **SQL Editor**, paste in the whole of `migrations/0001_init.sql`, and press **Run**.
   - Alternatively, with the Supabase command-line tool: `supabase link` then `supabase db push`.
3. **Optional test data.** For a test project only, run `seed.sql` the same way. Don't do this on the live project.
4. **Turn on phone sign-in** under Authentication → Providers → Phone. Parents claim invites by signing in with their mobile.
5. **Deploy the handshake function** with the command-line tool: `supabase functions deploy connect-handshake`.
6. **Connect the app.** Copy the **Project URL** and **anon key** from Project Settings → API into the app's settings. Never put the **service_role** key in the app. It's for server code only.

## Still to do before launch

- **ID verification:** connect a provider (Stripe Identity, Persona, ConnectID, etc.). Its webhook should set `verified_at` and the real date of birth using the service role.
- **Payments:** connect RevenueCat (or Apple and Google directly). Its webhook updates `subscriptions` and `objective_credits`.
- **Push notifications** for new requests, messages and parent alerts.
- **Photo storage:** a Supabase Storage bucket for profile photos, with rules matching `profile_card`.
- **Objective screening:** check objectives for mocking or targeting language before anyone is asked.
- **Matching runs only on suburb centres.** The suburb list only covers inner Brisbane so far. Add more before launch.
- **Ganging-up detection** only knows about people who've met through Intro. It can't yet see friendships that exist outside the app. Same-school and same-device signals could be added.

## Running the tests on a computer

With a local Postgres installed (not a live Supabase project):

```
PGHOST=localhost PGUSER=postgres supabase/tests/run_local.sh
```

It finishes with `ALL TESTS PASSED`, or stops at the first `FAIL`.
