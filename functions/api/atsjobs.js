// Cloudflare Pages Function — GET /api/atsjobs?what=&where=&remote=1&batch=0..5
// Jobs the auto-apply bot can actually apply to: openings on Greenhouse, Lever and Ashby, read from those
// systems' own public job-board feeds (the ones companies publish so anyone can list their jobs).
// Each batch covers about a sixth of the boards so every request stays within Cloudflare's subrequest limit;
// the app calls all six batches in parallel and merges them.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
function json(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, CORS) }); }
export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

// [system, board slug, company name]. Each slug was checked to return live openings.
const BOARDS = [
  ["gh","gitlab","GitLab"],["gh","airbnb","Airbnb"],["gh","robinhood","Robinhood"],["gh","discord","Discord"],["gh","webflow","Webflow"],["gh","instacart","Instacart"],
  ["gh","duolingo","Duolingo"],["gh","twilio","Twilio"],["gh","dropbox","Dropbox"],["gh","asana","Asana"],["gh","figma","Figma"],["gh","gusto","Gusto"],
  ["gh","pinterest","Pinterest"],["gh","lyft","Lyft"],["gh","samsara","Samsara"],["gh","brex","Brex"],["gh","reddit","Reddit"],["gh","coinbase","Coinbase"],
  ["gh","anthropic","Anthropic"],["gh","cloudflare","Cloudflare"],["gh","stripe","Stripe"],["gh","elastic","Elastic"],["gh","okta","Okta"],["gh","databricks","Databricks"],
  ["gh","datadog","Datadog"],["gh","mongodb","MongoDB"],["gh","chime","Chime"],["gh","fivetran","Fivetran"],["gh","carta","Carta"],["gh","peloton","Peloton"],
  ["gh","affirm","Affirm"],["gh","toast","Toast"],["gh","gleanwork","Glean"],["gh","zocdoc","Zocdoc"],["gh","flexport","Flexport"],["gh","braze","Braze"],["gh","squarespace","Squarespace"],
  ["lever","spotify","Spotify"],["lever","jumpcloud","JumpCloud"],["lever","coupa","Coupa"],["lever","outreach","Outreach"],["lever","aircall","Aircall"],["lever","palantir","Palantir"],
  ["lever","gopuff","Gopuff"],["lever","wealthfront","Wealthfront"],["lever","rover","Rover"],["lever","neon","Neon"],
  ["ashby","ramp","Ramp"],["ashby","notion","Notion"],["ashby","linear","Linear"],["ashby","openai","OpenAI"],["ashby","anyscale","Anyscale"],["ashby","benchling","Benchling"],
  ["ashby","replit","Replit"],["ashby","perplexity","Perplexity"],["ashby","vanta","Vanta"],["ashby","cohere","Cohere"],["ashby","harvey","Harvey"],["ashby","modal","Modal"],
  ["ashby","supabase","Supabase"],["ashby","watershed","Watershed"],["ashby","sierra","Sierra"],["ashby","1password","1Password"]
];
const BATCHES = 6;

function words(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(function (w) { return w.length > 1; }); }
function termMatch(hay, terms) {
  const h = " " + words(hay).join(" ") + " ";
  return terms.some(function (t) { const ws = words(t); return ws.length && ws.every(function (w) { return h.indexOf(" " + w) !== -1; }); });
}
function remoteish(s) { return /remote|anywhere|distributed/i.test(String(s || "")); }
const opts = { headers: { accept: "application/json", "user-agent": "CindyCareerCopilot/1.0 (job search tool)" }, cf: { cacheTtl: 1800, cacheEverything: true } };

async function board(b) {
  const sys = b[0], slug = b[1], name = b[2];
  try {
    if (sys === "gh") {
      const r = await fetch("https://boards-api.greenhouse.io/v1/boards/" + slug + "/jobs", opts); if (!r.ok) return [];
      const d = await r.json();
      return (d.jobs || []).map(function (j) { return { title: j.title || "", company: j.company_name || name, location: (j.location && j.location.name) || "", url: j.id ? "https://job-boards.greenhouse.io/" + slug + "/jobs/" + j.id : "", created: j.updated_at || "", description: "", dept: "", source: "Greenhouse", ats: "greenhouse" }; });
    }
    if (sys === "lever") {
      const r = await fetch("https://api.lever.co/v0/postings/" + slug + "?mode=json", opts); if (!r.ok) return [];
      const d = await r.json();
      return (Array.isArray(d) ? d : []).map(function (j) { return { title: j.text || "", company: name, location: (j.categories && j.categories.location) || "", url: j.hostedUrl || "", created: j.createdAt ? new Date(j.createdAt).toISOString() : "", description: String(j.descriptionPlain || "").slice(0, 1500), dept: (j.categories && j.categories.team) || "", source: "Lever", ats: "lever" }; });
    }
    const r = await fetch("https://api.ashbyhq.com/posting-api/job-board/" + slug, opts); if (!r.ok) return [];
    const d = await r.json();
    return (d.jobs || []).filter(function (j) { return j.isListed !== false; }).map(function (j) { return { title: j.title || "", company: name, location: (j.location || "") + (j.isRemote ? " (Remote)" : ""), url: j.jobUrl || "", created: j.publishedAt || "", description: String(j.descriptionPlain || "").slice(0, 1500), dept: j.department || "", source: "Ashby", ats: "ashby" }; });
  } catch (e) { return []; }
}

export async function onRequestGet(ctx) {
  try { return await handle(ctx.request); } catch (e) { return json({ results: [], boards: 0, error: "failed" }); }
}
async function handle(request) {
  const u = new URL(request.url);
  const what = (u.searchParams.get("what") || "").slice(0, 200);
  const where = (u.searchParams.get("where") || "").trim().toLowerCase().slice(0, 100);
  const remote = u.searchParams.get("remote") === "1";
  const batch = Math.max(0, Math.min(BATCHES - 1, parseInt(u.searchParams.get("batch"), 10) || 0));
  if (!what.trim()) return json({ error: "missing_query" }, 400);
  const terms = what.split(/[,\n;]+/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 8);

  const mine = BOARDS.filter(function (_, i) { return i % BATCHES === batch; });
  const lists = await Promise.all(mine.map(board));
  const out = [];
  lists.forEach(function (l) {
    l.forEach(function (j) {
      if (!j.url || !j.title) return;
      if (!termMatch(j.title + " " + j.dept, terms)) return;
      if (remote) { if (!remoteish(j.location)) return; }
      else if (where) {
        const loc = j.location.toLowerCase();
        const parts = where.split(/[ ,]+/).filter(function (p) { return p.length > 1; });
        if (!(parts.some(function (p) { return loc.indexOf(p) !== -1; }) || remoteish(loc))) return;
      }
      out.push(j);
    });
  });
  out.sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); });
  return json({ results: out.slice(0, 40), boards: mine.length });
}
