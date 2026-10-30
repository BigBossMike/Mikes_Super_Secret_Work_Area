# Intro – ID check provider comparison

27 October 2026. Desk research from vendor pages, docs and press, sources at the end. Prices and policies change; confirm in writing before signing.

## What Intro needs from the provider

1. Everyone 16 and over verified, 16 and 17 year olds included.
2. Two ways in (eSafety: government ID must never be the only way): a bank check, or photo ID plus a liveness selfie.
3. Australian documents: driver and learner licence, passport, Proof of Age card.
4. Date of birth returned, so Intro can set the age band and age ranges.
5. The selfie available or compared, so the profile photo can be matched to a real face.
6. One person, one account: the same document or face can't verify a second account.
7. Intro keeps only "verified" and the date of birth. The provider keeps no more than it must, in Australia if possible.
8. Works in the Expo app (a development build is fine).
9. Cost per check that a free user can carry.

## The four, side by side

| | Stripe Identity | Persona | Yoti | ConnectID (AP+) |
|---|---|---|---|---|
| What it is | Document and selfie checks from Stripe | Full identity platform: documents, selfie, databases, workflows | Identity and age platform: documents, selfie, liveness, age estimation | Bank-based identity exchange run by Australian Payments Plus. Not a standalone provider for Intro: reached through a partner |
| 16–17 year olds | Terms bar anyone under 16, so 16+ is allowed on paper. The docs also return an "under supported age" error described as below the age of majority. Confirm 16 and 17 in writing. | Not stated for documents. ConnectID age checks via Persona are over-16 or over-18. Ask. | Proven with teens: Yubo uses Yoti from age 13. | Available to most people over 16 with an account at a participating bank (NAB). |
| Australian documents / bank | Document checks cover Australia (passports widely; licences vary). No bank check. No DVS. | Documents yes. DVS unconfirmed. ConnectID bank check integrated April 2026. | Documents yes. Australian Government DVS listed as a data source. ConnectID added 2026. | Bank check only: CommBank, NAB, ANZ Plus, Westpac. No documents uploaded. |
| Liveness and face match | Selfie matched to the document photo, with presentation-attack checks. | Selfie, liveness, face match. | Liveness certified iBeta Level 3, injection-attack detection, NIST-ranked face match. | None. No selfie, so nothing to match the profile photo against. |
| Date of birth returned | Yes (verified outputs: name, DOB, address). | Yes. | Yes. | Yes with consent (name, DOB), or an over-16/ over-18 answer only. |
| One person, one account | No built-in duplicate check. Intro would hash the document number server-side. | Ask. Persona markets duplicate and fraud link detection. | Ask. | The bank identity is one per person. |
| Price (AUD, approx) | A$2.00 per successful verification, no monthly fee, first 50 free. Custom over 2,000 a month. | Reported US$250 a month on a 12-month minimum, billed per verification, plus a startup program that can waive it. Quote needed. | Quote only. Third parties estimate US$1.50–3 a check. Expect a minimum. | Not published. Comes bundled through Persona or Yoti. |
| Expo app | Official React Native SDK (development build). Server creates the session. | react-native-persona (development build). | Hosted web session in a web view, or native iOS/ Android SDKs. No React Native SDK. | Through the partner's SDK. |
| Data | Images kept by Stripe; redaction API deletes on request (up to 4 days). Hosted overseas. | Configurable retention. Ask about Australian hosting. | Deletes selfie and document after the check for age-only flows; can keep the liveness image if asked. Australian office. | ConnectID sees and stores nothing; the bank holds the identity. |
| Watch-outs | No bank door, so government ID would be the only way unless a second vendor is added. | Minimum term. | Fined €950,000 in Spain (March 2026, under appeal) and pulled its consumer app there. | Teens without a bank account at the four banks can't use it. |

## Against Intro's list

| Need | Stripe | Persona | Yoti | ConnectID |
|---|---|---|---|---|
| 1. 16+ including teens | Confirm | Ask | Yes | Yes (16+, with a bank account) |
| 2. Two ways in | No (documents only) | Yes (documents + ConnectID) | Yes (documents + ConnectID) | One way only |
| 3. Australian documents | Yes | Yes | Yes | n/a |
| 4. Date of birth | Yes | Yes | Yes | Yes |
| 5. Selfie for the profile-photo match | Yes (via the session's files) | Yes | Yes (ask to keep the liveness image) | No |
| 6. One person, one account | Build it (hash the document number) | Ask | Ask | Yes |
| 7. Minimal data, Australia | Redaction API; overseas | Ask | Deletes after check; Australian office | Nothing stored |
| 8. Expo | Yes, official | Yes | Web view or native SDK | Via partner |
| 9. Cost for a free user | A$2 | Unknown, monthly minimum | Unknown | Unknown |

Note 1 – The profile-photo match is Intro's own step. Providers match the selfie to the ID; Intro then compares the stored profile photo to that selfie (a second call to the same provider, or a face-comparison service).

Note 2 – Facial age estimation (Yoti) gives an age band, not a date of birth, and is least accurate around 16 to 18. It can be a pre-check, not the check.

## Options

1. Stripe Identity for the pilot. Cheapest (A$2 a check, no monthly fee), official React Native SDK, documents and selfie only. Confirm 16 and 17 year olds in writing first. Add a bank door before public launch.
2. Yoti. Both doors in one vendor, proven with teens, DVS as a data source, strong liveness. Quote only; expect a minimum.
3. Persona. Both doors in one vendor, React Native SDK, startup program may cover the pilot. Otherwise a 12-month minimum.

Decision (30th October 2026): Stripe Identity for the pilot. Built and waiting on Stripe keys (`CLAUDE.md`, Mike's side 2). A bank check through Yoti or Persona before public launch.

Recommendation: ask Yoti and Persona for a pilot quote (500 checks, teens included, ConnectID switched on, data kept in Australia). If neither comes in under approx A$1,500 for the pilot year, start with Stripe and add the bank door later.

## Questions for each vendor

1. Are 16 and 17 year olds allowed to be verified? In writing.
2. Australian learner licence and Proof of Age card accepted?
3. Is the DVS check included, and at what price?
4. Does it detect the same person verifying a second account?
5. Can Intro get the date of birth and the selfie (or a face-match against a photo Intro supplies)?
6. Where is the data stored, for how long, and can Intro set deletion after the check?
7. ConnectID: is it switched on for Australian customers, and does it work for 16 and 17 year olds?
8. Pilot pricing for 500 checks, and the minimum term.

## Sources

- [Stripe Identity Australia](https://stripe.com/au/identity)
- [Stripe Identity verification checks](https://docs.stripe.com/identity/verification-checks)
- [Stripe Identity Verification Sessions API](https://docs.stripe.com/identity/verification-sessions)
- [Stripe Identity React Native SDK](https://stripe.dev/stripe-identity-react-native)
- [Stripe Identity terms](https://stripe.com/en-my/legal/identity)
- [Content Snare: Stripe Identity and minors](https://contentsnare.com/help/knowledge-base/why-cant-a-minor-complete-id-verification-proof-of-identity/)
- [Persona React Native SDK guide](https://docs.withpersona.com/react-native-sdk-v2-integration-guide)
- [Persona pricing (third party)](https://www.vendr.com/marketplace/persona)
- [Persona and ConnectID, April 2026](https://www.biometricupdate.com/202604/persona-integrates-with-connectid-for-age-checks-through-australian-payments-network)
- [Yoti identity verification](https://www.yoti.com/business/identity-verification/)
- [Yoti adds ConnectID](https://thepaypers.com/fraud-and-fincrime/news/yoti-adds-connectid-to-its-age-assurance-platform-in-australia)
- [Yoti review 2026 (Spain fine)](https://startwithidentity.com/vendors/identity-verification/yoti/)
- [Internet Matters: Yubo and Yoti](https://www.internetmatters.org/hub/news-blogs/yubo-formerly-yellow-social-media-app-parents-need-know/)
- [ConnectID (Australian Payments Plus)](https://www.auspayplus.com.au/solutions/connectid)
- [NAB: ConnectID](https://www.nab.com.au/help-support/connectid-your-digital-identity)
- [CommBank: ConnectID](https://www.commbank.com.au/digital-banking/connect-id.html)
- [Government fact sheet: social media minimum age, January 2026](https://www.infrastructure.gov.au/sites/default/files/documents/social-media-minimum-age-fact-sheet-january-2026.pdf)
- [LSJ: eSafety guidance on age assurance](https://lsj.com.au/articles/new-guidance-released-ahead-of-social-media-minimum-age-laws/)
- [Attorney-General's Department: Document Verification Service](https://www.idmatch.gov.au/node/1106)
