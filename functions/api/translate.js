// Cloudflare Pages Function — POST /api/translate   {lang:"fr", strings:["Save", "Sign in", …]}
//   → {translations:["Enregistrer", "Se connecter", …]}   (same order; falls back to the original text on any failure)
// Uses Cloudflare's m2m100 translation model (about 100 languages, free Workers AI). Every translated phrase is cached
// in KV for everyone, so each phrase is translated at most once per language.

const MODEL = "@cf/meta/m2m100-1.2b";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, CORS) });
}
export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

// languages m2m100 can produce
const SUPPORTED = ("af am ar ast az ba be bg bn br bs ca ceb cs cy da de el es et fa ff fi fr fy ga gd gl gu ha he hi hr ht hu hy id ig ilo is it ja jv ka kk km kn ko lb lg ln lo lt lv mg mk ml mn mr ms my ne nl no ns oc or pa pl ps pt ro ru sd si sk sl so sq sr ss su sv sw ta th tl tn tr uk ur uz vi wo xh yi yo zh zu").split(" ");

async function sha1(s) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

async function translateOne(env, lang, text) {
  const key = "tr:" + lang + ":" + (await sha1(text));
  const hit = await env.ACCOUNTS.get(key);
  if (hit) return hit;
  try {
    const r = await env.AI.run(MODEL, { text: text, source_lang: "en", target_lang: lang });
    const out = String((r && (r.translated_text || r.response || r.result)) || "").trim();
    if (out) {
      await env.ACCOUNTS.put(key, out, { expirationTtl: 60 * 60 * 24 * 90 });
      return out;
    }
  } catch (e) { /* fall through */ }
  return text;
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  const lang = String(b.lang || "").toLowerCase();
  if (SUPPORTED.indexOf(lang) === -1) return json({ error: "unsupported_language", message: "That language isn't available yet." }, 400);
  const strings = (Array.isArray(b.strings) ? b.strings : []).slice(0, 24).map(function (s) { return String(s == null ? "" : s).slice(0, 600); });
  if (!strings.length) return json({ translations: [] });
  const translations = await Promise.all(strings.map(function (s) { return s.trim() ? translateOne(env, lang, s) : Promise.resolve(s); }));
  return json({ translations: translations });
}
