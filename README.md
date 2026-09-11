# Career Copilot — Job Search Deck

A private, per-person job-search command deck. Single static page, served by GitHub Pages —
no server, no API keys.

## Live site
https://losiconosdelabachata-star.github.io/cindy-career-copilot/

## What it does

- **Accounts** — sign in with a username + password, or hit **Register** to create a new
  one. Each account's pipeline and profile are stored separately, so Marino, Cindy, or
  anyone else sharing this device can each keep their own private data. There's no server,
  so this is data separation + a password gate (everything still lives in this browser's
  localStorage) rather than server-verified security — good enough for keeping housemates'
  job searches apart, not for anything sensitive.
- **Cindy** — a résumé and career-search guide, in a chat-style tab. She walks you through
  building a résumé from scratch (contact → summary → experience → education → skills →
  save to Profile) or uploading an existing one (.txt, .md, or .pdf — text is extracted
  client-side via pdf.js, shown editable before you save it), reads your pipeline to tell
  you what's stalled and what to do next, and has a stock of career tips and pep talks.
  She runs on built-in guidance today (no server needed); free-text chat is wired to
  switch to a real AI backend automatically once one's connected (see "What's
  intentionally off here").
- **Pipeline** — track roles (title, company, posting URL, description) through
  Saved → Tailored → Applied → Interview → Closed
- **Profile** — contact info, target roles, platform links, your master résumé, and a
  master cover letter template — both pasteable or uploadable (.txt/.md/.pdf)
- **Needs attention** — auto-flags stalled items (saved with no materials, tailored but
  not applied after 2 days, applied with no follow-up after 7 days)
- **Back up & restore** — since there's no server, everything lives in the visitor's own
  browser (localStorage); Profile → Download backup exports it as JSON, Restore reloads it

Marino's account comes pre-seeded with his résumé and cover letter the first time the
username `marino` is registered on a given browser (see `SEED_PROFILES` in `index.html`) —
so it isn't a blank profile no matter which device he signs in from.

## What's intentionally off here

GitHub Pages only serves static files — there's no server to run AI calls, so the
**"Build my plan" / "Tailor résumé + cover letter"** buttons are disabled on this build,
with a note explaining why. Everything else works fully.

A sibling build with those AI features wired up (via Cloudflare Workers AI — free,
no API key) exists outside this repo. Ask if you want it deployed too.

## Editing

It's one file: `index.html`, plain HTML/CSS/JS, no build step. Edit it and push to `main` —
GitHub Pages redeploys automatically in under a minute.
