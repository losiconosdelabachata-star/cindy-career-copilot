// Cloudflare Pages Function — GET /api/account/session
// Validates a stored session token on app boot (so a returning device stays
// signed in) and returns the account's current data in the same call.

import { CORS, json } from "../../_lib/cors.js";
import { resolveSession } from "../../_lib/auth.js";

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const key = await resolveSession(request, env);
  if (!key) return json({ error: "invalid_session" }, 401);

  const acctRaw = await env.ACCOUNTS.get("acct:" + key);
  if (!acctRaw) return json({ error: "invalid_session" }, 401);
  let acct;
  try { acct = JSON.parse(acctRaw); } catch (e) { return json({ error: "corrupt_account" }, 500); }

  const dataRaw = await env.ACCOUNTS.get("data:" + key);
  let data = { profile: { links: {} }, activity: [], jobs: [], cindy: null };
  if (dataRaw) { try { data = JSON.parse(dataRaw); } catch (e) {} }

  return json({ username: acct.displayName || key, data: data });
}
