// Cloudflare Pages Function — GET /api/findapply?company=…&title=…
// Looks for the company's own application page for a job by checking the public job-board
// APIs of the common applicant-tracking systems (Greenhouse, Lever, Ashby). Returns
// {url, source} when a close title match is found, or {url:null}. Never touches LinkedIn/Indeed/Adzuna.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, CORS) });
}
export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

const STOP = { inc: 1, llc: 1, ltd: 1, corp: 1, co: 1, company: 1, the: 1, group: 1, and: 1, of: 1 };

function slugs(company) {
  const words = company.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const core = words.filter(function (w) { return !STOP[w]; });
  const out = [];
  const add = function (s) { if (s && s.length > 1 && out.indexOf(s) === -1) out.push(s); };
  add(core.join(""));
  add(core.join("-"));
  add(words.join(""));
  add(core[0]);
  return out.slice(0, 4);
}

function tokens(t) {
  return t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(function (w) { return w.length > 1 && !STOP[w]; });
}
function score(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  const setB = {};
  B.forEach(function (w) { setB[w] = 1; });
  const inter = A.filter(function (w) { return setB[w]; }).length;
  return inter / (A.length + B.length - inter);
}

async function get(url) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, 4500);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const company = (u.searchParams.get("company") || "").slice(0, 120).trim();
  const title = (u.searchParams.get("title") || "").slice(0, 160).trim();
  if (!company || !title) return json({ error: "missing", message: "Need a company and a job title." }, 400);

  const jobs = []; // {title, url, source}
  const tasks = [];
  slugs(company).forEach(function (s) {
    tasks.push(get("https://boards-api.greenhouse.io/v1/boards/" + s + "/jobs").then(function (d) {
      ((d && d.jobs) || []).forEach(function (j) { jobs.push({ title: j.title || "", url: j.absolute_url, source: "Greenhouse" }); });
    }));
    tasks.push(get("https://api.lever.co/v0/postings/" + s + "?mode=json").then(function (d) {
      (Array.isArray(d) ? d : []).forEach(function (j) { jobs.push({ title: j.text || "", url: j.hostedUrl, source: "Lever" }); });
    }));
    tasks.push(get("https://api.ashbyhq.com/posting-api/job-board/" + s).then(function (d) {
      ((d && d.jobs) || []).forEach(function (j) { jobs.push({ title: j.title || "", url: j.jobUrl, source: "Ashby" }); });
    }));
  });
  await Promise.all(tasks);

  let best = null, bestScore = 0;
  jobs.forEach(function (j) {
    if (!j.url || !/^https:\/\//i.test(j.url)) return;
    const s = score(title, j.title);
    if (s > bestScore) { bestScore = s; best = j; }
  });
  if (best && bestScore >= 0.6) return json({ url: best.url, source: best.source, matched: best.title });
  return json({ url: null, checked: jobs.length });
}
