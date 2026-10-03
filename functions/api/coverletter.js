// Cloudflare Pages Function — POST /api/coverletter
// Writes just a cover letter for one job (no résumé rewrite), in a chosen tone,
// starting from the user's résumé and (optionally) their master cover letter.

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

const TONES = { warm: "warm and personable", formal: "formal and professional", concise: "brief and direct (under 180 words)", confident: "confident and results-focused" };

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  const resume = String(b.resume || "").slice(0, 6500);
  const template = String(b.template || "").slice(0, 3000);
  if (!resume.trim()) return json({ error: "missing_resume" }, 400);
  const tone = TONES[b.tone] || TONES.warm;

  const system =
    "You write cover letters. Write one specific, honest cover letter (under 300 words) in a " + tone + " tone. " +
    "Reference the company and role by name, connect 2-3 real strengths from the résumé to the posting, " +
    "and never invent experience, employers, or numbers that aren't in the résumé. " +
    (template ? "Match the voice of the candidate's own sample letter where it fits. " : "") +
    "Output only the letter text, starting with the greeting and ending with the sign-off and the candidate's name.";
  const user =
    "JOB TITLE: " + String(b.title || "").slice(0, 200) + "\nCOMPANY: " + String(b.company || "").slice(0, 200) + "\n" +
    "JOB DESCRIPTION:\n" + (String(b.description || "").slice(0, 6000) || "(none provided)") + "\n\n" +
    "CANDIDATE NAME: " + String(b.name || "").slice(0, 120) + "\n\nRÉSUMÉ:\n" + resume +
    (template ? "\n\nCANDIDATE'S SAMPLE LETTER:\n" + template : "");
  try {
    const r = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 900 });
    const text = String((r && (r.response || r.result)) || "").trim();
    if (!text) return json({ error: "ai_error", message: "Empty reply." }, 502);
    return json({ coverLetter: text });
  } catch (err) {
    return json({ error: "ai_error", message: String(err && err.message || err) }, 502);
  }
}
