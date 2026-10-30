# Intro – App Store and Google Play listing

Draft 28th October 2026. Written to match the app as built. Holds are numbered at the end.

## Listing

| Field | Limit | Text |
|---|---|---|
| App name | 30 | Intro [Hold 1] |
| Subtitle (Apple) | 30 | One plan. Real people. |
| Short description (Google) | 80 | Set a plan, get paired with people who are keen, meet in person. |
| Promotional text (Apple) | 170 | Extending a digital hand in a modern world. Set a plan and Intro asks up to five well-matched people in Brisbane if they're keen. |
| Keywords (Apple) | 100 | plans,meet,people,activities,brisbane,sport,trivia,walking,dinner,club,team,group,local |
| Category | | Social Networking (primary), Lifestyle (secondary) |
| Price | | Free to download. Subscription: 7-day free trial, then A$7.99 a month |

## Description

Got a plan that needs one more? A fifth player for Tuesday football, someone for a midweek dinner, a walking buddy for early mornings, a fourth for trivia.

Intro works like putting your name down at the club and getting paired up.

How it works:

- Set a plan. Say who'll be there ("Me + 2 others").
- Intro asks up to 5 well-matched people if they're happy to be put forward.
- You see who they are only once they say yes. People who pass stay anonymous.
- Chat to sort out the details. Numbers and socials unlock when you meet and tap phones.

Private by design:

- Nobody can browse or search Intro.
- People in your phone contacts are never paired with you.
- Keep your school or workplace out of your matches.
- Everyone is ID checked.

For everyone 16 and over:

- 16 and 17 year olds are only ever paired with other 16 and 17 year olds, with a parent's OK.
- Adults are only ever paired with adults, inside the age range both people set.

Price:

- 7-day free trial, then $7.99 a month to set as many plans as you like.
- Being asked to join someone else's plan is always free.

Now in Brisbane.

## Age rating

| Store | Answer |
|---|---|
| Apple | 16+. Answers: user-generated content and messaging between users (yes), unrestricted web access (no), mature or suggestive themes (none), gambling (no), contests (no). |
| Google Play | IARC questionnaire: users interact (yes), shares location (yes, only at connect), in-app purchases (yes). Target audience: 16-17 and 18+. |

Note 1 – The store rating doesn't check anyone's age. Intro's own ID check does.

## Privacy answers (Apple privacy labels, Google Data safety)

Tracking across other companies' apps: none. No advertising, no analytics or crash-reporting kits in the app today.

| Data | Apple type | Collected for | Linked to the person |
|---|---|---|---|
| Email address | Contact Info: Email Address | App functionality (sign-in, parent invites) | Yes |
| Mobile number (optional) | Contact Info: Phone Number | App functionality (shared after meeting, hide me from my contacts) | Yes |
| First name; full name if shared after meeting | Contact Info: Name | App functionality | Yes |
| Instagram handle if shared after meeting | Contact Info: Other User Contact Info | App functionality | Yes |
| Profile photo | User Content: Photos or Videos | App functionality | Yes |
| Chat messages | User Content: Emails or Text Messages | App functionality, safety review of reported chats | Yes |
| Plans, interests, free times, school or workplace | User Content: Other User Content | App functionality | Yes |
| Location at the moment of Connect | Location: Precise Location | App functionality (same-place check) | Yes |
| Fingerprints of phone contacts | Contacts | App functionality (hide me from my contacts) | Yes |
| Cultural background (optional) | Sensitive Info | App functionality (matching) | Yes |
| Date of birth, verified status | Other Data Types | App functionality (age groups) | Yes |
| Account id | Identifiers: User ID | App functionality | Yes |
| Push token | Identifiers: Device ID | App functionality (notifications) | Yes |
| Plan and purchases | Purchases: Purchase History | App functionality [Hold 2] | Yes |

Google Data safety: same list. Data is encrypted in transit. People can ask for their data to be deleted (in the app or by email [Hold 3]). Data is not sold or shared with third parties for their own use.

## Review notes for Apple

- Sign-in: email and a 6-digit code. Review account: [Hold 4] (an email Apple can receive the code at, or a review-only build with a test number).
- The in-person Connect needs two phones together. Reviewers can use the QR code option on one phone, or watch the demo video [Hold 5].
- Bluetooth and location are used only at the moment of Connect.

## Still needed

| # | Hold |
|---|---|
| 1 | "Intro" may be taken on the App Store. Check in App Store Connect; fall back to "Intro – plans with people". |
| 2 | Purchase history only once in-app purchases are built (RevenueCat). Leave it off until then. |
| 3 | Support email for deletion requests (same as Privacy Policy Hold 8). |
| 4 | A review test number and code, set in Supabase like the pilot test numbers. |
| 5 | A short screen recording of two phones connecting. |
| 6 | Screenshots: 6.9" and 6.5" iPhone, plus Android phone. Home, a request, matches, locked chat, Connect, connected. |
| 7 | Privacy Policy and Terms of Use published at a public web address (both stores need the links). |
| 8 | App icon and splash screen: draft done (`docs/brand/icon-and-splash-preview.png`); Mike to approve or replace. |
