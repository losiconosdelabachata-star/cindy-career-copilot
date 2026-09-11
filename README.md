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
  Free-text chat runs on a real AI backend (see "AI backend" below).
- **Pipeline** — track roles (title, company, posting URL, description) through
  Saved → Tailored → Applied → Interview → Denied → Closed
- **Unemployment work-search log** — in Profile, a toggle for people claiming unemployment
  benefits: keeps a downloadable record (PDF or CSV) of every job with an "applied" date —
  date, employer, position, method, result, posting URL — for the work-search documentation
  most states require if a claim is reviewed. Self-reported from your own pipeline data;
  not legal advice.
- **Profile** — contact info (including date of birth — stored locally only, for
  applications that require confirming a minimum age; never included in the résumé/cover
  letter output), target roles, platform links, your master résumé, and a master cover
  letter template — both pasteable or uploadable (.txt/.md/.pdf)
- **Needs attention** — auto-flags stalled items (saved with no materials, tailored but
  not applied after 2 days, applied with no follow-up after 7 days)
- **Back up & restore** — since there's no server, everything lives in the visitor's own
  browser (localStorage); Profile → Download backup exports it as JSON, Restore reloads it
- **English / Español** — an EN/ES toggle in the masthead (and on the sign-in screen)
  switches all tabs, forms, buttons, and Cindy's opening chat/menu; the choice is
  remembered per browser. Cindy's longer free-form replies (tips, résumé-builder prompts)
  are still English-only for now.

Marino's account comes pre-seeded with his résumé and cover letter the first time the
username `marino` is registered on a given browser (see `SEED_PROFILES` in `index.html`) —
so it isn't a blank profile no matter which device he signs in from.

## AI backend

`functions/api/plan.js`, `functions/api/tailor.js`, and `functions/api/cindy.js` are
Cloudflare Pages Functions that call Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`)
via the `[ai]` binding in `wrangler.toml` — free, billed to the Cloudflare account, no
separate API key. They power "Build my plan", "Tailor résumé + cover letter", and Cindy's
free-text chat (`AI_ENABLED = true` in `index.html`).

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
