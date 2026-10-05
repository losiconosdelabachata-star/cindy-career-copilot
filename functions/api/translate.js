// Cloudflare Pages Function — POST /api/translate   {lang:"fr", strings:["Save", "Sign in", …]}
//   → {translations:["Enregistrer", "Se connecter", …]}   (same order; falls back to the original text on any failure)
// Two engines: the Llama 3.3 language model for the widely used languages (much better at short app-interface wording), and
// Cloudflare's m2m100 translation model (about 100 languages) for the rest and as the fallback.
// Every translated phrase is cached in KV for everyone, so each phrase is translated at most once per language.

const LLM = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const M2M = "@cf/meta/m2m100-1.2b";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, CORS) });
}
export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

// languages m2m100 can produce
const SUPPORTED = ("af am ar ast az ba be bg bn br bs ca ceb cs cy da de el es et fa ff fi fr fy ga gd gl gu ha he hi hr ht hu hy id ig ilo is it ja jv ka kk km kn ko lb lg ln lo lt lv mg mk ml mn mr ms my ne nl no ns oc or pa pl ps pt ro ru sd si sk sl so sq sr ss su sv sw ta th tl tn tr uk ur uz vi wo xh yi yo zh zu").split(" ");
// languages the Llama model writes well — these get the higher-quality engine
const LLM_LANGS = { es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese (Brazilian)", hi: "Hindi", th: "Thai", zh: "Simplified Chinese", ja: "Japanese", ko: "Korean",
  ar: "Arabic", ru: "Russian", tr: "Turkish", vi: "Vietnamese", id: "Indonesian", nl: "Dutch", pl: "Polish", uk: "Ukrainian", he: "Hebrew", el: "Greek", sv: "Swedish",
  da: "Danish", no: "Norwegian", fi: "Finnish", cs: "Czech", ro: "Romanian", hu: "Hungarian", bn: "Bengali", ur: "Urdu", fa: "Persian", ms: "Malay", tl: "Filipino (Tagalog)" };

async function sha1(s) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

function aiText(r) {
  const out = r && (r.response || r.result);
  if (out && typeof out === "object") return JSON.stringify(out);
  return String(out || "").trim();
}

// one call for a whole batch; returns an array of the same length, or null if the reply can't be trusted
async function llmBatch(env, langName, strings) {
  const system =
    "You translate the text of a mobile job-search and money-help app from English into " + langName + ". " +
    "Write what a native speaker would expect to see on a real app button or label (for example 'Sign in' is the verb for logging in; 'Save' is the button verb). " +
    "Keep these unchanged: brand and product names (Cindy, Cindy Career Copilot, LinkedIn, Indeed, Adzuna, Greenhouse, Lever, Google, Twitch, etc.), numbers, emojis, arrows and symbols (↗ → · ✓ ©), and any text in {braces}. " +
    "Glossary for this app: 'pipeline' = the user's board/list of job applications grouped by stage (translate it as 'job tracker' or 'applications board' in the target language, never as a pipe or tube); " +
    "'tailor' = customize/adapt a résumé to a specific job; 'Apply' = submit a job application; 'Practice run' = a test run that does not submit anything; " +
    "'bot' or 'helper' = an automated assistant; 'Saved/Tailored/Applied/Interview/Denied/Closed' are job application statuses; " +
    "'Cindy' is the name of the AI assistant; 'Job Matches' = job listings that fit the user; 'Log out' = sign out of the account. " +
    "Keep the same tone, punctuation and capitalization style. Do not add explanations. " +
    "Reply with ONLY a JSON array of strings: the same length and order as the input.";
  try {
    const r = await env.AI.run(LLM, { messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(strings) }], max_tokens: 3000 });
    let raw = aiText(r);
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr) || arr.length !== strings.length) return null;
    return arr.map(function (x, i) { const s = String(x == null ? "" : x).trim(); return s || strings[i]; });
  } catch (e) { return null; }
}

async function m2mOne(env, lang, text) {
  try {
    const r = await env.AI.run(M2M, { text: text, source_lang: "en", target_lang: lang });
    const out = String((r && (r.translated_text || r.response || r.result)) || "").trim();
    return out || text;
  } catch (e) { return text; }
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  const lang = String(b.lang || "").toLowerCase();
  if (SUPPORTED.indexOf(lang) === -1) return json({ error: "unsupported_language", message: "That language isn't available yet." }, 400);
  const strings = (Array.isArray(b.strings) ? b.strings : []).slice(0, 24).map(function (s) { return String(s == null ? "" : s).slice(0, 600); });
  if (!strings.length) return json({ translations: [] });

  const engine = LLM_LANGS[lang] ? "L" : "M";
  const keys = await Promise.all(strings.map(function (s) { return sha1(s).then(function (h) { return "tr3:" + engine + ":" + lang + ":" + h; }); }));
  const cached = await Promise.all(keys.map(function (k) { return env.ACCOUNTS.get(k); }));
  const out = cached.slice();
  const missing = [];
  strings.forEach(function (s, i) { if (!s.trim()) out[i] = s; else if (!out[i]) missing.push(i); });

  if (missing.length) {
    let res = null, usedFallback = false;
    if (engine === "L") res = await llmBatch(env, LLM_LANGS[lang], missing.map(function (i) { return strings[i]; }));
    if (!res) { usedFallback = engine === "L"; res = await Promise.all(missing.map(function (i) { return m2mOne(env, lang, strings[i]); })); }
    await Promise.all(missing.map(function (i, j) {
      out[i] = res[j];
      // a one-off fallback answer is shown now but NOT saved, so the better engine gets another chance next time
      return (!usedFallback && res[j] !== strings[i]) ? env.ACCOUNTS.put(keys[i], res[j], { expirationTtl: 60 * 60 * 24 * 90 }) : Promise.resolve();
    }));
  }
  return json({ translations: out });
}
