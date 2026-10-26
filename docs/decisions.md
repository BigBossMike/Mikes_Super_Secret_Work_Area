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
