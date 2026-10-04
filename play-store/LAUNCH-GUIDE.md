# Cindy Career Copilot — Google Play launch guide

Cindy is a web app that's now installable (PWA). For Google Play we wrap it as a **Trusted Web Activity (TWA)** — a
thin Android app that opens the website full-screen, no browser bar. Updating the website updates the app instantly;
you only publish a new Play release if you change the app's icon, name, or package settings.

## What's already done (in this repo)

| Need | File / URL |
|---|---|
| Installable web app + offline shell | `manifest.webmanifest`, `sw.js` (live at https://cindy-career-copilot.pages.dev) |
| Privacy policy URL | https://cindy-career-copilot.pages.dev/privacy |
| Terms URL | https://cindy-career-copilot.pages.dev/terms |
| **Account-deletion URL** (Play requires one) | https://cindy-career-copilot.pages.dev/delete-account — plus in-app: Profile → Delete my account |
| App icon 512×512 | `play-store/app-icon-512.png` |
| Feature graphic 1024×500 | `play-store/feature-graphic-1024x500.png` |
| 6 phone screenshots (1080×2160) | `play-store/screenshots/` |
| Android wrapper settings | `play-store/twa-manifest.json` |
| Domain-verification file (needs your fingerprint) | `.well-known/assetlinks.json` |

## What only you can do

1. **Create a Google Play Developer account** — https://play.google.com/console — one-time $25 fee and identity verification.
   Note: *personal* developer accounts created recently must run a **closed test with a minimum number of testers
   (currently 12) for 14 days** before they can publish to production. Check the current rule in Play Console.
   Organization accounts skip that but need a D-U-N-S number.
2. **Build the app bundle (.aab)** — pick one:
   - **Easiest — PWABuilder:** go to https://www.pwabuilder.com, enter `https://cindy-career-copilot.pages.dev`,
     click *Package for stores → Android*, use package ID `com.cindycareercopilot.app`, and download the package.
     It generates the signing key for you — **keep that file and its password safe; you can't publish updates without it.**
   - **Command line — Bubblewrap** (needs JDK 17; it can download the Android SDK for you):
     ```
     npm i -g @bubblewrap/cli
     bubblewrap init --manifest=https://cindy-career-copilot.pages.dev/manifest.webmanifest
     bubblewrap build
     ```
     It asks you to create a keystore and passwords — you type those, nobody else should have them.
     The result is `app-release-bundle.aab`.
3. **Upload the .aab** in Play Console → *Testing → Closed testing → Create release* (use *Play App Signing* when asked).
4. **Verify the domain** (this removes the browser address bar inside the app):
   - Play Console → *Setup → App signing* → copy the **SHA-256 certificate fingerprint** of the *App signing key*.
   - Paste it into `.well-known/assetlinks.json` (replace `REPLACE_WITH_SHA256_FROM_GOOGLE_PLAY_APP_SIGNING`).
     If you also sideload builds signed with your upload key, add that fingerprint as a second entry.
   - Tell me and I'll redeploy, or run `npx wrangler pages deploy . --project-name cindy-career-copilot`.
   - Check it: https://developers.google.com/digital-asset-links/tools/generator
5. **Fill in the store listing** (copy below), upload the graphics, and answer the policy forms (notes below).
6. **Create a demo account** (a fresh username/password, not yours) and enter it under *App content → App access*
   so Google's reviewers can sign in.

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

Works on phones and tablets, available in English and Spanish (more Spanish coming).

Important: Cindy provides general education and tools. It is not legal, financial, tax or career advice, doesn't make or broker loans, and can't guarantee jobs, benefits, or credit-score changes. The auto-apply helper only runs when you tap it, never accepts agreements for you, and stops at CAPTCHAs and questions it can't answer.

Your data stays yours: no ads, no data selling, and you can delete your account anytime in the app.
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
  - Financial info: *none collected* (the app never asks for bank, card or SSN; credit-score *range* and income are optional tool inputs sent only for the user's own plan/estimate — choose the option that matches Google's current definitions and say they're optional).
  - Other user content: résumé, cover letter, job lists, notes, chats; app activity: in-app actions saved to the user's account.
  - Purpose: app functionality, account management. **Not sold. Not used for ads.**
  - Shared with third-party service providers to run features: Cloudflare (hosting + AI), job-listing providers (search words/location only), PolicyEngine (household size/income/state, no name).
  - Encrypted in transit: **Yes**. Users can request deletion: **Yes** (URL above and in-app).
- **App access:** provide the demo account from step 6.
- **Financial features declaration:** the app provides *educational information and links* about credit and loans and
  does **not** offer, broker, or originate loans or credit repair services. Answer accordingly and read
  Google's Financial Services policy before submitting.
- **Content rating (IARC):** no violence, no sexual content, no gambling, no user-to-user chat, no location sharing.
  It links to external websites. Expect an "Everyone"/"Everyone 10+"-type rating.
- **News/health/COVID/government apps:** not applicable (the app isn't affiliated with any government agency; it links to official sources).

## Graphics to upload

- App icon: `play-store/app-icon-512.png`
- Feature graphic: `play-store/feature-graphic-1024x500.png`
- Phone screenshots (upload all 6, in order): `play-store/screenshots/1-signin.png` … `6-creator-university.png`
- Tablet screenshots (optional but recommended): tell me and I'll generate 7-inch and 10-inch sets.

## Release checklist

- [ ] Developer account verified
- [ ] .aab built and uploaded to Closed testing
- [ ] SHA-256 added to `.well-known/assetlinks.json` and redeployed; Digital Asset Links check passes
- [ ] Opening the installed app shows **no address bar**
- [ ] Demo account works; Data safety + App content forms complete
- [ ] 12+ testers opted in for 14 days (personal accounts) → apply for production access → promote release
- [ ] For later updates: bump `appVersionCode` (and `appVersion`) in `twa-manifest.json`, rebuild, upload

## iPhone note

iPhone users can already add Cindy to their home screen (Safari → Share → *Add to Home Screen*) and it runs full-screen.
A real App Store listing needs a different wrapper (for example Capacitor) and an Apple Developer account ($99/year) —
say the word and I'll set that up next.
