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
  const page = Math.max(1, Math.min(10, parseInt(url.searchParams.get("page"), 10) || 1));

  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    return json({ error: "not_configured", message: "Job matching isn't configured yet." }, 501);
  }
  if (!what.trim()) {
    return json({ error: "missing_query", message: "Add target roles/keywords in your Profile first." }, 400);
  }

  const adzunaUrl = new URL("https://api.adzuna.com/v1/api/jobs/" + country + "/search/" + page);
  adzunaUrl.searchParams.set("app_id", env.ADZUNA_APP_ID);
  adzunaUrl.searchParams.set("app_key", env.ADZUNA_APP_KEY);
  adzunaUrl.searchParams.set("results_per_page", "20");
  adzunaUrl.searchParams.set("what", what);
  if (where.trim()) adzunaUrl.searchParams.set("where", where);
  adzunaUrl.searchParams.set("content-type", "application/json");

  try {
    const res = await fetch(adzunaUrl.toString());
    if (!res.ok) {
      const msg = await res.text().catch(function(){ return ""; });
      return json({ error: "adzuna_error", message: "Job search failed (" + res.status + "). " + msg.slice(0,200) }, 502);
    }
    const data = await res.json();
    const results = (data.results || []).map(function(r) {
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
    return json({ count: data.count || results.length, results: results });
  } catch (err) {
    return json({ error: "adzuna_error", message: String(err && err.message || err) }, 502);
  }
}
