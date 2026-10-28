# Intro: notes for Claude

Mike (the owner) is not a developer. Explain things plainly and keep fixes quick.

## The product

- **Tagline:** "Extending a digital hand in a modern world." It should feel like putting your name down at the golf club and getting paired up.
- **How it works:** one plan a month ("objective"). Intro asks up to 5 well-matched people if they're happy to be put forward. Chat stays locked (no numbers, emails, socials or links) until both people meet and press the big green Connect button with their phones together.
- **Pricing (AUD):** free gets 1 objective a month, $5 per extra objective, $10 a month unlimited.
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
| `docs/` | Research, launch plan, ID checks and AI notes, `market-critique.md` (is Intro differentiated?), `id-provider-comparison.md`, `privacy-policy.md` (draft, holds numbered) and `decisions.md` (why things are the way they are). |

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

1. Twilio account (twilio.com): an Australian sender, then Account SID, Auth Token and Messaging Service SID into Supabase → Authentication → Providers → Phone. Until then only the test numbers can sign in.
2. ID check provider: Stripe Identity for the pilot, or quotes from Yoti and Persona first. Comparison and vendor questions in `docs/id-provider-comparison.md`. Stripe needs a Stripe account (Australia) and its test keys.
3. Apple Developer Program: Mike has an account (28th October 2026), so TestFlight is open. Google Play Console (US$25 once) only when Android goes to the store; Android testers get an install file from EAS until then.
4. RevenueCat account (free tier) for the $5 and $10 plans, after 3.
5. Lawyer for the age rules, privacy policy and terms, before public launch only. Privacy policy drafted 28th October 2026 (`docs/privacy-policy.md`, 8 holds to fill). Terms of use still to draft.

Claude's side (code), in order:

1. Profile photos: done 28th October 2026 (migration 0003, `app/src/components/PhotoPicker.tsx`, `scripts/live-photos.mjs` passes). Not yet tried on a phone.
2. Push notifications: expo-notifications, device tokens stored, a server function that sends for requests, answers, messages and parent alerts. Discreet mode means the text is only "Intro: you have an update".
3. Brisbane-wide suburb list (Greater Brisbane) in the migration and the app. Today it is inner Brisbane only.
4. Parent mode in the same app: a parent signs in with the invited number and sees the parent screens, never chats.
5. ID provider wired in place of verify-stub, once Mike has chosen (its webhook sets `verified_at` and the date of birth with the service role).
6. EAS development build for the Bluetooth test on two phones; tune the signal and distance limits in `app/src/lib/handshake.ts` and the server function together.
7. In-app purchases through RevenueCat; its webhook updates `subscriptions` and `objective_credits`.
8. Objective screening for mocking or targeting language before anyone is asked.
9. Store assets (icon, splash, listings, privacy labels), EAS production build, TestFlight pilot.
10. Launch per `docs/launch-plan.md`.
