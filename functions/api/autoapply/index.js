// Cloudflare Pages Function — /api/autoapply
//   POST  (Bearer session) {job, mode:"dry"|"submit"}  → queue a bot run
//   GET   (Bearer session) ?id=…                      → run status
// The packet is parked in KV; a GitHub Actions workflow (Playwright) picks it
// up through /api/autoapply/bot using a shared secret, fills the employer's
// form, and reports back. Requires env: GH_DISPATCH_TOKEN, GH_REPO, BOT_SECRET.

import { CORS, json } from "../../_lib/cors.js";
import { resolveSession } from "../../_lib/auth.js";

const TTL = 60 * 60 * 24;
const DEFAULT_REPO = "losiconosdelabachata-star/cindy-career-copilot";

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

function clip(v, n) { return String(v == null ? "" : v).slice(0, n); }

export async function onRequestPost({ request, env }) {
  const user = await resolveSession(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!env.GH_DISPATCH_TOKEN || !env.BOT_SECRET) {
    return json({ error: "bot_not_configured", message: "Auto-apply isn't switched on yet (server setup missing)." }, 503);
  }
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

  const url = clip(b.url, 1000);
  if (!/^https:\/\//i.test(url)) return json({ error: "bad_url", message: "The job needs an https posting URL." }, 400);
  const p = b.profile || {};
  const packet = {
    url: url,
    mode: b.mode === "submit" ? "submit" : "dry",
    title: clip(b.title, 200), company: clip(b.company, 200),
    profile: {
      name: clip(p.name, 200), email: clip(p.email, 200), phone: clip(p.phone, 60),
      location: clip(p.location, 200), linkedin: clip(p.linkedin, 500), website: clip(p.website, 500)
    },
    resume: clip(b.resume, 20000), coverLetter: clip(b.coverLetter, 10000)
  };
  if (!packet.profile.name || !packet.profile.email || !packet.resume) {
    return json({ error: "incomplete", message: "Name, email and a résumé are required." }, 400);
  }

  const id = crypto.randomUUID();
  await env.ACCOUNTS.put("apply:" + id, JSON.stringify({ user: user, status: "queued", message: "Waiting for the bot to start…", packet: packet, at: Date.now() }), { expirationTtl: TTL });

  const repo = /^[\w.-]+\/[\w.-]+$/.test(String(env.GH_REPO || "").trim()) ? String(env.GH_REPO).trim() : DEFAULT_REPO;
  const gh = await fetch("https://api.github.com/repos/" + repo + "/dispatches", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.GH_DISPATCH_TOKEN,
      accept: "application/vnd.github+json",
      "user-agent": "cindy-career-copilot",
      "content-type": "application/json"
    },
    body: JSON.stringify({ event_type: "auto-apply", client_payload: { id: id } })
  });
  if (!gh.ok) {
    await env.ACCOUNTS.delete("apply:" + id);
    return json({ error: "dispatch_failed", message: "Couldn't start the bot (" + gh.status + "). " + (gh.status === 404 ? "GitHub can't see the repo with this token." : gh.status === 401 ? "GitHub rejected the token." : gh.status === 403 ? "The token is missing Contents read/write." : "") }, 502);
  }
  return json({ id: id });
}

export async function onRequestGet({ request, env }) {
  const user = await resolveSession(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  const raw = await env.ACCOUNTS.get("apply:" + id);
  if (!raw) return json({ error: "not_found" }, 404);
  const rec = JSON.parse(raw);
  if (rec.user !== user) return json({ error: "not_found" }, 404);
  return json({ status: rec.status, message: rec.message, filled: rec.filled || [], missing: rec.missing || [] });
}
