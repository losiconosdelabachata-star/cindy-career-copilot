# Cindy Career Copilot — iPhone App Store guide

**© 2026 All Rights Reserved: Cindy Santos · Powered by Eclat Universe**

Status: **the iPhone app is built and verified to compile on Capacitor 8** (GitHub Actions → "ios-build-check" → BUILD SUCCEEDED).
What's left needs an Apple Developer account and a Mac (or a cloud Mac) to sign and upload.

## What's in this folder

| Item | Where |
|---|---|
| Native iOS project (Capacitor 8, iPhone-only) | `native-app/ios/App` |
| App icon 1024×1024 (opaque, as Apple requires) | already installed; copy at `play-store/native-app-icon-1024.png` |
| Launch screen with the logo | installed in `Assets.xcassets/Splash.imageset` |
| Native touches (in-app browser for links, haptics, Share button) | inside `index.html`, active only in the app |
| iPhone screenshots 6.9" (1320×2868) and 6.5" (1284×2778) | `play-store/ios-screenshots/` |
| Free Mac compile check | `.github/workflows/ios-build.yml` (run it any time from the Actions tab) |
| Bundle ID | `com.cindycareercopilot.app` (change in Xcode *and* `capacitor.config.json` if you want another) |

The app bundles its own copy of the web app, so screens open instantly. It talks to the same servers
(https://cindy-career-copilot.pages.dev) for accounts, jobs, AI and the bot. **To refresh the bundled copy after site changes:**
`cd native-app && npm run sync`, then upload a new build. (Server-side changes — AI, jobs, bot — update everyone instantly without a release.)

## Step 1 — Apple Developer account (you)
1. Enroll at https://developer.apple.com/programs/enroll/ — **$99/year**. Individual accounts are quickest (identity check can take a day or two).
   Organization accounts need a D-U-N-S number.
2. In **App Store Connect** → *Apps* → **+** → *New App*: platform iOS, name *Cindy Career Copilot*, language English (U.S.),
   bundle ID `com.cindycareercopilot.app` (register it first under *Certificates, Identifiers & Profiles → Identifiers*), SKU `cindy-career-copilot`.

## Step 2 — Build and upload (needs a Mac, or a cloud Mac)
On a Mac with Xcode 15+:
```
git clone https://github.com/losiconosdelabachata-star/cindy-career-copilot
cd cindy-career-copilot/native-app
npm ci
npm run sync
npx cap open ios      # opens Xcode
```
In Xcode: select the **App** target → *Signing & Capabilities* → choose your Team (automatic signing) →
set the destination to *Any iOS Device* → **Product → Archive** → *Distribute App → App Store Connect → Upload*.
Then in App Store Connect open **TestFlight**, add yourself as a tester, install on a real iPhone, and test:
sign in, Apply window, Job Matches, Profile → Delete my account, Share, links opening.

No Mac? Options: rent a cloud Mac (MacinCloud etc.), or use Codemagic / a GitHub Actions macOS runner with an
App Store Connect API key and a distribution certificate. Once you have the Apple account, ask me to wire that up.

## Step 3 — Store listing (paste-ready)

- **Name (≤30):** Cindy Career Copilot
- **Subtitle (≤30):** Jobs, résumés, credit & help
- **Promotional text (≤170):** Find jobs, tailor your résumé in one tap, track every application, fix your credit, and find help and income — with Cindy by your side.
- **Keywords (≤100):** job search,resume,cover letter,career,applications,remote jobs,credit,grants,freelance,creator
- **Description:** use the Play Store description in `play-store/LAUNCH-GUIDE.md` (it's accurate for iOS too).
- **Category:** Business (secondary: Productivity) · **Price:** Free
- **Support URL:** https://github.com/losiconosdelabachata-star/cindy-career-copilot/issues  (or your own site/email page)
- **Marketing URL:** https://cindy-career-copilot.pages.dev
- **Privacy Policy URL:** https://cindy-career-copilot.pages.dev/privacy
- **Screenshots:** upload `play-store/ios-screenshots/6.9-inch-1320x2868/*.png` (6.9" slot) and, if asked, the 6.5" set.
- **Copyright:** © 2026 Cindy Santos

## Step 4 — App Privacy ("nutrition label")
Answer *Yes, we collect data*, **no tracking**, nothing sold. Data types, all **linked to the user**, purpose **App Functionality** (and Account management):
- Contact Info: name, email address, phone number
- User Content: other user content (résumé, cover letter, job notes, chats)
- Identifiers: user ID (username)
- Financial info is **not** collected (credit-score range and income typed into tools are optional inputs used only for the user's own plan — if Apple's wording makes you unsure, disclose them under "Other Financial Info").
- Sensitive info: only the **optional, voluntary** self-identification answers the user chooses to save for applications.

## Step 5 — Review information (this is where reviews are won)
- **Sign-in required:** yes. Create a throwaway demo account (not yours) and enter it under *App Review Information*.
- **Review notes (paste):**
  > Cindy is a job-search and personal-finance education app. Users sign in with a username and password (demo account provided) to track job applications, generate tailored résumés and cover letters with AI, search real job listings, and read guides on credit, benefits and grants, loans, freelancing and content creation. The optional "auto-apply" helper only runs when the user taps it for a specific job, never accepts agreements for the user, and stops at CAPTCHAs and questions it can't answer. The app does not offer, broker or originate loans or credit repair; it links to official sources (CFPB, SBA, Benefits.gov). Account deletion is in-app: Profile → Delete my account. Content is general education, not legal, financial or career advice.
- **Age rating:** answer honestly. No unrestricted web browsing (links open specific third-party pages), no user-generated content shared between users, no gambling/violence. Expect 4+ to 12+.
- **Export compliance:** the app only uses standard HTTPS — `ITSAppUsesNonExemptEncryption` is already set to *false*.

## Risks to know about (honest)
- **Guideline 4.2 (minimum functionality):** Apple sometimes rejects apps that are "just a website in a wrapper." What helps Cindy: it ships its own bundled app, works with account data and documents, and has native extras
  (in-app browser, haptics, native share). If a reviewer pushes back, the strongest fixes are **Face ID lock** and **local notifications** (follow-up reminders, expiring licenses) — I can add either; both are a few hours of work.
- **Financial content:** keep the listing and notes accurate (education only). If your plans change to offering or brokering loans, Apple and Google both require extra disclosures and licensing.
- **Auto-apply / AI-written answers:** keep the "check the employer's rules" warnings visible.
- **Third-party sites:** LinkedIn/Indeed prohibit automation — the app already refuses them; keep it that way.

## Checklist
- [ ] Apple Developer account active ($99/yr)
- [ ] App record created in App Store Connect with bundle ID
- [ ] Build archived and uploaded; tested through TestFlight on a real iPhone
- [ ] Privacy label, age rating, screenshots, URLs, demo login filled in
- [ ] Submit for review → typically 1–3 days
- [ ] Later updates: bump the version/build in Xcode (General tab), `npm run sync`, archive, upload

## Same app as Android
The iPhone and Android apps are one codebase (`native-app/`). Both include the Face ID / fingerprint lock and reminder notifications. Android is built by GitHub (see `play-store/LAUNCH-GUIDE.md`).
