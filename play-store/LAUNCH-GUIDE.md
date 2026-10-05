# Cindy Career Copilot — Google Play launch guide

**© 2026 All Rights Reserved: Cindy Santos · Powered by Eclat Universe**

The Play Store app is now the **native build** (Capacitor 8, targets Android 16 / API 36 as Google requires). It's the same app as the
iPhone version: it ships its own copy of the web app (opens instantly), talks to the same servers, and includes the
**Face ID / fingerprint lock** and **reminder notifications**. GitHub builds it for you — nothing to install on your PC.

## What's already done

| Need | Where |
|---|---|
| Native Android project (API 36, minSdk 24, allowBackup off) | `native-app/android` |
| App icon (adaptive + legacy) and launch screen from the logo | `native-app/resources/android` |
| Build pipeline — tested, produced a real 7.5 MB `.aab` | GitHub → Actions → **android-build** |
| Privacy policy URL | https://cindy-career-copilot.pages.dev/privacy |
| Terms URL | https://cindy-career-copilot.pages.dev/terms |
| **Account-deletion URL** (Play requires one) | https://cindy-career-copilot.pages.dev/delete-account — plus in-app: Profile → Delete my account |
| Play icon 512×512 | `play-store/app-icon-512.png` |
| Feature graphic 1024×500 | `play-store/feature-graphic-1024x500.png` |
| 6 phone screenshots (1080×2160) | `play-store/screenshots/` |
| Copyright / ownership notice | `LICENSE`, README, app footer (with logo), privacy/terms pages |

## What only you can do

### 1. Google Play Developer account
https://play.google.com/console — one-time $25 fee plus identity verification. Use the name **Cindy Santos** (or her business) as the developer name.
Note: *personal* accounts created recently must run a **closed test with a minimum number of testers (currently 12) for 14 days** before publishing
to production — check the current rule in Play Console. Organization accounts skip that but need a D-U-N-S number.

### 2. Make your upload key (once)
PowerShell, in a safe folder. It asks you to choose a password and answer a few questions; at "key password" just press Enter:
```
keytool -genkeypair -v -keystore cindy-upload-key.keystore -alias cindy-upload -keyalg RSA -keysize 2048 -validity 10000
```
**Back this file up (cloud drive + USB) and never share it or its password.**

### 3. Give GitHub the key (3 secrets)
Copy the key into your clipboard as text:
```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("cindy-upload-key.keystore")) | Set-Clipboard
```
GitHub → the repo → *Settings → Secrets and variables → Actions → New repository secret*:
`ANDROID_KEYSTORE_BASE64` (paste), `ANDROID_KEYSTORE_PASSWORD` (your password), `ANDROID_KEY_ALIAS` (`cindy-upload`).

### 4. Build the app
GitHub → *Actions → android-build → Run workflow* (version code `1`; use `2`, `3`… for every later upload).
When it's green, open the run → download **`cindy-android-real-key`** → unzip → upload **`bundle/release/app-release.aab`** to Play.
(`apk/release/app-release.apk` is for installing on your own Android phone to try it. Without the three secrets the build uses a throwaway
test key — good for a trial run, but Play will reject it.)

### 5. Upload and test
Play Console → create the app (name *Cindy Career Copilot*, default language English (US), App, Free) → *Testing → Closed testing → Create release*
→ use **Play App Signing** when asked → upload the `.aab` → add testers (an email list) → roll out.
Install it from the testers' link on a real phone and check: sign-in, Apply window, Job Matches, Profile → Lock & reminders (turn on, allow notifications,
send a test reminder), Profile → Delete my account (with a throwaway account), links opening in the in-app browser.

### 6. Create a demo account
A fresh username/password (not yours) for *App content → App access*, so Google's reviewers can sign in.

## Store listing copy (paste-ready)

**App name (≤30):** Cindy Career Copilot

**Short description (≤80):**
Find jobs, apply faster, fix your credit, and find help and income — with Cindy.

**Full description (≤4000):**
```
Cindy Career Copilot is your all-in-one helper for the job hunt and the money side of life.

JOBS
• Search real openings from several job boards, including remote-only search with filters
• Save a job and Cindy writes a tailored résumé and cover letter for it in one tap
• Track every job from Saved to Interview in a clean pipeline
• Apply assistant: copy-ready details, plus an optional helper that fills the company's own application form for you
• Saved answers for common application questions — you stay in control, and anything personal or unclear is left for you
• Keep your certificates and licenses in one place, with expiry reminders

MONEY & HELP
• Credit plan: a step-by-step plan using free methods, free dispute-letter templates, and plain-English summaries of your rights
• Find help and grants by state, with a benefits estimator and a statement-of-need draft
• Loan guide: personal, business and low-documentation options, a payment calculator, and red flags for loan scams

FREELANCE & CREATOR
• Directory of freelance and remote-contract platforms, plus a proposal writer
• Creator University: free lessons on growing as a content creator, editing videos with CapCut, and going live on Twitch, Kick and YouTube
• A content-idea generator and tips from Cindy

PRIVATE & HELPFUL
• Lock the app with your fingerprint or face
• Reminders to follow up, send applications, and renew licenses — created on your phone and kept there

Works on phones and tablets. Use it in your own language: English, Spanish, French, Portuguese, Haitian Creole, Arabic, Chinese, Vietnamese and 70+ more.

Important: Cindy provides general education and tools. It is not legal, financial, tax or career advice, doesn't make or broker loans, and can't guarantee jobs, benefits, or credit-score changes. The auto-apply helper only runs when you tap it, never accepts agreements for you, and stops at CAPTCHAs and questions it can't answer.

Your data stays yours: no ads, no data selling, and you can delete your account anytime in the app.

© 2026 All Rights Reserved: Cindy Santos · Powered by Eclat Universe
```

**Category:** Business (alternatively Productivity) · **Tags:** job search, résumé, career
**Contact email:** use an email you check (required) · **Website:** https://cindy-career-copilot.pages.dev
**Privacy policy:** https://cindy-career-copilot.pages.dev/privacy
**Account deletion URL:** https://cindy-career-copilot.pages.dev/delete-account

## Policy forms — what to answer (be honest; Google checks)

- **Target audience:** 18 and over. Not designed for children.
- **Ads:** No ads.
- **Data safety → collected & processed:**
  - Personal info: name, email address, phone number (typed in by the user), user IDs (username).
  - Financial info: *none collected* (the app never asks for bank, card or SSN; credit-score *range* and income are optional tool inputs used only for the user's own plan/estimate — choose the option that matches Google's current definitions and say they're optional).
  - Other user content: résumé, cover letter, job lists, notes, chats; app activity: in-app actions saved to the user's account.
  - **Biometrics are not collected** — the lock uses Android's own fingerprint/face prompt; Cindy never receives biometric data.
  - Notifications are local reminders created on the phone.
  - Purpose: app functionality, account management. **Not sold. Not used for ads.**
  - Shared with third-party service providers to run features: Cloudflare (hosting + AI), job-listing providers (search words/location only), PolicyEngine (household size/income/state, no name).
  - Encrypted in transit: **Yes**. Users can request deletion: **Yes** (URL above and in-app).
- **App access:** provide the demo account from step 6.
- **Financial features declaration:** the app provides *educational information and links* about credit and loans and does **not** offer, broker, or originate loans or credit repair services. Answer accordingly and read Google's Financial Services policy before submitting.
- **Content rating (IARC):** no violence, no sexual content, no gambling, no user-to-user chat, no location sharing. It links to external websites. Expect an "Everyone"/"Everyone 10+"-type rating.
- **Permissions you'll be asked about:** notifications (reminders) and biometrics (lock) — both optional features the user turns on.

## Graphics to upload
- App icon: `play-store/app-icon-512.png`
- Feature graphic: `play-store/feature-graphic-1024x500.png`
- Phone screenshots (upload all 6, in order): `play-store/screenshots/1-signin.png` … `6-creator-university.png`
- Tablet screenshots (optional but recommended): ask me and I'll generate 7-inch and 10-inch sets.

## Updating the app later
- **Server-side changes** (AI, job search, auto-apply bot, accounts) reach everyone instantly — no new release.
- **Changes to the screens** (the web app bundled in the Android app): run **android-build** again with the next version code and upload the new `.aab`.
  (The website itself updates instantly for web users; the installed app updates when they get your new release.)

## Release checklist
- [ ] Developer account verified
- [ ] Upload key created, backed up, and the 3 secrets added to GitHub
- [ ] android-build run with your key; `.aab` uploaded to Closed testing
- [ ] Tested on a real Android phone (lock, reminders, delete account)
- [ ] Demo account, Data safety and App content forms complete
- [ ] 12+ testers opted in for 14 days (personal accounts) → apply for production access → promote release

## iPhone
See `native-app/APP-STORE-GUIDE.md`.
