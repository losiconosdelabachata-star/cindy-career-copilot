# Cindy Career Copilot — to-do list

© 2026 All Rights Reserved: Cindy Santos · Powered by Eclat Universe

## Google Play Console (do later)
- [ ] **Wait for Google's review** of the closed test (version 1). They email the account owner. Forward me anything they ask.
- [ ] **Add testers to the closed track** — need **12+ Google accounts** (Test and release → Testing → Closed testing → Testers). Send them the closed-test link once the track is Active, or have them use the computer method (play.google.com/store/apps/details?id=com.cindycareercopilot.app → "Install on more devices").
- [ ] **Keep testers opted in for 14 days in a row**, then click **Apply for production access** on the Dashboard.
- [ ] **Upload version 3** (1.0.2: The Cindy Bot avatar, dropdown menu, 83 languages, footer). File: `Documents\cindy-play-upload-v3undleeleasepp-release.aab`. Upload to **Internal testing** first (instant), and to **Closed testing** after the current review finishes. Next build needs version code 4 or higher.
- [ ] **Update the Play listing's full description** (also change the language line to: "Use it in your own language: English, Spanish, French, Portuguese, Haitian Creole, Arabic, Chinese, Vietnamese and 70+ more.") — the last line should read: `© 2026 All Rights Reserved: Cindy Santos · Powered by Eclat Universe` (Grow users → Store presence → Store listings).
- [ ] **Android developer verification:** after the app is approved, Play Console → Test and release → App integrity shows Google's **app signing key** fingerprint. Add that SHA-256 under Android developer verification too. Check the "In review" status on the upload key.
- [ ] Optional: tablet screenshots (ask me to generate 7" and 10" sets), Spanish store listing.
- [ ] Update the **Data safety** form if the app starts collecting new kinds of data.

## Testing (Marino and team)
- [ ] Marino tests on his phone: icon, sign-in, lock, test reminder, privacy sheet, delete account. Send me anything that looks wrong.
- [ ] Try the **Practice run** on one of your own jobs, with Application answers filled in (Profile tab).

## Apple (when ready)
- [ ] Apple Developer account ($99/year) → follow `native-app/APP-STORE-GUIDE.md`.

## Product ideas
- [ ] Trademark the Cindy Career Copilot name/logo (not registered yet).
- [x] ~~Spanish translations for Cindy's longer replies and new tabs~~ — done: 83 languages via the language picker.
- [ ] Have native speakers review the most-used languages (Spanish, Haitian Creole, Portuguese, French, Arabic) — translations are machine-made; the "(beta)" ones are weaker.
- [ ] Optional: make the repo private if you want stricter protection than "all rights reserved".

## Housekeeping
- [ ] Back up `Documents\cindy-keys\cindy-upload-key.keystore` + its password in two places. **Never share it.**
- [ ] Delete the old GitHub tokens that were pasted into chat earlier (github.com/settings/personal-access-tokens) if not already done.
