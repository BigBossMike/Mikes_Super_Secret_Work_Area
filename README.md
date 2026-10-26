# Intro

Working name for a mobile app that helps people make real-world connections.

Lots of people struggle to find someone for a specific thing: a player for the Tuesday night football team, someone to see a movie with, a study partner before exams. Social media is full of fake profiles and doesn't help you actually meet. Intro is built to get people off the app and into real life.

**Who it's for:** teens and young adults who find it hard to make new connections, not the ones who already have 1,000+ followers. No followers, likes or feed. Parents are the main way in. See the [Brisbane launch plan](docs/launch-plan.md).

## What's in this repo

| Folder | What it is |
|---|---|
| [`app/`](app/) | The real mobile app (Expo / React Native, iPhone and Android). All screens work with sample data. |
| [`supabase/`](supabase/) | The backend: database, security rules, matching and the in-person handshake. |
| [`prototype/`](prototype/) | The original clickable mock-up. Open `prototype/index.html` in any browser. |
| [`docs/`](docs/) | [Research](docs/research.md) (competitors, safety, phone handshake) and the [launch plan](docs/launch-plan.md). |

## How it works

1. **Sign up (16+ only).** Every user verifies their age with photo ID and a selfie. Under-18s also need a parent or guardian to approve.
2. **Answer profile questions.** Interests, suburb, when you're free, and optional extras. This is what matching uses.
3. **Set one objective a month.** For example, "A fifth player for our Tuesday night five-a-side team". Every objective says who'll be there (just me, me + 2 others, and so on).
4. **Intro finds up to 5 people** whose profiles fit, and asks each one: "Can we put you forward?" They can say yes or no. Nobody is named to the person asking until they say yes, and people who pass stay anonymous.
5. **Chat to plan a meet-up.** Only first name and profile photo are visible. Phone numbers, emails, social handles and links are blocked in chat.
6. **Meet in person and connect.** Bring the two phones together with the app open and both press the big green **Connect** button. Only then are contact details unlocked.
7. **Carry on in real life.** The objective is marked complete. The app's job is done.

## Pricing (AUD)

| Plan | Price | What you get |
|---|---|---|
| Free | $0 | 1 objective per month. Being put forward is always free. |
| Extra objective | $5 each | One more objective on top of the free one. |
| Unlimited | $10 / month | As many objectives as you like. |

> I read "$5 / objectives per month" as **$5 per extra objective**. If you meant a $5 monthly tier with a set number of objectives (say 3 a month), that's a one-line change in the prototype.

## Things to decide before building for real

These came up while building the prototype. They matter most because the app allows 16 and 17 year olds.

- **Keep minors and adults apart.** The prototype only ever matches 16–17 year olds with other 16–17 year olds, and adults with adults. Letting adults be matched with minors on a "meet in person" app is a serious child safety risk and would likely be blocked by Apple and Google. Strongly recommend keeping this rule.
- **Australian law.** Australia's social media minimum age rules (in force since December 2025) set 16 as the floor, which fits Intro's age limit. Get legal advice on whether Intro counts as an "age-restricted social media platform", what age assurance steps you must take, and your duties under the Online Safety Act's codes for services used by under-18s.
- **Ethnicity is sensitive information.** Under the Privacy Act, racial or ethnic origin needs explicit consent and extra care. Matching on it can also look discriminatory. The prototype makes it optional and private. Consider dropping it, or only using it when someone asks for it on a specific objective (for example, a cultural group activity).
- **Event partners and dating.** "Someone to go to the formal with" is close to dating. Decide if Intro allows romantic objectives, and whether gender preference is a profile question.
- **Safety features.** Report and block in every chat, a "meet somewhere public" prompt, a way to pause being put forward, "keep my school out", a human moderation team, and parent controls for under-18s (see `docs/research.md`).
- **ID verification provider.** Use a specialist rather than building it. Options include Stripe Identity, Persona, Onfido and ConnectID (Australian). Store only "verified" and the date of birth, never the ID image.

## Research, safety and the phone handshake

See [`docs/research.md`](docs/research.md) for:

- competitors (closest: Friending in the US, Yubo for teens, Zeeën in Australia)
- parent controls for under-18s
- protections against people ganging up on someone
- how the phone-to-phone connect works across iPhone and Android (Bluetooth plus a server check, with a QR code fallback)

## Suggested way to build it

For a non-developer, the shortest path to a real app on both iPhone and Android:

- **App:** React Native with Expo (one codebase, both app stores).
- **Backend:** Supabase (accounts, database, chat, file storage) with row-level security.
- **Payments:** In-app purchases through Apple and Google are required for digital subscriptions. RevenueCat makes this much easier.
- **Matching:** start with a simple points score (shared interests, distance, free time, objective type) like the prototype uses. Improve later.

A sensible first milestone is a private beta at one or two schools or sports clubs, with 16–17 and adult groups launched separately.
