// Cloudflare Pages Function — /api/autoapply/bot  (called only by the GitHub Actions bot)
//   GET  ?id=…  → the packet to apply with
//   POST {id, status, message, filled, missing} → progress/result; terminal states wipe the packet

import { json } from "../../_lib/cors.js";

function authed(request, env) {
  const a = (request.headers.get("x-bot-secret") || "").trim();
  const b = String(env.BOT_SECRET || "").trim();
  if (!b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function onRequestGet({ request, env }) {
  if (!authed(request, env)) return json({ error: "forbidden" }, 403);
  const id = new URL(request.url).searchParams.get("id") || "";
  const raw = await env.ACCOUNTS.get("apply:" + id);
  if (!raw) return json({ error: "not_found" }, 404);
  return json({ packet: JSON.parse(raw).packet });
}

const TERMINAL = ["submitted", "dry_run_ok", "needs_you", "failed"];

export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ error: "forbidden" }, 403);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  const key = "apply:" + String(b.id || "");
  const raw = await env.ACCOUNTS.get(key);
  if (!raw) return json({ error: "not_found" }, 404);
  const rec = JSON.parse(raw);
  rec.status = String(b.status || "running").slice(0, 30);
  rec.message = String(b.message || "").slice(0, 600);
  rec.filled = (b.filled || []).slice(0, 40).map(function (s) { return String(s).slice(0, 80); });
  rec.missing = (b.missing || []).slice(0, 40).map(function (s) { return String(s).slice(0, 120); });
  if (TERMINAL.indexOf(rec.status) !== -1) delete rec.packet; // don't keep résumé text around
  await env.ACCOUNTS.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 });
  return json({ ok: true });
}
