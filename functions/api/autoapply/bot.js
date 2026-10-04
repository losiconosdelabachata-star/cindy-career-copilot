// Cloudflare Pages Function — /api/autoapply/bot  (called only by the GitHub Actions bot)
//   GET  ?id=…  → the packet to apply with
//   POST {id, status, message, filled, missing} → progress/result; terminal states wipe the packet

import { json } from "../../_lib/cors.js";

// The bot proves who it is with GitHub Actions' built-in OIDC token (signed by GitHub,
// scoped to this repo) — no shared secret to copy around. BOT_SECRET still works as a fallback.
const REPO = "losiconosdelabachata-star/cindy-career-copilot";
const ISS = "https://token.actions.githubusercontent.com";
const AUD = "cindy-career-copilot";
let jwksCache = null;

function b64u(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyOidc(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  const header = JSON.parse(new TextDecoder().decode(b64u(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
  if (header.alg !== "RS256") return false;
  if (payload.iss !== ISS || payload.aud !== AUD) return false;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return false;
  if (payload.repository !== REPO) return false;
  if (payload.ref !== "refs/heads/main") return false;
  if (!jwksCache || !jwksCache.keys.some(function (k) { return k.kid === header.kid; })) {
    const r = await fetch(ISS + "/.well-known/jwks");
    jwksCache = await r.json();
  }
  const jwk = jwksCache.keys.filter(function (k) { return k.kid === header.kid; })[0];
  if (!jwk) return false;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
}

async function authed(request, env) {
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    try { if (await verifyOidc(bearer)) return true; } catch (e) {}
  }
  const a = (request.headers.get("x-bot-secret") || "").trim();
  const b = String(env.BOT_SECRET || "").trim();
  if (!b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function onRequestGet({ request, env }) {
  if (!(await authed(request, env))) return json({ error: "forbidden" }, 403);
  const id = new URL(request.url).searchParams.get("id") || "";
  const raw = await env.ACCOUNTS.get("apply:" + id);
  if (!raw) return json({ error: "not_found" }, 404);
  return json({ packet: JSON.parse(raw).packet });
}

const TERMINAL = ["submitted", "dry_run_ok", "needs_you", "failed"];

export async function onRequestPost({ request, env }) {
  if (!(await authed(request, env))) return json({ error: "forbidden" }, 403);
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
