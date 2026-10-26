# Intro: market research, safety and the phone handshake

October 2026. Desk research only, from web sources listed at the end. Many "best app" roundups are written by the apps themselves, so treat rankings as opinion.

## 1. Is there anything like this already?

Nothing found that combines all of Intro's pieces: **one specific objective, up to 5 opt-in matches, chat with contact details locked, and an in-person phone tap to unlock**. Plenty of apps do one or two of these.

### Closest competitors

| App | Where | What it does | How it compares to Intro |
|---|---|---|---|
| **Friending** | US (Raleigh, NC), launched March 2026 | Matches on shared interests and distance, deliberately limits chat to push people to meet, verifies every user through a third-party ID service, and can confirm when two phones are physically near each other. | **The closest match.** Proves the idea is credible. No sign of a per-objective model or a teen offering, and not in Australia. |
| **Yubo** | Global | The largest app for teens and young adults to meet new people. Separates minors from adults, uses ID and age-estimation checks. | The main teen player, but built around live group video rooms, not meeting in person. |
| **Zeeën** | Australia, national launch 5 October 2026 | Shows nearby people with shared interests before they choose to connect. Friendship, not dating. | New local competitor for adults. No objective model or in-person unlock. |
| **Timeleft / 222** | Many cities (not all Australian) | Puts strangers around a dinner table, matched by a personality quiz. Paid per dinner or subscription. | Same "meet in real life" promise, but the app picks the event. Adults only. |
| **Bumble For Friends** | Global | Bumble's friend-finding app. Its strength is sheer number of users. | Swipe-and-chat. Doesn't push people to meet. 18+. |
| **Meetup** | Global, widely used in Australia | Interest groups and recurring events. | Groups, not 1-to-1 matching. Good for "join a team", weak for "I need one person". |
| **Bridge, BeSocial, Fluttr, Bunchups** | Australia | Small friendship or activity-buddy apps (tennis partners, walking groups, small groups of 2 to 5). | Fragmented, small user bases. Bridge's fitness-partner use is closest to "find a player". |

### What this tells us

- **The idea is credible and timely.** "Get off the app and meet" is a growing theme in 2026, and Friending launched with a very similar pitch.
- **The gap is teens plus specific objectives.** Teen apps are online-only (Yubo). Meet-in-person apps are adults-only (Timeleft, Bumble, Zeeën). Nobody focuses on "I need one person for this one thing".
- **The biggest risk is not having enough users nearby.** Several reviewers point out that the best app is simply the one with enough people near you. Launch in one tight area, like a group of schools or a sports club network, rather than all of Brisbane.

### Australian law: the under-16 social media rules

Since December 2025, platforms classed as "age-restricted social media" must keep under-16s off. eSafety lists Facebook, Instagram, Kick, Reddit, Snapchat, Threads, TikTok, Twitch, X and YouTube. Messaging, gaming and education services are mostly excluded. Fines can reach $49.5 million.

Intro's 16+ rule already fits. Whether Intro itself counts as a covered platform is a question for a lawyer. eSafety doesn't formally decide, and in the end the courts do. Either way, the ID checks Intro plans go beyond what the law asks.

## 2. Parent controls for under-18s (now in the prototype)

- **Parent sign-off at sign-up.** A 16 or 17 year old can't finish signing up until a parent or guardian approves in a free parent app.
- **The parent can see:** each objective (and can approve it before anyone is asked), who their teen was matched with (first name, age, suburb), when and roughly where they met someone, and any safety reports.
- **The parent can't see chats.** This keeps teens' trust, so they don't just switch to Snapchat. If anyone reports a problem, the parent is told straight away.
- **Meet-up check-in.** Before a first meet-up, the teen shares the place and time with their parent.
- **Pause.** A parent can pause their teen's account at any time.

## 3. Protecting people from being ganged up on

The risk: a group (for example from the same school) uses Intro to find, lure or embarrass one person. Protections, most of them now in the prototype:

1. **No searching or browsing.** You can't look anyone up. Intro picks the matches.
2. **Nobody is named until they say yes.** The person who set the objective sees "Someone nearby" until a match agrees. People who pass are never revealed, so the app can't be used to find out who's on it.
3. **"Who'll be there?" is required.** Every objective states how many people will turn up (Just me, Me + 2 others, and so on). The person being asked sees this before deciding. No surprise groups.
4. **Keep my school out.** A setting to never be matched with people from your own school.
5. **One verified person, one account.** ID checks stop fake profiles and pile-ons from second accounts.
6. **Group-pattern detection** (for the real app). If people who already know each other, such as accounts that have tapped phones, keep setting objectives that land on the same person, Intro stops matching them and flags it for a human to review. Each person can also only receive a limited number of requests per week.
7. **Objective screening.** Objectives are checked for mocking, sexual or targeting language before anyone sees them.
8. **No precise location.** Only suburb and rounded distance are shown, with no live location. The first meet-up should be at a public place.
9. **The connect is one-to-one.** Two phones, both people pressing at the same time. It can't be used to scan a room or a crowd.
10. **Report and block in every chat**, with reports involving under-18s handled first.

## 4. How the phone handshake works on iPhone and Android

The goal is to prove two phones are physically together and both people agree to swap details.

### What doesn't work well

- **NFC phone-to-phone.** iPhones don't let apps do phone-to-phone NFC like Apple's own NameDrop, and Android Beam was removed years ago. NFC works for reading tags, but it's unreliable as a two-way handshake between an iPhone and an Android.
- **AirDrop, NameDrop, Quick Share.** These are built into the phone. Other apps can't use them.

### Recommended: Bluetooth plus the server (works on every phone)

1. Both people open the chat and tap **Connect**. Each phone starts sending a short, single-use code over Bluetooth Low Energy (BLE) and listening for the other's.
2. Each phone reports the code it heard and how strong the signal was. A very strong signal means the phones are almost touching.
3. Intro's server unlocks details only if all of these are true:
   - both people pressed within about 10 seconds of each other
   - each phone heard the other's current code
   - the signal was strong
   - GPS puts them in the same spot
4. Codes change every few seconds and work once, so they can't be screenshotted or relayed from somewhere else.

BLE is standard on every modern iPhone and Android. Because the app has to be open and on screen, iPhone's background Bluetooth limits don't matter.

### Extra precision on newer phones (optional)

Ultra Wideband (UWB) chips in newer iPhones and some Samsung and Pixel phones measure distance to within centimetres. Apple publishes a spec for working with other UWB devices, and open-source add-ons already connect iPhone and Android UWB. But not every phone has the chip, so treat UWB as a bonus, not the main method.

### Fallback: QR code

One phone shows a QR code that changes every few seconds. The other phone scans it. Scanning proves the phones are together. It works on any phone with a camera and is the backup when Bluetooth is off or flaky.

## Sources

- [TechCrunch: apps promising to help make new friends (April 2026)](https://techcrunch.com/2026/04/05/as-people-look-for-ways-to-make-new-friends-here-are-the-apps-promising-to-help/)
- [The Next Web: Friending launches with in-person meetings](https://thenextweb.com/news/friending-app-loneliness-real-world-friendships)
- [Timeleft: best apps to make friends in 2026](https://timeleft.com/blog/best-apps-to-make-friends/) (vendor)
- [Introvrs: friend matching apps compared](https://www.introvrs.com/blog/friend-matching-apps) (vendor)
- [LIVIN.ROOM: best apps to make friends in real life](https://enterlivinroom.com/guides/best-apps-to-make-friends/) (vendor)
- [The Wknd Club: apps Gen Z is actually using](https://the-wknd.club/news-vision/best-way-to-meet-new-people-2026/)
- [Yubo on the App Store](https://apps.apple.com/us/app/yubo-chat-meet-make-friends/id1038653883)
- [Best teen chat apps 2026](https://befriend.cc/2026/01/02/top-5-teen-chat-apps-to-chat-safely-in-2026/) (vendor)
- [IT Brief Australia: Zeeën launches](https://itbrief.com.au/story/zeeen-launches-app-to-help-australians-make-friends)
- [Canberra Times: Fluttr](https://www.canberratimes.com.au/story/6881500/canberrans-launch-app-to-connect-people-online-and-in-person/?cs=14225)
- [Bunchups: apps for meeting friends](https://bunchups.com.au/blog/best-apps-for-meeting-friends-with-similar-interests-what-actually-works) (vendor)
- [eSafety: which platforms are age-restricted](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions/which-platforms-are-age-restricted)
- [eSafety: social media minimum age FAQs](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions/faqs)
- [Dept of Infrastructure: Social Media Minimum Age fact sheet, January 2026](https://www.infrastructure.gov.au/sites/default/files/documents/social-media-minimum-age-fact-sheet-january-2026.pdf)
- [eSafety: March 2026 compliance update](https://www.esafety.gov.au/sites/default/files/2026-03/SocialMediaMinimumAgeComplianceUpdateMarch2026.pdf)
- [Apple: Nearby Interaction with UWB Interoperability Specification](https://developer.apple.com/download/files/Nearby-Interaction-with-UWB-Interoperability-Specification-R3.pdf)
- [Capgo: cross-platform UWB plugin](https://capgo.app/docs/plugins/uwb/)
- [Estimote: Apple U1 API and UWB](https://blog.estimote.com/post/676268055242883072)
- [Google Nearby developer docs](https://developers.google.com/nearby)
