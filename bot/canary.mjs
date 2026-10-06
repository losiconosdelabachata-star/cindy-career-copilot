// Daily self-test for the auto-apply bot. For Greenhouse, Lever and Ashby it takes a LIVE public opening (from the
// system's own job-board feed, so the link is never stale), runs the bot in practice mode with a made-up candidate,
// and checks that the form really gets filled. Nothing is ever submitted and no real person's data is used.
// A failure here means a form changed and the bot needs an update; the workflow fails so GitHub emails the owner.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

async function getJson(u) { try { const r = await fetch(u, { signal: AbortSignal.timeout(15000) }); return r.ok ? await r.json() : null; } catch (e) { return null; } }

const SOURCES = {
  greenhouse: async () => {
    for (const slug of ["gitlab", "airbnb", "discord", "figma", "reddit"]) {
      const d = await getJson("https://boards-api.greenhouse.io/v1/boards/" + slug + "/jobs");
      const j = d && d.jobs && d.jobs.find(x => x.absolute_url);
      if (j) return j.absolute_url;
    }
  },
  lever: async () => {
    for (const slug of ["spotify", "palantir", "aircall", "outreach"]) {
      const d = await getJson("https://api.lever.co/v0/postings/" + slug + "?mode=json");
      const j = Array.isArray(d) && d.find(x => x.hostedUrl);
      if (j) return j.hostedUrl.replace(/\/?$/, "/apply");
    }
  },
  ashby: async () => {
    for (const slug of ["ramp", "notion", "linear", "openai", "vanta"]) {
      const d = await getJson("https://api.ashbyhq.com/posting-api/job-board/" + slug);
      const j = d && d.jobs && d.jobs.find(x => x.jobUrl && x.isListed !== false);
      if (j) return j.jobUrl;
    }
  }
};

const candidate = {
  profile: { name: "Test Candidate", email: "test.candidate@example.com", phone: "555-010-0199", location: "Miami, FL", linkedin: "https://www.linkedin.com/in/test-candidate", website: "" },
  resume: "Test Candidate\nMiami, FL | test.candidate@example.com\n\nSUMMARY\nOperations and support professional.\n\nEXPERIENCE\nSupport Lead, Example Co (2021-2026)\n- Resolved 40 tickets a day with 96% satisfaction\n\nEDUCATION\nBA, Example University",
  coverLetter: "Dear Hiring Team,\n\nThis is an automated practice run and will not be submitted.\n\nTest Candidate",
  answers: { workAuth: "Yes", sponsor: "No", country: "United States", heard: "Company website", over18: "Yes", gender: "Decline to answer", race: "Decline to answer", veteran: "Decline to answer", disability: "Decline to answer" }
};

let failures = 0;
const summary = [];
for (const [name, pick] of Object.entries(SOURCES)) {
  const url = await pick();
  if (!url) { summary.push(name + ": SKIPPED (no live opening found)"); continue; }
  fs.writeFileSync("bot/canary-packet.json", JSON.stringify(Object.assign({ url, mode: "dry" }, candidate)));
  try { fs.rmSync("bot/out/result.json"); } catch (e) {}
  const r = spawnSync("node", ["bot/apply.mjs"], { env: Object.assign({}, process.env, { LOCAL_PACKET: "bot/canary-packet.json" }), encoding: "utf8", timeout: 170000 });
  let res = null;
  try { res = JSON.parse(fs.readFileSync("bot/out/result.json", "utf8")); } catch (e) {}
  const filled = res && res.filled ? res.filled.length : 0;
  const ok = res && (res.status === "dry_run_ok" || res.status === "needs_you") && filled >= 4;
  if (!ok) failures++;
  summary.push(name + ": " + (ok ? "OK" : "FAIL") + " | " + url + " | status=" + (res && res.status) + " filled=" + filled + (res ? " | " + String(res.message).slice(0, 160) : " | " + String(r.stderr || "").slice(0, 160)));
}
console.log("\n===== CANARY SUMMARY =====\n" + summary.join("\n"));
process.exit(failures ? 1 : 0);
