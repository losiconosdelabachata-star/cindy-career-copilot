// Cloudflare Pages Function — POST /api/account/logout
// Deletes the session token server-side (best-effort — the client also just
// drops it locally either way).

import { CORS, json } from "../../_lib/cors.js";

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (m) { try { await env.ACCOUNTS.delete("sess:" + m[1].trim()); } catch (e) {} }
  return json({ ok: true });
}
