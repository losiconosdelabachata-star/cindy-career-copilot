# Career Copilot — Job Search Deck

A private, no-login job-search command deck. Single static page, served by GitHub Pages —
no server, no accounts, no API keys.

## Live site
https://losiconosdelabachata-star.github.io/cindy-career-copilot/

## What it does

- **Pipeline** — track roles (title, company, posting URL, description) through
  Saved → Tailored → Applied → Interview → Closed
- **Profile** — contact info, target roles, platform links, and your master résumé
- **Needs attention** — auto-flags stalled items (saved with no materials, tailored but
  not applied after 2 days, applied with no follow-up after 7 days)
- **Back up & restore** — since there's no server, everything lives in the visitor's own
  browser (localStorage); Profile → Download backup exports it as JSON, Restore reloads it

## What's intentionally off here

GitHub Pages only serves static files — there's no server to run AI calls, so the
**"Build my plan" / "Tailor résumé + cover letter"** buttons are disabled on this build,
with a note explaining why. Everything else works fully.

A sibling build with those AI features wired up (via Cloudflare Workers AI — free,
no API key) exists outside this repo. Ask if you want it deployed too.

## Editing

It's one file: `index.html`, plain HTML/CSS/JS, no build step. Edit it and push to `main` —
GitHub Pages redeploys automatically in under a minute.
