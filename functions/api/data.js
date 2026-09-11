// Cloudflare Pages Function — GET/PUT /api/data
// Reads/writes the signed-in account's profile+pipeline+cindy blob in
// Cloudflare KV, gated by a Bearer session token. This is what makes the
// pipeline follow a user across devices instead of living in one browser's
// localStorage.

import { CORS, json } from "../_lib/cors.js";
import { resolveSession } from "../_lib/auth.js";

const MAX_BYTES = 5 * 1024 * 1024; // generous — this is small per-user JSON

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const key = await resolveSession(request, env);
  if (!key) return json({ error: "unauthorized" }, 401);

  const raw = await env.ACCOUNTS.get("data:" + key);
  let data = { profile: { links: {} }, activity: [], jobs: [], cindy: null };
  if (raw) { try { data = JSON.parse(raw); } catch (e) {} }
  return json({ data: data });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const key = await resolveSession(request, env);
  if (!key) return json({ error: "unauthorized" }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

  const str = JSON.stringify(body || {});
  if (str.length > MAX_BYTES) return json({ error: "too_large" }, 413);

  await env.ACCOUNTS.put("data:" + key, str);
  return json({ ok: true });
}
