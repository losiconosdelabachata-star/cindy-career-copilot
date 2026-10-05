// Cloudflare Pages Function — GET /api/mercor
// Shows the public job listings from Mercor's own "Explore opportunities" page (https://work.mercor.com/explore).
// That page is public (no login) and its robots.txt allows it; we read the listing data it ships with and cache it for 30 minutes.
// We only show listings and link back to Mercor to apply. Applying always happens on Mercor's site.
// Not affiliated with or endorsed by Mercor.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
const SRC = "https://work.mercor.com/explore";

function json(data, status, extra) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, CORS, extra || {}) });
}
export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

function findListings(o, depth) {
  if (!o || typeof o !== "object" || depth > 8) return null;
  if (Array.isArray(o)) {
    if (o.length && o[0] && typeof o[0] === "object" && "listingId" in o[0] && "title" in o[0]) return o;
    for (let i = 0; i < o.length && i < 50; i++) { const r = findListings(o[i], depth + 1); if (r) return r; }
    return null;
  }
  for (const k in o) { const r = findListings(o[k], depth + 1); if (r) return r; }
  return null;
}
function slug(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request("https://cindy-career-copilot.pages.dev/__cache/mercor-v2");
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { status: 200, headers: Object.assign({ "content-type": "application/json" }, CORS, { "x-cache": "hit" }) });

  let raw = null, lastErr = "no_data";
  for (let attempt = 0; attempt < 2 && !raw; attempt++) {
    try {
      const r = await fetch(SRC, { headers: { "user-agent": "Mozilla/5.0 (compatible; CindyCareerCopilot/1.0; +https://cindy-career-copilot.pages.dev)", accept: "text/html" } });
      if (!r.ok) { lastErr = "source_" + r.status; continue; }
      const html = await r.text();
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) { lastErr = "no_data"; continue; }
      const data = JSON.parse(m[1]);
      raw = findListings(data && data.props && data.props.pageProps, 0);
      if (!raw) lastErr = "no_listings";
    } catch (e) { lastErr = "source_unreachable"; }
  }
  if (!raw) return json({ error: lastErr }, 502);

  const seen = {}, out = [];
  raw.forEach(function (j) {
    if (!j || !j.listingId || seen[j.listingId]) return;
    if (j.deletedAt || j.isPrivate || (j.status && j.status !== "active")) return;
    seen[j.listingId] = 1;
    out.push({
      id: j.listingId,
      title: String(j.title || "").slice(0, 140),
      description: String(j.description || "").slice(0, 900),
      commitment: j.commitment || "",
      rateMin: typeof j.rateMin === "number" ? j.rateMin : null,
      rateMax: typeof j.rateMax === "number" ? j.rateMax : null,
      per: j.payRateFrequency || "",
      hours: j.hoursPerWeek || null,
      location: j.location || "",
      arrangement: j.workArrangement || "",
      createdAt: j.createdAt || "",
      url: "https://work.mercor.com/jobs/" + j.listingId + "/" + slug(j.title)
    });
  });
  out.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  const body = JSON.stringify({ source: SRC, fetchedAt: new Date().toISOString(), count: out.length, listings: out.slice(0, 400) });
  waitUntil(cache.put(key, new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=1800" } })));
  return new Response(body, { status: 200, headers: Object.assign({ "content-type": "application/json" }, CORS, { "x-cache": "miss" }) });
}
