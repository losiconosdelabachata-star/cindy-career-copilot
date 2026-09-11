// Cloudflare Pages Function — POST /api/account/register
// Creates a server-side account (Cloudflare KV) so it works from any device,
// not just the browser it was created in. Optionally seeds it with an
// initial data blob (used for the one-time SEED_PROFILES seed, or when
// migrating a device's existing browser-local account up to the server).

import { CORS, json } from "../../_lib/cors.js";
import { hashPassword, createSession, accountKey, normalizeUsername } from "../../_lib/auth.js";

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

function blankData() {
  return { profile: { links: {} }, activity: [], jobs: [], cindy: null };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  const key = accountKey(username);

  if (!username || username.length < 2) return json({ error: "invalid_username", message: "Username needs at least 2 characters." }, 400);
  if (!/^[a-zA-Z0-9 _-]+$/.test(username)) return json({ error: "invalid_username", message: "Use only letters, numbers, spaces, - or _." }, 400);
  if (!password || password.length < 4) return json({ error: "invalid_password", message: "Password needs at least 4 characters." }, 400);

  const existing = await env.ACCOUNTS.get("acct:" + key);
  if (existing) return json({ error: "taken", message: "That username is already taken — try logging in instead." }, 409);

  const { hash, salt } = await hashPassword(password);
  const acct = { displayName: username, hash: hash, salt: salt, createdAt: Date.now() };
  await env.ACCOUNTS.put("acct:" + key, JSON.stringify(acct));

  const data = (body.data && typeof body.data === "object") ? body.data : blankData();
  await env.ACCOUNTS.put("data:" + key, JSON.stringify(data));

  const token = await createSession(env, key);
  return json({ token: token, username: username, data: data });
}
