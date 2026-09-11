// Cloudflare Pages Function — POST /api/plan
// Builds a short, specific "what to do today" plan from the user's live pipeline.
// Uses Cloudflare Workers AI (free tier) — no API key needed, billed to the
// Cloudflare account via the [ai] binding declared in wrangler.toml.

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

  const pipeline = String(body.pipeline || "").slice(0, 4000);
  const targetRoles = String(body.targetRoles || "").slice(0, 300);
  const location = String(body.location || "").slice(0, 200);

  const system =
    "You are a direct, encouraging job-search coach. Given a person's live pipeline of " +
    "tracked roles, write a short, specific, actionable plan for what to do today. " +
    "Reference the actual companies/roles from their pipeline by name. Use short bullet " +
    "points. No filler, no generic advice, no more than 180 words total.";

  const userMsg =
    (targetRoles ? "Target roles: " + targetRoles + "\n" : "") +
    (location ? "Location: " + location + "\n" : "") +
    "Pipeline:\n" + (pipeline || "(empty — nothing tracked yet)");

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg }
      ],
      max_tokens: 400
    });
    const text = (result && (result.response || result.result || "")).toString().trim();
    if (!text) return json({ error: "empty_response" }, 502);
    return json({ text: text });
  } catch (err) {
    return json({ error: "ai_error", message: String(err && err.message || err) }, 502);
  }
}
