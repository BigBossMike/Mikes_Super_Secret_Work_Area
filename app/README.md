# Intro mobile app

The real Intro app, built with Expo (React Native) so one codebase runs on iPhone and Android.

**Status:** all screens work end to end using sample people stored on the phone (demo mode). The same screens run live against the Supabase backend in `../supabase/` when the two settings in `.env.example` are filled in. The live mode was run end to end against the real Supabase project on 28th October 2026 (`scripts/live-smoke.mjs`, all passed); the screens themselves have not yet been used live on a phone. The in-person connect (Bluetooth, with a QR code fallback) is built but not yet tested on real phones.

## What's in here

| Folder | What it is |
|---|---|
| `src/app/` | The screens. Each file is one screen, for example `verify.tsx` is the ID check and `chat/[id].tsx` is a chat. |
| `src/app/(tabs)/` | The three tabs: Home, Requests, Me. |
| `src/components/ui.tsx` | Shared building blocks: buttons, cards, chips, toggles. |
| `src/lib/` | The rules: age bands, matching, blocking contact details in chat, the connect codes and checks. Covered by tests. |
| `src/handshake/` | The in-person connect: Bluetooth (`ble.ts`), location, the server calls (`api.ts`, with a stand-in for the demo build) and the `useHandshake` hook the Connect screens use. |
| `src/store/` | What the app remembers. `context.ts` is the shape the screens see; `AppStore.tsx` fills it with sample people (demo); `LiveStore.tsx` fills it from Supabase; `liveMapping.ts` turns database rows into screen state (tested). |
| `src/backend/` | Every Supabase call (`supabaseBackend.ts`), the connection (`client.ts`), row types and plain-English error messages. |
| `src/theme.ts` | Colours (light and dark) and fonts. |

## Running it

You need Node.js installed. Then, in this folder:

```bash
npm install
npm start        # then scan the QR code with the Expo Go app on your phone
npm test         # runs the rules tests
npm run typecheck
```

## Going live

1. Set up the Supabase project (`../supabase/README.md`, "Setting it up").
2. Copy `.env.example` to `.env.local` and fill in the Project URL and the publishable (anon) key. The same file also holds `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` for the command-line steps; none of the four lines are committed.
3. Restart the dev server: `npx expo start --clear`.

What changes in live mode:

- Sign in by mobile number and an SMS code (new `signin.tsx` screen). Parents sign in the same way to approve a teen.
- Order at sign-up: age, then profile, then the parent sign-off for under-18s (the database needs the profile first).
- "Confirm my age" uses the typed date of birth. The server's `verify-stub` function marks the person verified. Pilot only: the ID-check provider replaces it before launch.
- Matches, requests, chats, connections and the plan allowance come from the database. New requests and chat messages arrive live; answers to your own plan are checked every 5 seconds.
- Payments show "not set up yet" until in-app purchases are built.

## Connect in person: demo and live

The connect has two modes, picked by whether the Supabase settings are set (see `.env.example`).

| | Demo (nothing set) | Live (`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set) |
|---|---|---|
| Server | A stand-in on the phone that runs the same rules as `supabase/functions/connect-handshake`. | The real function. |
| Other person | Pretend: presses a second after you and stands next to you. | Real. |
| Bluetooth | Pretend. | Real (munim-bluetooth). Needs a development build; Expo Go can't do it. |
| QR code | Real. Another phone running Intro can scan it. | Real. |
| Location | Real if allowed, otherwise Paddington. | Real, and required. |

How it works: both phones make a code that changes every 5 seconds from a key the server hands out. Over Bluetooth each phone advertises its code inside a service UUID and listens for the other's. With QR, one phone shows its code and the other scans it. Each phone then tells the server what it heard and where it is. The server unlocks details only if both pressed together, each heard the other up close (Bluetooth) or one scanned the other (QR), and the phones are in the same place. The rules are in `src/lib/handshake.ts` and tested.

To test Bluetooth, build the app onto two phones:

```bash
npx expo run:android      # or: npx expo run:ios
```

Or use EAS Build with a development profile. The signal strength and distance limits (`HANDSHAKE` in `src/lib/handshake.ts`, and the same numbers at the top of the server function) will need tuning on real phones.

## Still to do before launch

1. Use the live mode on a phone (Expo Go, sign in with a test number) and fix what the screens get wrong. The end-to-end script passes.
2. ID verification provider (for example Stripe Identity or ConnectID).
3. Test the Bluetooth connect on two phones with a development build, and tune the limits.
4. Parent app: either a separate app or a parent mode in this one.
5. In-app purchases (RevenueCat) for the $5 and $10 plans.
6. Push notifications for requests, approvals and messages.
7. App Store and Google Play accounts, icons, store listings and privacy labels.
