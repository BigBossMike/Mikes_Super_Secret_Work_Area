# Intro: ID checks, fake accounts and AI

October 2026. Desk research, sources at the end. Vendor claims are marked as such. Get legal advice before choosing a provider.

## 1. Can we do age verification ourselves?

**Short answer: build the experience, use a specialist for the checking.** Doing the check in-house is possible in theory, but it's the wrong place to spend money and risk.

Why use a provider:

- **Fakes are an arms race.** Spotting edited IDs, photos of screens, masks and deepfake selfies is a full-time specialist job, and the attacks keep changing.
- **Government records go through a gateway anyway.** Checking an Australian licence or passport against official records uses the Document Verification Service (DVS). It answers "match or no match" and is accessed through approved providers.
- **Face data is sensitive information.** Under the Privacy Act, biometric information carries extra legal duties. The privacy regulator (OAIC) published guidance on age-assurance technology in March 2026. A provider that hands back only "verified, date of birth" keeps the face data off Intro's servers.
- **The regulator wants choice.** eSafety's guidance says to layer approaches, and that platforms can't make a government ID document the only option.

### Recommended set-up

Offer two ways in, and let people pick:

1. **Bank check (ConnectID).** People confirm their age through their own banking app. No documents are uploaded. Providers such as Persona and Yoti now offer this, and Snapchat and Reddit reportedly already use ConnectID. **To confirm with the provider:** whether it works for 16 and 17 year olds' bank accounts.
2. **Photo ID plus selfie.** The provider checks the ID (including the DVS), runs a liveness check on the selfie, and matches the selfie's face to the ID photo.

**What Intro keeps:** "verified", the date of birth (needed for age groups and age ranges) and the provider's reference number. It never keeps the ID image or face data.

## 2. Matching ID to selfie to stop fake accounts

Yes. This is standard practice and worth doing. The layers:

1. **Liveness selfie at sign-up.** Proves a real person is holding the phone, not a photo, a video or a deepfake.
2. **Selfie matched to the ID photo.** Proves the ID is theirs.
3. **Profile photo matched to the verified selfie.** Proves the photo other people see is really them, which stops catfishing. Show a small "Photo verified" tick.
4. **One person, one account.** The provider flags an ID or face that's already on another account. This also stops second accounts being used to gang up on someone.
5. **Re-check when something changes:** a new phone, a long gap, or a report.

People who verify through their bank still do a quick selfie, so their profile photo can be checked.

## 3. How AI can make Intro better

| Where | What AI does | Guardrail |
|---|---|---|
| **Making a plan** | Turns "golf sunday?" into a clear plan with a suggested time, a public place and group size. Flags anything that reads like dating or singling someone out. | Suggestions only. The person edits and sends. |
| **Matching** | Understands similar interests ("bouldering" and "climbing", "padel" and "tennis"). Learns which pairings actually lead to people meeting, and favours those. | Hard rules always win: age ranges, age groups, hidden contacts, school or workplace. |
| **Safety in chat** | Catches disguised contact details ("zero four one two…", "find me on the gram"), pressure, scams, grooming patterns and dating. | Flags go to a person on the safety team. AI never makes the final call on a serious case. |
| **Fake accounts** | Spots AI-generated photos and bot-like behaviour, on top of the ID and selfie checks. | Appeals go to a person. |
| **Ganging up** | Spots several accounts aiming requests at the same person. | Stops matching and flags for review. |
| **First meet-up** | Suggests a public spot halfway between people, and a couple of easy openers from shared interests. | Optional. |
| **After meeting** | A quick "How did it go?" improves future pairings and catches problems early. | Answers are private and never shown to the other person. |
| **Parent app** | A short, plain-English weekly summary for parents of 16 and 17 year olds. | Never includes chat content. |

**Ground rules for AI at Intro:**

- Say plainly in the privacy policy what's scanned and why.
- Only scan chats for safety.
- Never send AI-written messages as if the person wrote them.
- People make the serious decisions.

Large language models such as Claude can do the plan helper, interest matching and moderation through an API.

## Sources

- [Biometric Update: Persona integrates with ConnectID (April 2026)](https://www.biometricupdate.com/202604/persona-integrates-with-connectid-for-age-checks-through-australian-payments-network)
- [Biometric Update: Yoti adds ConnectID (October 2026)](https://www.biometricupdate.com/202610/yoti-adds-connectid-bank-verification-to-its-age-assurance-product-in-australia) (includes vendor claims)
- [Biometric Update: Australia clarifies online age check expectations](https://www.biometricupdate.com/202509/australia-clarifies-online-age-check-expectations-with-regulatory-guidance)
- [OAIC: privacy guidance on age assurance technologies (17 March 2026)](https://www.oaic.gov.au/__data/assets/pdf_file/0017/262043/OAIC-privacy-guidance-on-age-assurance-technologies.pdf)
- [Didit: DVS guide](https://didit.me/blog/dvs-validation-australia-document-verification-service/) (vendor)
- [Biometric Update: liveness detection for national digital ID](https://www.biometricupdate.com/202604/australia-plans-biometric-liveness-detection-refresh-for-national-digital-id)
