// Cloudflare Pages Function — POST /api/analyze
// Cindy reviews an attached/pasted résumé or cover letter and returns direct,
// actionable feedback. Read-only: never rewrites or submits anything on the
// user's behalf, just analysis text back to the chat.

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

  const text = String(body.text || "").slice(0, 6500);
  const kind = body.kind === "cover" ? "cover" : "resume";
  if (!text.trim()) return json({ error: "missing_text" }, 400);

  const system = kind === "cover"
    ? "You are Cindy, a direct, warm career coach reviewing a cover letter. Give specific, " +
      "actionable feedback: what's genuinely strong, what's generic or cliché, what's missing " +
      "(a concrete reason for this company/role, a real accomplishment), and 2-3 concrete " +
      "rewrite suggestions. Organize with short headers and bullet points. Under 350 words. " +
      "No filler like 'I'd be happy to help.'"
    : "You are Cindy, a direct, warm career coach reviewing a résumé. Give specific, actionable " +
      "feedback: what's genuinely strong, what's weak or missing (impact, metrics, keyword " +
      "coverage for ATS scans, formatting/clarity issues), and rewrite 2-3 of the weakest bullets " +
      "as examples. Organize with short headers and bullet points. Under 350 words. No filler " +
      "like 'I'd be happy to help.'";

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: text }
      ],
      max_tokens: 600
    });
    const out = (result && (result.response || result.result || "")).toString().trim();
    if (!out) return json({ error: "empty_response" }, 502);
    return json({ text: out });
  } catch (err) {
    return json({ error: "ai_error", message: String(err && err.message || err) }, 502);
  }
}
