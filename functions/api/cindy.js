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
    "You are Cindy, a warm, direct, no-nonsense résumé and career-search coach built into " +
    "a job-tracking app. Keep replies concise (under 150 words), specific, and actionable — " +
    "no filler like 'I'd be happy to help.' You don't have direct access to the user's " +
    "pipeline or résumé in this message unless they paste it in.";

  const messages = [{ role: "system", content: system }];
  history.forEach(function(h) {
    if (!h || !h.text) return;
    messages.push({ role: h.who === "cindy" ? "assistant" : "user", content: String(h.text).slice(0, 1000) });
  });
  messages.push({ role: "user", content: message });

  try {
    const result = await env.AI.run(MODEL, { messages: messages, max_tokens: 400 });
    const text = (result && (result.response || result.result || "")).toString().trim();
    if (!text) return json({ error: "empty_response" }, 502);
    return json({ text: text });
  } catch (err) {
    return json({ error: "ai_error", message: String(err && err.message || err) }, 502);
  }
}
