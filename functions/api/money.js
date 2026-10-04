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
  const out = r && (r.response || r.result);
  // Workers AI hands back an already-parsed object when the model replies with pure JSON
  if (out && typeof out === "object") return JSON.stringify(out);
  return String(out || "").trim();
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
        "Reply with ONLY JSON: {\"summary\":\"2-3 sentences\",\"steps\":[{\"title\":\"short\",\"detail\":\"specific what-to-do, 1-3 sentences\",\"when\":\"This week|Next 30 days|Months 2-3|Months 4-6|Ongoing\"}]} with 8 to 10 steps, each detail under 35 words.";
      const user =
        "Score range: " + String(b.score || "unknown").slice(0, 40) + "\nProblems: " + (arr(b.issues, 12, 60).join(", ") || "none listed") +
        "\nGoal: " + String(b.goal || "improve overall").slice(0, 200) + "\nMonthly money available for debt/credit building: " + String(b.income || "unknown").slice(0, 60);
      const rawPlan = await ask(env, system, user, 2800);
      let o = parseObj(rawPlan);
      if (!o || !Array.isArray(o.steps)) {
        // tolerate a cut-off or slightly malformed reply: harvest each complete step
        const steps = [];
        const re = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"detail"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"when"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let m;
        while ((m = re.exec(rawPlan)) !== null) steps.push({ title: m[1], detail: m[2], when: m[3] });
        const sm = rawPlan.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (steps.length) o = { summary: sm ? sm[1] : "", steps: steps };
      }
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
    if (b.kind === "essay") {
      const system =
        "Write a first-person answer to a job application question, under 150 words, using ONLY facts that appear in the applicant's résumé. " +
        "Be specific and plain. Do not invent employers, tools, numbers, degrees or experience. If the résumé doesn't support a strong answer, say what is true and keep it short. " +
        "Output only the answer text.";
      const user = "QUESTION:\n" + String(b.question || "").slice(0, 800) + "\n\nJOB: " + String(b.title || "").slice(0, 150) + " at " + String(b.company || "").slice(0, 150) +
        "\n\nJOB DESCRIPTION:\n" + String(b.description || "").slice(0, 1500) + "\n\nAPPLICANT RÉSUMÉ:\n" + String(b.resume || "").slice(0, 4500);
      const text = await ask(env, system, user, 450);
      if (!text) return json({ error: "ai_error", message: "Empty reply." }, 502);
      return json({ answer: text });
    }
    if (b.kind === "proposal") {
      const system =
        "Write a short, specific freelance proposal (under 170 words) answering a client's job post. Open with the client's problem in one sentence, " +
        "show 1-2 relevant proof points taken ONLY from the freelancer's background, outline a simple 3-step approach, and end with one clear question or next step. " +
        "No fluff, no invented clients or numbers. Output only the proposal text.";
      const user = "JOB POST:\n" + String(b.post || "").slice(0, 3000) + "\n\nFREELANCER BACKGROUND:\n" + String(b.background || "").slice(0, 2500) + "\nName: " + String(b.name || "").slice(0, 100);
      const text = await ask(env, system, user, 500);
      if (!text) return json({ error: "ai_error", message: "Empty reply." }, 502);
      return json({ proposal: text });
    }
    if (b.kind === "ideas") {
      const system =
        "You are a short-form and long-form content strategist. Give 8 specific, original content ideas for a beginner creator. For each: a scroll-stopping hook line (first 3 seconds) and the format. " +
        "Reply with ONLY JSON: {\"ideas\":[{\"hook\":\"...\",\"format\":\"...\"}]}";
      const user = "Niche: " + String(b.niche || "").slice(0, 120) + "\nPlatform: " + String(b.platform || "").slice(0, 60) + "\nAudience: " + String(b.audience || "").slice(0, 150);
      const rawIdeas = await ask(env, system, user, 1800);
      let o = parseObj(rawIdeas);
      if (!o) {
        // tolerate a cut-off reply: pull out each complete {"hook":..,"format":..} pair
        const found = [];
        const re = /"hook"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"format"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let m;
        while ((m = re.exec(rawIdeas)) !== null) found.push({ hook: m[1], format: m[2] });
        if (found.length) o = { ideas: found };
      }
      if (!o || !Array.isArray(o.ideas)) return json({ error: "parse", message: "Couldn't come up with ideas. Try again." }, 502);
      return json({ ideas: o.ideas.slice(0, 12).map(function (i) { return { hook: String(i.hook || "").slice(0, 200), format: String(i.format || "").slice(0, 80) }; }) });
    }
    return json({ error: "bad_kind" }, 400);
  } catch (err) {
    return json({ error: "ai_error", message: "That didn't go through. Try again." }, 502);
  }
}
