# Intro

Working name for a mobile app that helps people make real-world connections.

Lots of people struggle to find someone for a specific thing: a partner for the school formal, someone to watch a movie with, a player for the Tuesday night football team. Social media is full of fake profiles and doesn't help you actually meet. Intro is built to get people off the app and into real life.

## Try the prototype

Open [`prototype/index.html`](prototype/index.html) in any web browser (double-click it after downloading). It's a clickable mock-up with fake data: no accounts, no ID upload, no payments.

## How it works

1. **Sign up (16+ only).** Every user verifies their age with photo ID and a selfie.
2. **Answer profile questions.** Interests, suburb, when you're free, and optional extras. This is what matching uses.
3. **Set one objective a month.** For example, "I need a partner for the BGS formal".
4. **Intro finds up to 5 people** whose profiles fit, and asks each one: "Can we put you forward?" They can say yes or no. People who say no are never revealed to the person asking.
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
- **Formal partners and dating.** "Partner for the formal" is close to dating. Decide if Intro allows romantic objectives, and whether gender preference is a profile question.
- **Safety features.** Report and block in every chat, a "meet somewhere public" prompt, a way to pause being put forward, and a human moderation team. For under-18s, consider an optional parent notification.
- **ID verification provider.** Use a specialist rather than building it. Options include Stripe Identity, Persona, Onfido and ConnectID (Australian). Store only "verified" and the date of birth, never the ID image.

## How the "bring phones together" connect could work

Phone-to-phone NFC is limited on iPhone, so the realistic options are:

1. **Bluetooth proximity + both press within a few seconds** (recommended). Feels like the concept: phones close, press the green button, done.
2. **QR code fallback.** One phone shows a code, the other scans it. Works on every phone.
3. **Location check** as an extra signal that both phones are in the same place.

## Suggested way to build it

For a non-developer, the shortest path to a real app on both iPhone and Android:

- **App:** React Native with Expo (one codebase, both app stores).
- **Backend:** Supabase (accounts, database, chat, file storage) with row-level security.
- **Payments:** In-app purchases through Apple and Google are required for digital subscriptions. RevenueCat makes this much easier.
- **Matching:** start with a simple points score (shared interests, distance, free time, objective type) like the prototype uses. Improve later.

A sensible first milestone is a private beta at one or two schools or sports clubs, with 16–17 and adult groups launched separately.
