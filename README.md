# Cindy Career Copilot

Fully standalone version — AI-assisted resume tailoring and job pipeline tracker. No Claude branding anywhere.

- Frontend: `index.html` (static, served by GitHub Pages)
- Backend: Supabase project `cindy-career-copilot` (Postgres + Auth, real per-user private data via Row Level Security)
- Secure AI calls: `supabase/functions/ai` (Edge Function; calls Anthropic's API server-side so the API key is never exposed to the browser)
- Email alerts: a scheduled job checks the `notifications` table and emails users when something needs their attention.

## Live site
https://losiconosdelabachata-star.github.io/cindy-career-copilot/

## Deploying the AI Edge Function
```
supabase login
supabase link --project-ref ebtmnbqvjbgrktqcnroj
supabase functions deploy ai
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
Until the function is deployed and the secret is set, resume tailoring/building will show an error but the rest of the app (accounts, resume storage, job tracking, notifications) works fully.
