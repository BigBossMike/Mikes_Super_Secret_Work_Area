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
| 22 | **Parent mode is in the same app.** A parent signs in with the number the teen entered, approves or says "This isn't me", then gets the parent screen: plans to OK, controls, meet-ups, activity, pause. No profile needed. The teen is told if a parent declines. Decided 28th October 2026. | One app to build, test and ship. Parents already sign in by phone to claim the invite. |
| 23 | **Plans are screened before anyone is asked.** Refused for everyone: dating, putting people down, singling someone out ("the new kid", "from my school"). Refused for 16-17 only: alcohol, vapes, drugs, someone's home. Word lists first, in the database, app and mock-up, with one shared test list; AI screening is the next layer. Decided 28th October 2026. | Mike: it must never become a kiddie dating app, and plans must not be used to target anyone. Word lists are free and predictable; they miss subtle cases, hence the AI layer. |
| 24 | **Pricing: 7-day free trial, then $7.99 a month** for as many plans as you like (replaces decision 2). Being asked, saying yes and meeting stay free. Free for everyone until payments go live. Decided 28th October 2026. | Mike: people won't pay for one plan a month. Keeping the asked side free keeps the pool of people large. |
| 25 | **Delete my account in the app.** Removes the sign-in and everything hanging off it. Reports made by or about the person are kept for the safety team by phone fingerprint, not profile. Decided 28th October 2026. | Apple requires in-app deletion. Deleting must not erase a safety record. |
| 26 | **Stripe Identity for the pilot ID check.** Photo ID plus live selfie; the verified date of birth replaces the typed one; one document verifies one account (keyed fingerprint, not the number); Stripe deletes the images once verified. Pilot check stays until the keys are set. Decided 30th October 2026. | Cheapest with published pricing (A$2 a check, no monthly fee, first 50 free). No bank door, so a bank check comes before public launch. |
| 27 | **Sign in by email code, not SMS** (replaces the SMS part of decision 17). Parents are invited by email. The mobile number moves to the profile's contact details (shared after meeting, used for hide-me-from-my-contacts). Emails go through Azure Communication Services (Cavalry's existing service, Australia, sender Support@cavalry.software) via Supabase's send-email hook. Decided 30th October 2026. | Mike: free, and reuses what Cavalry already has. SMS costs per message. |

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
- 30th October 2026: email sign-in (migration 0010, decision 27). Found and fixed on the way: the app never saved anyone's own contact details, so nothing was shared after meeting and hide-me-from-my-contacts had no number to match. Mike's account has mike@cavalry.au added. `scripts/live-email.mjs` passes. Sign-in emails switched on through Azure Communication Services; first code reached mike@cavalry.au.
- 30th October 2026: Stripe Identity built (migration 0009, decision 26), waiting on Mike's Stripe keys. New development builds with the icon, launch screen, contacts and Stripe: iPhone 69a8027e, Android 16adf72c (the first Android try failed on a namespace clash in Stripe's scanner library; fixed with android.uniquePackageNames=false in plugins/withStripeIdentityAndroid.js). Stripe test keys connected and the webhook created; Native Mobile SDKs switched on; `app/scripts/live-identity.mjs` passes (session and phone key created, webhook reaches Intro). Not yet run through the scanner on a phone.
- Pricing changed (decision 24, migration 0008). Delete my account, hide me from my contacts (reads the phone's contacts, uploads fingerprints daily), Block in the chat, and the meet-up check-in for 16-17 built. `scripts/live-account.mjs` passes; deletion also checked through the web build.
- Terms of use (`docs/terms-of-use.md`) and the store listing with privacy answers (`docs/app-store-listing.md`) drafted. Draft icon and splash from the brand font and colours (`docs/brand/make-icons.js` regenerates them). Android development build done (build 1271aa09).
- Plan screening, word-list layer (migration 0007, decision 23). Database, app and mock-up agree on all 26 test phrases.
- Parent mode built (migration 0006, decision 22). Live check passes. Open gap: the parent's age isn't checked, only their phone number.
- iOS development build installed on Mike's iPhone (build 385efc5d). The phone registered for notifications and a test notification arrived; the tap opened Requests. The other iPhone on the Apple team (registered September 2025) no longer exists, so the Bluetooth test needs a second phone.
- iPhone registered with Expo. The first iOS build stopped at Apple because the Cavalry Software developer membership had lapsed; Mike renewed it the same day. Packages brought to SDK 58 patch versions; microphone permission removed (Intro never records sound); standard encryption only (ITSAppUsesNonExemptEncryption false).
