// Cloudflare Pages Function — POST /api/tailor
// Tailors a résumé + drafts a cover letter for one job posting, using the
// user's master résumé and the job's title/company/description.

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

function splitSections(text) {
  var resumeMarker = "===RESUME===";
  var letterMarker = "===COVER LETTER===";
  var ri = text.indexOf(resumeMarker);
  var li = text.indexOf(letterMarker);
  if (ri === -1 || li === -1 || li < ri) return null;
  var resume = text.slice(ri + resumeMarker.length, li).trim();
  var coverLetter = text.slice(li + letterMarker.length).trim();
  return { resume: resume, coverLetter: coverLetter };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }

  const resume = String(body.resume || "").slice(0, 6500);
  const title = String(body.title || "").slice(0, 200);
  const company = String(body.company || "").slice(0, 200);
  const description = String(body.description || "").slice(0, 6500);

  if (!resume.trim()) return json({ error: "missing_resume" }, 400);

  const system =
    "You are an expert résumé writer. Given a master résumé and a specific job posting, " +
    "rewrite the résumé tailored to that job (reorder/emphasize relevant experience, " +
    "mirror the posting's key terms honestly — never invent experience that isn't in the " +
    "original résumé) and write a concise, specific, warm cover letter (under 300 words) " +
    "that references the company and role by name. " +
    "Respond in EXACTLY this format, with no other text before or after:\n" +
    "===RESUME===\n<the tailored résumé, plain text>\n===COVER LETTER===\n<the cover letter, plain text>";

  const userMsg =
    "JOB TITLE: " + (title || "(unspecified)") + "\n" +
    "COMPANY: " + (company || "(unspecified)") + "\n" +
    "JOB DESCRIPTION:\n" + (description || "(none provided)") + "\n\n" +
    "MASTER RÉSUMÉ:\n" + resume;

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg }
      ],
      max_tokens: 2000
    });
    const text = (result && (result.response || result.result || "")).toString().trim();
    const parsed = splitSections(text);
    if (!parsed) return json({ error: "invalid_json", message: "Model reply didn't match the expected format." }, 502);
    return json(parsed);
  } catch (err) {
    return json({ error: "ai_error", message: String(err && err.message || err) }, 502);
  }
}
