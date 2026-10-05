import { langLine } from "../_lib/lang.js";
import { knowledgeBlock } from "../_lib/knowledge.js";
// Cloudflare Pages Function — POST /api/cindy
// Free-text conversational replies for Cindy, the in-app résumé/career guide.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json" }, CORS)
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

  const message = String(body.message || "").slice(0, 2000);
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
  if (!message.trim()) return json({ error: "empty_message" }, 400);

  const system =
    "You are The Cindy Bot — Cindy — a warm, direct, no-nonsense résumé and career-search coach built into a job-search app. " +
    "Keep replies concise (under 150 words), specific and actionable, with no filler like 'I'd be happy to help.' " +
    "HONESTY RULES: Never promise or guarantee outcomes (jobs, interviews, income, benefits, credit scores) and never say you are 'certain' or '100%' sure about results; " +
    "say what you can help with (résumés, cover letters, interview prep, application strategy, using the app's tools) and what depends on the person and the market. " +
    "You cannot send emails, texts or notifications, you cannot apply to jobs by yourself in this chat, and you cannot see the user's saved data unless they paste it in. " +
    "The app has these tools you can point to: Pipeline (track jobs), Job Matches (search, with a remote-only option), tailored résumé + cover letter per job, " +
    "the Apply window with a Practice run, Profile (résumé, saved answers, certificates), reminders and a Face ID lock in the mobile app, and the Money help and Freelance sections. " +
    "This chat keeps the conversation you can see on screen, so you may refer back to earlier messages in it. Never describe yourself as a 'stateless AI'. " +
    "If you don't know something about the app, say so plainly and suggest where to look.";

  // Retrieval: pick the most relevant built-in knowledge cards (English). Non-English questions are translated for lookup only.
  let q = message;
  const lang = String(body.lang || "en").toLowerCase().split("-")[0];
  if (lang !== "en" && /^[a-z]{2,3}$/.test(lang)) {
    try {
      const tr = await env.AI.run("@cf/meta/m2m100-1.2b", { text: message.slice(0, 500), source_lang: lang, target_lang: "en" });
      if (tr && tr.translated_text) q = tr.translated_text + " " + message;
    } catch (e) {}
  }
  // Short follow-ups ("and how much?") borrow context from the previous user turn.
  if (q.split(/\s+/).length < 5) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] && history[i].who !== "cindy" && history[i].text) { q = String(history[i].text) + " " + q; break; }
    }
  }
  const kb = knowledgeBlock(q);
  const kbRules =
    " KNOWLEDGE BASE: you have NO internet access. Answer from the notes below and your general knowledge. " +
    "For questions about how the app works, rely on these notes; if they don't cover it, say you're not sure and point to the nearest tab instead of guessing. " +
    "Laws, program amounts and platform requirements change, so for numbers and eligibility remind people to confirm with the official source. " +
    "You may use up to about 220 words when the question needs detail.\n\nNOTES:\n" + kb;

  const messages = [{ role: "system", content: system + kbRules + langLine(body.lang) }];
  history.forEach(function(h) {
    if (!h || !h.text) return;
    messages.push({ role: h.who === "cindy" ? "assistant" : "user", content: String(h.text).slice(0, 1000) });
  });
  messages.push({ role: "user", content: message });

  try {
    const result = await env.AI.run(MODEL, { messages: messages, max_tokens: 550 });
    const text = (result && (result.response || result.result || "")).toString().trim();
    if (!text) return json({ error: "empty_response" }, 502);
    return json({ text: text });
  } catch (err) {
    return json({ error: "ai_error", message: String(err && err.message || err) }, 502);
  }
}
