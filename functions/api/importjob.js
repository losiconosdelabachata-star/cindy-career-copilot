// Cloudflare Pages Function — POST /api/importjob
// Turns pasted job-posting text (from LinkedIn, Indeed, an alert email, anywhere)
// into {title, company, description}. It never fetches LinkedIn/Indeed itself.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, CORS) });
}
export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  const text = String(b.text || "").slice(0, 8000);
  if (text.trim().length < 40) return json({ error: "too_short", message: "Paste more of the posting." }, 400);

  const system =
    "Extract the job title and hiring company from a pasted job posting. " +
    "Reply with ONLY a JSON object: {\"title\":\"...\",\"company\":\"...\",\"description\":\"...\"} where description is the posting's responsibilities and requirements, cleaned of site chrome (buttons, 'Easy Apply', 'people also viewed'), max 1500 characters. " +
    "If the company isn't stated, use an empty string. Never invent details.";
  try {
    const r = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, { role: "user", content: text }], max_tokens: 900 });
    const raw = String((r && (r.response || r.result)) || "");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "parse", message: "Couldn't read that posting." }, 502);
    const o = JSON.parse(m[0]);
    return json({
      title: String(o.title || "").slice(0, 200),
      company: String(o.company || "").slice(0, 200),
      description: String(o.description || "").slice(0, 3000)
    });
  } catch (err) {
    return json({ error: "ai_error", message: "Couldn't read that posting. Try again." }, 502);
  }
}
