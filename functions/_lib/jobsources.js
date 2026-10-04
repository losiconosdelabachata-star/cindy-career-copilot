// Extra free job sources for Job Matches. Each fetcher returns normalized jobs:
//   {title, company, location, url, created, description, salaryMin, salaryMax, source}
// All of them are public feeds that ask for a link back to the source — the UI shows the
// source name and links to the original listing. Failures return [] so one flaky source
// never breaks a search.

function strip(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

async function getJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "CindyCareerCopilot/1.0 (job search tool)" } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(timer); }
}
async function getText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "CindyCareerCopilot/1.0 (job search tool)" } });
    if (!r.ok) return "";
    return await r.text();
  } catch (e) { return ""; } finally { clearTimeout(timer); }
}

function wordsOf(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(function (w) { return w.length > 1; }); }

// A job matches if, for at least one search term, every word of that term appears in the job's text.
export function matchesTerms(job, terms) {
  const hay = " " + wordsOf(job.title + " " + job.description + " " + job.company).join(" ") + " ";
  return terms.some(function (term) {
    const ws = wordsOf(term);
    return ws.length && ws.every(function (w) { return hay.indexOf(" " + w) !== -1; });
  });
}

async function remotive(terms) {
  const out = [];
  await Promise.all(terms.slice(0, 3).map(async function (t) {
    const d = await getJson("https://remotive.com/api/remote-jobs?limit=25&search=" + encodeURIComponent(t));
    ((d && d.jobs) || []).forEach(function (j) {
      out.push({ title: j.title || "", company: (j.company_name || "").trim(), location: j.candidate_required_location || "Remote", url: j.url, created: j.publication_date || "",
        description: strip(j.description).slice(0, 1500), salaryMin: null, salaryMax: null, salaryText: j.salary || "", source: "Remotive" });
    });
  }));
  return out;
}

async function remoteok(terms) {
  const d = await getJson("https://remoteok.com/api");
  const jobs = Array.isArray(d) ? d.slice(1) : [];
  return jobs.map(function (j) {
    return { title: j.position || "", company: j.company || "", location: j.location || "Remote", url: j.url || j.apply_url, created: j.date || "",
      description: strip(j.description).slice(0, 1500), salaryMin: j.salary_min || null, salaryMax: j.salary_max || null, source: "RemoteOK" };
  });
}

async function jobicy(terms) {
  const d = await getJson("https://jobicy.com/api/v2/remote-jobs?count=50");
  return ((d && d.jobs) || []).map(function (j) {
    return { title: j.jobTitle || "", company: j.companyName || "", location: j.jobGeo || "Remote", url: j.url, created: j.pubDate || "",
      description: strip(j.jobExcerpt || j.jobDescription).slice(0, 1500), salaryMin: j.salaryMin || null, salaryMax: j.salaryMax || null, source: "Jobicy" };
  });
}

async function himalayas(terms) {
  const out = [];
  await Promise.all(terms.slice(0, 2).map(async function (t) {
    const d = await getJson("https://himalayas.app/jobs/api/search?q=" + encodeURIComponent(t) + "&limit=20");
    ((d && d.jobs) || []).forEach(function (j) {
      out.push({ title: j.title || "", company: j.companyName || "", location: (Array.isArray(j.locationRestrictions) && j.locationRestrictions.length && j.locationRestrictions.length <= 4) ? j.locationRestrictions.join(", ") : "Remote", url: j.applicationLink || j.guid, created: j.pubDate ? new Date(j.pubDate * (j.pubDate < 1e12 ? 1000 : 1)).toISOString() : "",
        description: strip(j.excerpt || j.description).slice(0, 1500), salaryMin: Number(j.minSalary) || null, salaryMax: Number(j.maxSalary) || null, source: "Himalayas" });
    });
  }));
  return out;
}

async function weworkremotely() {
  const xml = await getText("https://weworkremotely.com/remote-jobs.rss");
  const items = xml.split("<item>").slice(1);
  return items.map(function (it) {
    const tag = function (n) {
      const m = it.match(new RegExp("<" + n + "[^>]*>([\\s\\S]*?)</" + n + ">"));
      return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    };
    const full = strip(tag("title"));
    const idx = full.indexOf(":");
    return { title: idx > -1 ? full.slice(idx + 1).trim() : full, company: idx > -1 ? full.slice(0, idx).trim() : "", location: tag("region") || "Remote",
      url: tag("link"), created: tag("pubDate") ? new Date(tag("pubDate")).toISOString() : "", description: strip(tag("description")).slice(0, 1500),
      salaryMin: null, salaryMax: null, source: "We Work Remotely" };
  });
}

export async function fetchMoreSources(terms) {
  const lists = await Promise.all([remotive(terms), remoteok(terms), jobicy(terms), himalayas(terms), weworkremotely()]);
  const seen = {}, out = [];
  lists.forEach(function (l) {
    l.forEach(function (j) {
      if (!j.url || !/^https:\/\//i.test(j.url) || !j.title) return;
      const k = (j.company + "|" + j.title).toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      if (matchesTerms(j, terms)) out.push(j);
    });
  });
  return out;
}
