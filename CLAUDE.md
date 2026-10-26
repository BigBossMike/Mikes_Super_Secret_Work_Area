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
| `docs/` | Research, launch plan, ID checks and AI notes, and `decisions.md` (why things are the way they are). |

## Commands

```bash
cd app && npm install
npm test            # rule tests
npm run typecheck
npm start           # Expo dev server; scan the QR code with Expo Go

# Database tests need a local Postgres 16; see supabase/tests/run_local.sh
```

When changing a matching or privacy rule, change it in all three places (`app/src/lib`, `supabase/migrations`, `prototype/index.html`) and add tests.

## Next steps

1. Create a Supabase project, run the migration, and connect the app store to it.
2. Choose an ID check provider.
3. Test the Bluetooth connect on two real phones. The code and the QR fallback are built (`app/src/handshake/`), but Bluetooth needs a development build (`npx expo run:android`, `npx expo run:ios` or EAS Build) and tuning of the signal and distance limits.
4. Set up in-app purchases.
5. Get legal advice on age rules and privacy.
