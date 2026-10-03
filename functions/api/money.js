// Cloudflare Pages Function — POST /api/money
//   {kind:"credit", score, issues[], goal, income}  → a step-by-step credit repair plan (JSON)
//   {kind:"grants", state, categories[], situation} → application prep guidance (JSON)
//   {kind:"statement", state, category, situation, name} → a draft statement of need (text)
// Educational guidance only — not legal or financial advice, and it never names
// specific grant programs from memory (the page links to official directories).

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

function arr(v, n, len) { return (Array.isArray(v) ? v : []).slice(0, n).map(function (x) { return String(x).slice(0, len); }); }

async function ask(env, system, user, max) {
  const r = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: max || 1400 });
  return String((r && (r.response || r.result)) || "").trim();
}
function parseObj(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  try {
    if (b.kind === "credit") {
      const system =
        "You are a careful credit education coach. Build a practical, ordered credit-improvement plan for a US consumer. " +
        "Use only well-established, free methods: pulling free reports at annualcreditreport.com, disputing errors directly with the bureaus and furnishers under the FCRA, " +
        "paying down revolving utilization (target under 30%, ideally under 10%), on-time payments and autopay, goodwill letters, " +
        "validating debts before paying collectors and written pay-for-delete/settlement agreements, secured cards or credit-builder loans for thin files, " +
        "becoming an authorized user, and not closing old accounts. " +
        "Never promise a score change, never recommend paying a credit repair company, never suggest disputing accurate items falsely or creating a new identity (CPN scams). " +
        "Reply with ONLY JSON: {\"summary\":\"2-3 sentences\",\"steps\":[{\"title\":\"short\",\"detail\":\"specific what-to-do, 1-3 sentences\",\"when\":\"This week|Next 30 days|Months 2-3|Months 4-6|Ongoing\"}]} with 8 to 12 steps.";
      const user =
        "Score range: " + String(b.score || "unknown").slice(0, 40) + "\nProblems: " + (arr(b.issues, 12, 60).join(", ") || "none listed") +
        "\nGoal: " + String(b.goal || "improve overall").slice(0, 200) + "\nMonthly money available for debt/credit building: " + String(b.income || "unknown").slice(0, 60);
      const o = parseObj(await ask(env, system, user, 1800));
      if (!o || !Array.isArray(o.steps)) return json({ error: "parse", message: "Couldn't build the plan. Try again." }, 502);
      return json({
        summary: String(o.summary || "").slice(0, 600),
        steps: o.steps.slice(0, 14).map(function (s) {
          return { title: String(s.title || "").slice(0, 120), detail: String(s.detail || "").slice(0, 500), when: String(s.when || "").slice(0, 40) };
        })
      });
    }
    if (b.kind === "grants") {
      const system =
        "You help people prepare to apply for assistance programs and grants. Do NOT name specific named programs unless they are nationwide federal ones everyone knows (e.g. LIHEAP, FAFSA, SBA); " +
        "never invent state program names, amounts, or deadlines. Explain what documents to gather, what eligibility usually depends on, how to find the real state programs, and how to spot scams (real grants never charge fees; ignore anyone who contacts you first). " +
        "Reply with ONLY JSON: {\"prep\":[\"short checklist items\"],\"tips\":[\"short tips\"],\"scams\":[\"short warnings\"]} with 5-8 prep items, 4-6 tips, 3-4 scam warnings.";
      const user = "State: " + String(b.state || "").slice(0, 40) + "\nNeeds: " + arr(b.categories, 8, 40).join(", ") + "\nSituation: " + String(b.situation || "").slice(0, 600);
      const o = parseObj(await ask(env, system, user, 1200));
      if (!o) return json({ error: "parse", message: "Couldn't build that. Try again." }, 502);
      return json({ prep: arr(o.prep, 10, 200), tips: arr(o.tips, 8, 250), scams: arr(o.scams, 6, 200) });
    }
    if (b.kind === "statement") {
      const system =
        "Write a short, honest, respectful statement of need (under 220 words) for an assistance or grant application, in first person, " +
        "using only the facts the person gave. Do not invent hardships, numbers, or details. End with a polite thank-you. Output only the statement.";
      const user = "Name: " + String(b.name || "").slice(0, 120) + "\nState: " + String(b.state || "").slice(0, 40) + "\nAssistance needed: " + String(b.category || "").slice(0, 100) + "\nSituation (their words): " + String(b.situation || "").slice(0, 1200);
      const text = await ask(env, system, user, 600);
      if (!text) return json({ error: "ai_error", message: "Empty reply." }, 502);
      return json({ statement: text });
    }
    return json({ error: "bad_kind" }, 400);
  } catch (err) {
    return json({ error: "ai_error", message: "That didn't go through. Try again." }, 502);
  }
}
