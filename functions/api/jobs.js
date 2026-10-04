// Cloudflare Pages Function — GET /api/jobs?what=...&where=...&country=us&page=1
// Proxies Adzuna's job search API so the App ID/Key never reach the browser.
// Adzuna aggregates listings from thousands of sources (including many that
// also appear on Indeed and other boards) — this is NOT LinkedIn or Indeed's
// own API (neither offers open self-serve access), just a compliant, real
// job-matching data source. Every result links out to the original posting
// for the user to review and apply themselves.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const what = (url.searchParams.get("what") || "").slice(0, 200);
  const where = (url.searchParams.get("where") || "").slice(0, 200);
  const country = (url.searchParams.get("country") || "us").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) || "us";
  const remote = url.searchParams.get("remote") === "1";
  const page = Math.max(1, Math.min(10, parseInt(url.searchParams.get("page"), 10) || 1));
  const jobType = (url.searchParams.get("type") || "").toLowerCase();
  const days = Math.max(0, Math.min(90, parseInt(url.searchParams.get("days"), 10) || 0));
  const sortNew = url.searchParams.get("sort") === "date";

  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    return json({ error: "not_configured", message: "Job matching isn't configured yet." }, 501);
  }
  if (!what.trim()) {
    return json({ error: "missing_query", message: "Add target roles/keywords in your Profile first." }, 400);
  }

  // Profile keyword lists are comma-separated ("data entry, admin, ecommerce…"). Adzuna ANDs every
  // word in one query, so a long list matches nothing — search each of the first few terms and merge.
  const terms = what.split(/[,;]+/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 4);
  const isRemote = function (r) {
    return /remote|work from home|work-from-home|telecommut|virtual|anywhere/i.test((r.title || "") + " " + (r.description || "") + " " + ((r.location && r.location.display_name) || ""));
  };
  const one = async function (term) {
    const u = new URL("https://api.adzuna.com/v1/api/jobs/" + country + "/search/" + page);
    u.searchParams.set("app_id", env.ADZUNA_APP_ID);
    u.searchParams.set("app_key", env.ADZUNA_APP_KEY);
    u.searchParams.set("results_per_page", remote ? "50" : "20");
    u.searchParams.set("what", remote ? term + " remote" : term);
    if (remote || sortNew) u.searchParams.set("sort_by", "date");
    if (!remote && where.trim()) u.searchParams.set("where", where);
    if (jobType === "full_time" || jobType === "part_time" || jobType === "contract") u.searchParams.set(jobType, "1");
    if (days) u.searchParams.set("max_days_old", String(days));
    u.searchParams.set("content-type", "application/json");
    const res = await fetch(u.toString());
    if (!res.ok) {
      const msg = await res.text().catch(function () { return ""; });
      throw new Error("Job search failed (" + res.status + "). " + msg.slice(0, 200));
    }
    return res.json();
  };

  try {
    const datas = await Promise.all(terms.map(one));
    const seen = {};
    const raw = [];
    datas.forEach(function (d) {
      (d.results || []).forEach(function (r) {
        const k = r.id || r.redirect_url;
        if (seen[k]) return;
        seen[k] = 1;
        if (!remote || isRemote(r)) raw.push(r);
      });
    });
    raw.sort(function (x, y) { return String(y.created || "").localeCompare(String(x.created || "")); });
    const results = raw.slice(0, 40).map(function (r) {
      return {
        title: r.title || "",
        company: (r.company && r.company.display_name) || "",
        location: (r.location && r.location.display_name) || "",
        url: r.redirect_url || "",
        created: r.created || "",
        description: (r.description || "").slice(0, 400),
        salaryMin: r.salary_min || null,
        salaryMax: r.salary_max || null
      };
    });
    return json({ count: results.length, results: results });
  } catch (err) {
    return json({ error: "adzuna_error", message: String(err && err.message || err) }, 502);
  }
}
