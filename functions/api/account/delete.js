// Cloudflare Pages Function — POST /api/account/delete   {username, password}
// Permanently deletes an account and everything stored for it (profile, résumé, pipeline,
// saved answers, Cindy chat). Requires the account's password so nobody else can do it.
// Used by the in-app "Delete my account" button and by the public delete-account.html page
// (Google Play requires a web link for account deletion).

import { CORS, json } from "../../_lib/cors.js";
import { verifyPassword, accountKey, normalizeUsername } from "../../_lib/auth.js";

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  if (!username || !password) return json({ error: "missing", message: "Enter your username and password." }, 400);

  const key = accountKey(username);
  const raw = await env.ACCOUNTS.get("acct:" + key);
  if (!raw) return json({ error: "invalid_credentials", message: "Wrong username or password." }, 401);
  let acct;
  try { acct = JSON.parse(raw); } catch (e) { return json({ error: "invalid_credentials", message: "Wrong username or password." }, 401); }
  const ok = await verifyPassword(password, acct.salt, acct.hash);
  if (!ok) return json({ error: "invalid_credentials", message: "Wrong username or password." }, 401);

  // Delete the account and its data. Any session tokens left over stop working because
  // resolveSession() now checks that the account still exists.
  await env.ACCOUNTS.delete("acct:" + key);
  await env.ACCOUNTS.delete("data:" + key);
  return json({ ok: true });
}
