# Career Copilot — Job Search Deck

A private, per-person job-search command deck. The page (`index.html`) is a single static
file with no build step; AI features run through a small Cloudflare Pages Function backend
(free, no API key — see "AI backend" below).

## Live site
- GitHub Pages (the page itself): https://losiconosdelabachata-star.github.io/cindy-career-copilot/
- Cloudflare Pages (same page + the AI backend): https://cindy-career-copilot.pages.dev/

Either URL works for using the app — both serve the same `index.html`. AI calls always go
to the Cloudflare Pages URL regardless of which one you're on (CORS is open for that).

## What it does

- **Accounts** — sign in with a username + password, or hit **Register** to create a new
  one. Accounts and each account's pipeline/profile live server-side (Cloudflare KV, behind
  `/api/account/*` and `/api/data` — see "Accounts backend" below), so Marino, Cindy, or
  anyone else can sign in from **any device or browser**, not just the one they registered
  on, and their data follows them. Passwords are salted + hashed (PBKDF2) on the server —
  reasonable for keeping people's job searches private from each other, not bank-grade
  security. A device also keeps a fast local cache (localStorage) so the app still works
  offline and reloads instantly; it syncs to the server in the background on every change.
- **Cindy** — a résumé and career-search guide, in a chat-style tab. She walks you through
  building a résumé from scratch (contact → summary → experience → education → skills →
  save to Profile) or uploading an existing one (.txt, .md, or .pdf — text is extracted
  client-side via pdf.js, shown editable before you save it), reads your pipeline to tell
  you what's stalled and what to do next, and has a stock of career tips and pep talks.
  She can also **analyze a résumé or cover letter** — attach a file or paste the text, say
  which one it is, and she returns specific, actionable feedback (strengths, gaps, and
  rewrite suggestions) without changing anything on your behalf. Free-text chat and
  analysis both run on a real AI backend (see "AI backend" below).
- **Pipeline** — track roles (title, company, posting URL, description) through
  Saved → Tailored → Applied → Interview → Denied → Closed
- **Job Matches** — real, live openings pulled from Adzuna (aggregates thousands of job
  boards) based on target roles + location. Nothing here applies on your behalf: each
  result links straight to the original posting, with a one-click "Save to pipeline" so
  you can track it. Also has quick-search launchers that open LinkedIn's or Indeed's own
  job search in a new tab (with an optional "Easy Apply only" toggle for LinkedIn, via its
  `f_AL=true` filter) so you can browse and apply there directly.
- **Unemployment work-search log** — in Profile, a toggle for people claiming unemployment
  benefits: keeps a downloadable record (PDF or CSV) of every job with an "applied" date —
  date, employer, position, method, result, posting URL — for the work-search documentation
  most states require if a claim is reviewed. Self-reported from your own pipeline data;
  not legal advice.
- **Profile** — contact info, target roles, platform links, your master résumé, and a
  master cover letter template — both pasteable or uploadable (.txt/.md/.pdf)
- **Needs attention** — auto-flags stalled items (saved with no materials, tailored but
  not applied after 2 days, applied with no follow-up after 7 days)
- **Back up & restore** — since there's no server, everything lives in the visitor's own
  browser (localStorage); Profile → Download backup exports it as JSON, Restore reloads it
- **English / Español** — an EN/ES toggle in the masthead (and on the sign-in screen)
  switches all tabs, forms, buttons, and Cindy's opening chat/menu; the choice is
  remembered per browser. Cindy's longer free-form replies (tips, résumé-builder prompts)
  are still English-only for now.

Marino's account comes pre-seeded with his résumé and cover letter the first time the
username `marino` is ever registered (see `SEED_PROFILES` in `index.html`) — so it isn't a
blank profile no matter which device he first signs up from.

## Accounts backend

Accounts and each account's data blob (`profile`/`activity`/`jobs`/`cindy`) live in a
Cloudflare KV namespace (binding `ACCOUNTS` in `wrangler.toml`), behind these Functions:

- `functions/api/account/register.js` — creates an account (salted PBKDF2 password hash),
  optionally seeded with an initial data blob, and returns a session token.
- `functions/api/account/login.js` — verifies the password and returns a fresh session
  token plus that account's current data.
- `functions/api/account/session.js` — validates a stored session token on app boot (so a
  returning device stays signed in) and returns the current data.
- `functions/api/account/logout.js` — deletes the session token.
- `functions/api/data.js` — `GET`/`PUT` the signed-in account's data blob, gated by a
  `Authorization: Bearer <token>` header. `index.html` calls this in the background
  (debounced ~300ms) after every change, and once more on page hide via `keepalive` fetch
  so a closed tab doesn't drop the last edit.

A device that already had a browser-local-only account from before this existed gets
migrated up automatically: the first time that person logs in on that device, if the server
has no matching account yet, the client checks this browser's old local account, verifies
the password against it, and if it matches, registers the server account using this
browser's existing data as the seed. After that one-time migration, the account is fully
server-side and works the same from any device.

**Setup note:** the KV namespace already exists (`id` in `wrangler.toml`) — creating a new
one only applies if the project is redeployed under a different Cloudflare account:

```bash
npx wrangler kv namespace create ACCOUNTS
```

## AI backend

`functions/api/plan.js`, `functions/api/tailor.js`, `functions/api/cindy.js`, and
`functions/api/analyze.js` are Cloudflare Pages Functions that call Cloudflare Workers AI
(`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) via the `[ai]` binding in `wrangler.toml` —
free, billed to the Cloudflare account, no separate API key. They power "Build my plan",
"Tailor résumé + cover letter", Cindy's free-text chat, and Cindy's résumé/cover-letter
analysis (`AI_ENABLED = true` in `index.html`).

`functions/api/jobs.js` proxies the [Adzuna Jobs API](https://developer.adzuna.com/) (a
free, self-serve job-search API — neither LinkedIn nor Indeed offer one) to power the "Job
Matches" tab. It reads `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` from Cloudflare Pages secrets
so the credentials never reach the browser:

```bash
npx wrangler pages secret put ADZUNA_APP_ID
npx wrangler pages secret put ADZUNA_APP_KEY
```

To redeploy the backend after editing anything under `functions/` or `wrangler.toml`:

```bash
npx wrangler pages deploy --project-name=cindy-career-copilot --commit-dirty=true
```

This deploys `index.html` too, so the Cloudflare Pages URL always mirrors this repo. GitHub
Pages keeps serving the same `index.html` independently (push to `main` to update it) — it
just can't run the Functions itself, which is why `aiRequest()` always targets the
Cloudflare Pages URL explicitly rather than a relative path.

## Editing

It's one file: `index.html`, plain HTML/CSS/JS, no build step. Edit it and push to `main` —
GitHub Pages redeploys automatically in under a minute.
