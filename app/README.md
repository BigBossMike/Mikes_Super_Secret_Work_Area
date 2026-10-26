# Intro mobile app

The real Intro app, built with Expo (React Native) so one codebase runs on iPhone and Android.

**Status:** all screens work end to end using sample people stored on the phone. The next step is connecting it to the Supabase backend in `../supabase/`.

## What's in here

| Folder | What it is |
|---|---|
| `src/app/` | The screens. Each file is one screen, for example `verify.tsx` is the ID check and `chat/[id].tsx` is a chat. |
| `src/app/(tabs)/` | The three tabs: Home, Requests, Me. |
| `src/components/ui.tsx` | Shared building blocks: buttons, cards, chips, toggles. |
| `src/lib/` | The rules: age bands, matching, blocking contact details in chat. Covered by tests. |
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

## Still to do before launch

1. Connect the store to Supabase: accounts, profiles, objectives, matches, chat.
2. ID verification provider (for example Stripe Identity or ConnectID).
3. Bluetooth handshake for Connect, with a QR code fallback.
4. Parent app: either a separate app or a parent mode in this one.
5. In-app purchases (RevenueCat) for the $5 and $10 plans.
6. Push notifications for requests, approvals and messages.
7. App Store and Google Play accounts, icons, store listings and privacy labels.
