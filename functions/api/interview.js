import { langLine } from "../_lib/lang.js";
// Cloudflare Pages Function — POST /api/interview
// Mock-interview practice. Two modes:
//   {mode:"questions", title, company, description, resume, kind}  -> {questions:[{q, tip}]}
//   {mode:"feedback",  title, company, question, answer}          -> {score, strengths[], improve[], better}
// Coaching only: it scores practice answers, it never promises an outcome.

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

function extractJson(text) {
  const s = String(text || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
const clip = function (v, n) { return String(v || "").slice(0, n); };
const arr = function (v, n, len) {
  return (Array.isArray(v) ? v : []).slice(0, n).map(function (x) { return clip(x, len); }).filter(Boolean);
};

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  const mode = body.mode === "feedback" ? "feedback" : "questions";
  const title = clip(body.title, 120), company = clip(body.company, 120);
  const role = (title ? title : "the role") + (company ? " at " + company : "");

  let system, user, max;
  if (mode === "questions") {
    const kind = ["behavioral", "technical", "mixed"].indexOf(body.kind) >= 0 ? body.kind : "mixed";
    system =
      "You are Cindy, an interview coach. Write 6 realistic interview questions for the role below, " +
      "in the order an interviewer would ask them (start with 'tell me about yourself' style, end with a question about their goals or questions for the team). " +
      "Style: " + kind + (kind === "mixed" ? " (about half behavioral, half about the job's skills)." : ".") +
      " For each, add a one-sentence tip on how to answer well (for behavioral ones suggest the STAR method). " +
      'Reply with ONLY JSON: {"questions":[{"q":"...","tip":"..."}]}. No other text.' + langLine(body.lang);
    user = "Role: " + role + "\nJob description:\n" + clip(body.description, 2500) + "\n\nCandidate résumé (for context):\n" + clip(body.resume, 2500);
    max = 900;
  } else {
    const question = clip(body.question, 500), answer = clip(body.answer, 3000);
    if (!question.trim() || !answer.trim()) return json({ error: "missing_answer" }, 400);
    system =
      "You are Cindy, a direct, kind interview coach scoring a PRACTICE answer. Judge: does it answer the question, is it specific (real example, numbers, result), " +
      "is it well organized (STAR for behavioral questions), and is the length reasonable (about 45-120 seconds spoken). " +
      "Be honest, not flattering; never invent facts about the candidate and never promise they will get the job. " +
      'Reply with ONLY JSON: {"score": <integer 1-10>, "strengths": ["..",".."], "improve": ["..",".."], "better": "<a stronger version of their answer, using ONLY facts, numbers and names that appear in their answer (never add or change any figure; use [brackets] for details they should fill in), in first person, under 120 words>"}. ' +
      "Max 3 strengths and 3 improvements, each under 25 words." + langLine(body.lang);
    user = "Role: " + role + "\nQuestion: " + question + "\nCandidate's answer: " + answer;
    max = 700;
  }

  try {
    const result = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: max });
    const raw = result && (result.response || result.result || "");
    const j = (raw && typeof raw === "object") ? raw : extractJson(String(raw));
    if (!j) return json({ error: "bad_ai_output" }, 502);
    if (mode === "questions") {
      const qs = (Array.isArray(j.questions) ? j.questions : []).slice(0, 8).map(function (x) {
        return { q: clip(x && x.q, 300), tip: clip(x && x.tip, 250) };
      }).filter(function (x) { return x.q; });
      if (!qs.length) return json({ error: "no_questions" }, 502);
      return json({ questions: qs });
    }
    let score = parseInt(j.score, 10);
    if (!(score >= 1 && score <= 10)) score = 5;
    return json({ score: score, strengths: arr(j.strengths, 3, 200), improve: arr(j.improve, 3, 200), better: clip(j.better, 900) });
  } catch (err) {
    return json({ error: "ai_error", message: String(err && err.message || err) }, 502);
  }
}
