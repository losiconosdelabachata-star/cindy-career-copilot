// Cloudflare Pages Function — POST /api/account/login
// Verifies a server-side account (Cloudflare KV) and returns a session token
// plus that account's current data, so signing in from any device pulls the
// same pipeline/profile.

import { CORS, json } from "../../_lib/cors.js";
import { verifyPassword, createSession, accountKey, normalizeUsername } from "../../_lib/auth.js";

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  const key = accountKey(username);
  if (!username || !password) return json({ error: "missing_fields", message: "Enter a username and password." }, 400);

  const raw = await env.ACCOUNTS.get("acct:" + key);
  if (!raw) return json({ error: "not_found", message: "No account found for that username." }, 404);

  let acct;
  try { acct = JSON.parse(raw); } catch (e) { return json({ error: "corrupt_account" }, 500); }

  const ok = await verifyPassword(password, acct.salt, acct.hash);
  if (!ok) return json({ error: "bad_password", message: "Incorrect password." }, 401);

  const token = await createSession(env, key);
  const dataRaw = await env.ACCOUNTS.get("data:" + key);
  let data = { profile: { links: {} }, activity: [], jobs: [], cindy: null };
  if (dataRaw) { try { data = JSON.parse(dataRaw); } catch (e) {} }

  return json({ token: token, username: acct.displayName || username, data: data });
}
