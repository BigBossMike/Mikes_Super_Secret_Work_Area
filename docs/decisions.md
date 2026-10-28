# Intro: decision log

A record of what Mike decided while building the first version (26 October 2026), so any new Claude session can pick up where this one left off. The rules themselves are in `CLAUDE.md`.

| # | Decision | Why |
|---|---|---|
| 1 | Working name **Intro**. One objective (plan) a month, up to 5 people put forward, chat locked until people meet and tap phones. | The core concept. |
| 2 | Pricing: free gets 1 a month, **$5 per extra objective**, **$10 a month unlimited** (AUD). | "$5 per objective" was read as per extra objective. Mike can change this. |
| 3 | Don't lead with the school formal. Lead with everyday plans: a fifth player, a movie, study, then adult plans (midweek dinner, walking buddy, trivia). | The formal is one family's specific case. |
| 4 | Home prompt: "What would you like to do this month?" | "What do you need someone for" read badly. |
| 5 | Parent controls for 16–17 year olds: sign-off, optional plan approval, meet-up alerts, never chats. | Safety, and parents are the launch channel. |
| 6 | Ganging-up protections: no search, anonymous until yes, "who'll be there" on every plan, school/workplace kept out, one account per verified person, and a pattern check across connected people. | Stop groups using Intro to target someone. |
| 7 | **For everyone 16+**, not just teens. Two groups that never mix. | Mike: it's for all ages. |
| 8 | **Never stigmatise.** Tagline: "Extending a digital hand in a modern world." It should feel like putting your name down at the golf club. | Mike: "the guy uses Intro" would kill it. That's what went wrong with dating apps. |
| 9 | **Private by design:** nobody can see who uses Intro. Hide me from my contacts (on by default), keep my school/workplace out, discreet notifications. | Same reason as 8. |
| 10 | Adult age ranges are **hard and mutual**: default ±10 years, at most ±20, never under 18. | Mike: a 55-year-old must never be paired with a 19-year-old. |
| 11 | ID checks through a **provider** (bank check via ConnectID, or photo ID plus liveness selfie). Match the profile photo to the selfie. Store only "verified" and the date of birth. | Accuracy, deepfakes, Privacy Act biometric rules, and eSafety guidance. See `docs/verification-and-ai.md`. |
| 12 | Phone handshake: Bluetooth plus a server check, with a QR code fallback. | Works on both iPhone and Android. See `docs/research.md`. |
| 13 | Brisbane launch led by Mike's parent network, starting with a small invite-only pilot. | See `docs/launch-plan.md`. |
| 14 | Bluetooth library: **munim-bluetooth** (advertises and listens on both iPhone and Android). The connect code travels inside a 128-bit Bluetooth service UUID. QR fallback: expo-camera to scan, react-native-qrcode-svg to show. Decided 27 October 2026. | iPhones can only advertise service UUIDs and a name, so this is the one method that works between any two phones. Bluetooth needs a development build; Expo Go runs the demo with a pretend partner and a real QR code. |
| 15 | Matching is **Brisbane-wide**: "close enough, not next door". The database caps candidates at 25 km from the person's suburb; the app scores closer people higher but has no cutoff. Decided 27 October 2026. | Mike: the pool is the city, not the suburb. |
| 16 | **Build and launch, 16+ as originally planned. No concierge pilot.** Market test is the app itself. Decided 27 October 2026 after `market-critique.md`. | Mike: a spreadsheet and WhatsApp don't test it; build, market, then fail if it fails. Worst case is an app nobody uses. |
| 17 | Live app: sign in by mobile number and SMS code (Supabase phone auth). During the pilot the server function verify-stub marks people verified from the date of birth they type; it only works when a secret is set and is replaced by the ID provider before launch. Order at sign-up is age, profile, then parent sign-off. Decided 27 October 2026. | Parents claim invites by phone number, so phone sign-in is needed anyway. The database needs the profile before a parent invite or a verification. |
| 18 | **Build to launch.** The live app ran on Mike's phone on 28th October 2026 ("Worked. Looks good. I like it. Let's make it happen"). Build order in `CLAUDE.md`, Next steps. | Mike: make it happen. |
| 19 | **City, not suburb.** Nobody is asked for a suburb; everyone is in Brisbane for now and matching is city-wide with no distance in the score. The suburb list stays only so the connect record can name the nearest suburb to where two people met. Decided 28th October 2026. | Mike: a city is easier; the six-suburb list was a sample. |
| 20 | **Push notifications are sent by the database**, through Expo's push service with pg_net, not by the app or a server function. Passes send nothing. Parents never hear about chats. A parent's approval starts the matching straight away. Decided 28th October 2026. | Every event already happens in the database, so nothing can be missed and no secret is needed. A teen's approved plan used to wait for the teen to open the app before anyone was asked. |
| 21 | **One development build for Bluetooth and push.** Expo project `@mikegrady/intro`, bundle id `au.cavalry.intro` (iOS and Android), internal distribution. `npm start` stays in Expo Go mode. Decided 28th October 2026. | Expo Go can't receive push notifications or use Bluetooth. Mike has an Apple developer account. |

## State at the end of the first session

- `app/`: every screen working on sample data. 13 rule tests pass.
- `supabase/`: full database with security rules. 94 local database checks pass. Not yet deployed to a real Supabase project.
- `prototype/`: clickable mock-up, also published as a private Claude artifact: https://claude.ai/artifact/6EVK4s4T8vRiyEwT2votkN
- Next steps are in `CLAUDE.md`.

## Second session (27 October 2026)

- `app/src/handshake/`: the in-person connect built for real. Bluetooth (munim-bluetooth) plus the QR fallback (camera scan, rotating code), a stand-in server for the demo build, and the screens `connect/[id].tsx` and `connect/qr/[id].tsx`.
- `app/src/lib/handshake.ts`: the connect rules, the same as the server's. 36 rule tests pass. Typecheck passes.
- Not yet tested on real phones. Bluetooth needs a development build and two phones; the QR code works in Expo Go.
- Server function: the QR press window is now the press lifetime (2 minutes), since the scanned code itself proves freshness.

## Third session (28 October 2026): live on Supabase

- Supabase project `Intro`, ref `dneslkrbeiotsnckazkt`, region Oceania (Sydney), free plan, organisation Cavalry Software.
- `supabase/config.toml` added by `supabase init`; project linked; `0001_init.sql` and `0002_contacts_upsert.sql` pushed.
- `connect-handshake` and `verify-stub` deployed (`--use-api`, no Docker). Secret `STUB_VERIFY_ENABLED=true` set: pilot verification from the typed date of birth.
- Phone sign-in on. Test numbers with fixed codes: `+61491570101` to `+61491570106` (code 123456) for the smoke test, plus Mike's own mobile (code given in chat, not written down here). No SMS provider yet, so only those numbers can sign in.
- `app/scripts/live-smoke.mjs`: ALL PASSED (sign-in, verify, objective, match, request, locked chat, QR handshake, unlocked details). Two fixes on the way: the contacts update grant needed `id` for upserts (migration 0002), and the script's objective text had a timestamp that read as a phone number.
- App keys: the project uses the new `sb_publishable_` key in place of the legacy anon key. The functions still read `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the runtime, which works.
- Expo Go on iPhone needs the same Expo account on the phone and the laptop (`npx expo login --no-browser -u <user>`; the browser login fails on Windows). Dev server started with `--port 8082` once the first one was in use.
- Mike opened the live app on his iPhone: sign-in, age, profile, Home. Approved. Next: the launch build order in `CLAUDE.md`.
- Profile photos built: private `photos` bucket, folder per person, read rule = card rule (migration 0003). The app resizes to 512 px JPEG on the phone (expo-image-picker, expo-image-manipulator) and shows photos through hour-long signed URLs. `profiles.photo_url` holds the storage path, not a link. Rules checked live with `app/scripts/live-photos.mjs`.
- Privacy policy drafted (`docs/privacy-policy.md`), 8 holds for Mike and the lawyer. Terms of use not yet drafted.
- City, not suburb (migration 0004, decision 19). Photo centring fixed on iPhone: the app squares the photo itself.
- Push notifications built (migration 0005, decision 20). Expo project linked, `eas.json` added (decision 21). Not yet received on a phone: waiting on the iOS development build.
- iPhone registered with Expo. The first iOS build stopped at Apple because the Cavalry Software developer membership had lapsed; Mike renewed it the same day. Packages brought to SDK 58 patch versions; microphone permission removed (Intro never records sound); standard encryption only (ITSAppUsesNonExemptEncryption false).
