# Intro mobile app

The real Intro app, built with Expo (React Native) so one codebase runs on iPhone and Android.

**Status:** all screens work end to end using sample people stored on the phone. The in-person connect (Bluetooth, with a QR code fallback) is built but not yet tested on real phones. The next step is connecting it to the Supabase backend in `../supabase/`.

## What's in here

| Folder | What it is |
|---|---|
| `src/app/` | The screens. Each file is one screen, for example `verify.tsx` is the ID check and `chat/[id].tsx` is a chat. |
| `src/app/(tabs)/` | The three tabs: Home, Requests, Me. |
| `src/components/ui.tsx` | Shared building blocks: buttons, cards, chips, toggles. |
| `src/lib/` | The rules: age bands, matching, blocking contact details in chat, the connect codes and checks. Covered by tests. |
| `src/handshake/` | The in-person connect: Bluetooth (`ble.ts`), location, the server calls (`api.ts`, with a stand-in for the demo build) and the `useHandshake` hook the Connect screens use. |
| `src/store/AppStore.tsx` | What the app remembers. Each action is marked where it will call the backend. |
| `src/theme.ts` | Colours (light and dark) and fonts. |

## Running it

You need Node.js installed. Then, in this folder:

```bash
npm install
npm start        # then scan the QR code with the Expo Go app on your phone
npm test         # runs the rules tests
npm run typecheck
```

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

1. Connect the store to Supabase: accounts, profiles, objectives, matches, chat.
2. ID verification provider (for example Stripe Identity or ConnectID).
3. Test the Bluetooth connect on two phones with a development build, and tune the limits.
4. Parent app: either a separate app or a parent mode in this one.
5. In-app purchases (RevenueCat) for the $5 and $10 plans.
6. Push notifications for requests, approvals and messages.
7. App Store and Google Play accounts, icons, store listings and privacy labels.
