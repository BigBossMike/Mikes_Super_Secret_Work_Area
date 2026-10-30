# Intro: notes for Claude

Mike (the owner) is not a developer. Explain things plainly and keep fixes quick.

## The product

- **Tagline:** "Extending a digital hand in a modern world." It should feel like putting your name down at the golf club and getting paired up.
- **How it works:** set a plan ("objective"). Intro asks up to 5 well-matched people if they're happy to be put forward. Chat stays locked (no numbers, emails, socials or links) until both people meet and press the big green Connect button with their phones together.
- **Pricing (AUD, decided 28th October 2026):** 7-day free trial, then $7.99 a month for as many plans as you like. Being asked to join someone else's plan is always free. Free for everyone during the pilot (payments not live).
- **Launch:** Brisbane, led by parents (Mike's parent network). See `docs/launch-plan.md`.

## Rules that must never break

- **Never stigmatise.** It's for everyone 16+. Never say or imply "lonely", "struggling", "find it hard" or "not the cool kids", anywhere: app, docs or ads. Lead with the plan and the people.
- **Age groups never mix.** 16–17 only with 16–17. Adults only with adults.
- **Adult age ranges are hard limits and must be mutual.** The default is your own age plus or minus 10. People can widen it to at most 20 years either side, never under 18. A 55-year-old is never paired with a 19-year-old.
- **Private by design.** No browsing or search. You see nobody until they agree. People who pass stay anonymous. "Hide me from my contacts" is on by default. "Keep my school/workplace out" is on by default. Discreet notifications are available.
- **Parents of 16–17 year olds** approve the account and (optionally) each plan, and are told about meet-ups. They never see chats.
- **Every objective states who'll be there** ("Me + 2 others").
- **ID checks use a provider** (bank check via ConnectID, or photo ID plus liveness selfie). Store only "verified" and the date of birth. Match the profile photo to the selfie.

## Where things are

| Folder | What |
|---|---|
| `app/` | Expo (React Native) app, SDK 58. Rules in `src/lib/` (tested). Sample-data store in `src/store/AppStore.tsx`. In-person connect (Bluetooth and QR) in `src/handshake/`. |
| `supabase/` | Database schema, security, matching, the connect-handshake function, seed data and tests. |
| `prototype/index.html` | Single-file clickable mock-up (also published as a Claude artifact). |
| `docs/` | Research, launch plan, ID checks and AI notes, `market-critique.md` (is Intro differentiated?), `id-provider-comparison.md`, `privacy-policy.md` and `terms-of-use.md` (drafts, holds numbered), `app-store-listing.md` (listing, age rating, privacy answers) and `decisions.md` (why things are the way they are). |

## Commands

```bash
cd app && npm install
npm test            # rule tests
npm run typecheck
npm start           # Expo dev server; scan the QR code with Expo Go

# Database tests need a local Postgres 16; see supabase/tests/run_local.sh
```

When changing a matching or privacy rule, change it in all three places (`app/src/lib`, `supabase/migrations`, `prototype/index.html`) and add tests.

## Next steps: launch build order (set 28th October 2026)

The live app ran on Mike's phone on 28th October 2026 and he gave the go-ahead to build to launch.

Mike's side (accounts; each unblocks a step below):

1. Sign-in by email code (decided 30th October 2026, replaces SMS). Emails go through Microsoft 365 using the same Azure app as Cavalry's hub (Mail.Send, Microsoft Graph), via Supabase's send-email hook (`supabase/functions/send-email`). Mike: the hub's AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and GRAPH_FROM_ADDRESS into app/.env.local, then run `node app/scripts/email-setup.mjs mike@cavalry.au`. Until then sign-in emails can't carry a code (Supabase's free built-in sender sends links only, 2 an hour). Mike's account already has mike@cavalry.au added. Development builds still offer the test numbers.
2. ID check: Stripe Identity for the pilot (decided 30th October 2026). Mike: Stripe account (Cavalry Software, Australia), Identity enabled, then two test keys into app/.env.local (STRIPE_SECRET_KEY, and a restricted STRIPE_IDENTITY_READ_KEY with Identity Verification Results and Recent Detailed Verification Results set to Read); then run `node app/scripts/stripe-setup.mjs`. Ask Stripe in writing that 16 and 17 year olds can be verified. A bank check (Yoti or Persona, quotes needed) before public launch.
3. Apple Developer Program: Cavalry Software Pty Ltd, team CSUUTP3D67. Membership had lapsed and was renewed 28th October 2026. iPhone registered with Expo. Google Play Console (US$25 once) only when Android goes to the store; Android testers get an install file from EAS until then.
4. RevenueCat account (free tier) for the $7.99 monthly subscription with a 7-day free trial, after 3. Set up the subscription in App Store Connect and Google Play with a 7-day free trial introductory offer.
5. Lawyer for the age rules, privacy policy and terms, before public launch only. Privacy policy and terms of use drafted 28th October 2026 (`docs/privacy-policy.md` 8 holds, `docs/terms-of-use.md` 5 holds). Both need publishing at a public web address before the stores.

Claude's side (code), in order:

1. Profile photos: done 28th October 2026 (migration 0003, `app/src/components/PhotoPicker.tsx`, `scripts/live-photos.mjs` passes). Works on Mike's iPhone.
2. Push notifications: built 28th October 2026 (migration 0005, `app/src/notifications/`, `scripts/live-push.mjs` passes). The database sends through Expo with pg_net. Works on Mike's iPhone in the development build (28th October 2026: test notification arrived, tap opened Requests). Expo Go can't receive them. Expo project `@mikegrady/intro`, bundle id `au.cavalry.intro`, `app/eas.json`. Run the phone with `npx expo start --dev-client` from `app/`.
3. City, not suburb: done 28th October 2026 (migration 0004). Nobody is asked for a suburb; matching is Brisbane-wide with no distance scoring. More cities later.
4. Parent mode: done 28th October 2026 (migration 0006, `app/src/app/parent-home.tsx`, `scripts/live-parent.mjs` passes). A parent signs in with the invited number, approves or declines, then sees plans to OK, controls, meet-ups and activity; never chats. Gap: nothing checks the parent is an adult (phone number only); add a parent ID check with the ID provider.
5. ID check: Stripe Identity built 30th October 2026 (migration 0009, functions `identity` and `identity-webhook`, `app/src/app/id-check.tsx`). Photo ID plus live selfie in Stripe's sheet; the server reads the verified date of birth and document with the restricted key, refuses under-16s and a document already used, sets `verified_at`, then has Stripe delete the images. Stripe test keys connected 30th October 2026 and `scripts/live-identity.mjs` passes. Not yet run through the scanner on a phone. Still to add: the parent ID check (adult) and the profile-photo match.
6. Bluetooth test on two phones with the development build; tune the signal and distance limits in `app/src/lib/handshake.ts` and the server function together. Mike's iPhone has the build. Second phone (Mike's are all Apple): register it with `npx eas-cli device:create` (link opened on that phone), then `npx eas-cli build:resign --platform ios --target-profile development --id 69a8027e-827f-43f2-970b-b8b7fcdf258b` adds it to the current iPhone build (30th October 2026: new icon, launch screen, contacts, Stripe). An Android development build was also started 28th October 2026 (Mike wants Android covered). Test set-up: `node app/scripts/bluetooth-test-setup.mjs` makes test person Sam (0491 570 106, code 123456, age 48) set a plan that only Mike matches; Mike says yes on his phone, the second phone signs in as Sam, both open the chat and press Connect. Expo free plan: 30 cloud builds a month (15 iOS, 15 Android).
7. In-app purchases through RevenueCat: one $7.99 monthly subscription with a 7-day free trial. Its webhook writes `subscriptions` (plan, current_period_end, in_trial); then set `private.settings.payments_live` to true to end the free pilot.
8. Plan screening: word-list layer done 28th October 2026 (migration 0007, `app/src/lib/planScreen.ts`, mock-up, `scripts/live-plan-screen.mjs` passes). Blocks dating, putting people down and singling someone out; for 16-17 also alcohol, vapes, drugs and homes. `planScreen.fixtures.json` is the shared test list; change all three places together. Next layer: AI screening (needs an Anthropic API key).
9. Store assets, EAS production build, TestFlight pilot. Listing text, age rating, privacy answers and Apple review notes drafted (`docs/app-store-listing.md`, 8 holds). Draft icon and splash in the app (navy "i." with the green full stop; wordmark splash, light and dark; `docs/brand/`), showing on phones from the next build. Still to make: screenshots, demo video.
10. Launch per `docs/launch-plan.md`.

Built 28th October 2026, not yet tried on a phone: Delete my account (Me), hide me from my contacts (needs the next build for the contacts permission), Block (chat), meet-up check-in (chat, for 16-17 when the parent has it on).
