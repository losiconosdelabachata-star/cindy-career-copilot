// Shared password hashing + session-token helpers for the account system.
// Passwords are hashed server-side with salted PBKDF2 (Web Crypto, built
// into the Workers runtime) — the plaintext password only ever travels over
// HTTPS from client to this Function, same as any normal login form.

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

function bytesToHex(bytes) {
  return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}
function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function deriveHash(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, saltBytes);
  return { hash: hash, salt: bytesToHex(saltBytes) };
}

export async function verifyPassword(password, saltHex, hashHex) {
  const hash = await deriveHash(password, hexToBytes(saltHex));
  return timingSafeEqualHex(hash, hashHex);
}

export function newToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(24)));
}

export async function createSession(env, key) {
  const token = newToken();
  await env.ACCOUNTS.put("sess:" + token, JSON.stringify({ key: key }), { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

// Resolves an Authorization: Bearer <token> header to the account key, or
// null if missing/invalid/expired.
export async function resolveSession(request, env) {
  const authHeader = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return null;
  const raw = await env.ACCOUNTS.get("sess:" + m[1].trim());
  if (!raw) return null;
  try { return JSON.parse(raw).key || null; } catch (e) { return null; }
}

export function normalizeUsername(u) {
  return String(u || "").trim();
}
export function accountKey(username) {
  return normalizeUsername(username).toLowerCase();
}
