// Auto-apply bot (runs in GitHub Actions). Fills a company-hosted application
// form (Greenhouse / Lever / Ashby / most simple forms). It NEVER guesses:
// any required field it can't fill, any CAPTCHA, or any login wall stops the
// run with status "needs_you". LinkedIn / Indeed are refused outright.
import { chromium } from "playwright";
import fs from "node:fs";

const { RUN_ID, BOT_SECRET, API_BASE } = process.env;
// GitHub Actions identity token (audience-scoped) — verified server-side, no shared secret needed
const idRes = await fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL + "&audience=cindy-career-copilot", {
  headers: { authorization: "Bearer " + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN }
});
const { value: idToken } = await idRes.json();
const H = { authorization: "Bearer " + idToken, "x-bot-secret": BOT_SECRET || "", "content-type": "application/json" };

async function report(status, message, filled = [], missing = []) {
  console.log(status, message, filled, missing);
  await fetch(API_BASE + "/api/autoapply/bot", { method: "POST", headers: H, body: JSON.stringify({ id: RUN_ID, status, message, filled, missing }) }).catch(() => {});
}

const res = await fetch(API_BASE + "/api/autoapply/bot?id=" + RUN_ID, { headers: H });
if (!res.ok) { console.error("no packet", res.status); process.exit(1); }
const { packet } = await res.json();
const P = packet.profile;
const [first, ...rest] = P.name.trim().split(/\s+/);
const last = rest.join(" ") || first;

if (/(^|\.)(linkedin|indeed|adzuna|ziprecruiter|glassdoor|monster|simplyhired)\.(com|co\.uk)$/i.test(new URL(packet.url).hostname)) {
  await report("needs_you", "Job boards like LinkedIn, Indeed and Adzuna don't allow bots. Open the job, click Apply there, and save the company's own apply link on the job instead.");
  process.exit(0);
}

// plain-text résumé / cover letter -> PDFs the form can accept
fs.mkdirSync("bot/out", { recursive: true });
const browser = await chromium.launch();
async function toPdf(text, file) {
  const pg = await browser.newPage();
  const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  await pg.setContent('<body style="font:12pt Helvetica,Arial,sans-serif;white-space:pre-wrap;margin:0">' + esc(text) + "</body>");
  await pg.pdf({ path: file, format: "Letter", margin: { top: "0.7in", bottom: "0.7in", left: "0.8in", right: "0.8in" } });
  await pg.close();
}
const resumePdf = "bot/out/resume.pdf", coverPdf = "bot/out/cover-letter.pdf";
await toPdf(packet.resume, resumePdf);
if (packet.coverLetter) await toPdf(packet.coverLetter, coverPdf);

const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
let page = await context.newPage();
let popup = null;
context.on("page", p => { popup = p; });
try {
  await report("running", "Opening the application…");
  await page.goto(packet.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  // How many visible inputs a frame has — the frame with the most is the application form (some
  // companies embed the form in an iframe). A visible file or first-name field means "on the form".
  async function visibleCount(fr) {
    const els = await fr.locator("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=search]), textarea, select").elementHandles().catch(() => []);
    let n = 0;
    for (const el of els) if (await el.isVisible().catch(() => false)) n++;
    return n;
  }
  async function bestFrame() {
    let best = page.mainFrame(), bestN = await visibleCount(best);
    for (const fr of page.frames()) {
      if (fr === page.mainFrame()) continue;
      const n = await visibleCount(fr);
      if (n > bestN) { best = fr; bestN = n; }
    }
    return { frame: best, n: bestN };
  }
  async function onForm() { return (await bestFrame()).n >= 4; }

  // jump to the form if the posting page has an Apply button/tab first; follow it if it opens a new tab
  for (let attempt = 0; attempt < 3 && !(await onForm()); attempt++) {
    const re = /^\s*(apply\b(?!\s+(filters?|sort))|start (your )?application|application\s*$)/i;
    const cands = page.getByRole("link", { name: re }).or(page.getByRole("button", { name: re })).or(page.getByRole("tab", { name: re }));
    const total = await cands.count();
    console.log("apply controls found:", total, "| url:", page.url());
    if (!total) break;
    // click the first VISIBLE match (pages often have hidden mobile/desktop duplicates)
    let clicked = false, href = "";
    for (let i = 0; i < Math.min(total, 8) && !clicked; i++) {
      const c = cands.nth(i);
      if (!(await c.isVisible().catch(() => false))) continue;
      href = href || (await c.getAttribute("href").catch(() => "")) || "";
      popup = null;
      clicked = await c.click({ timeout: 6000 }).then(() => true).catch(() => false);
    }
    if (!href) href = (await cands.first().getAttribute("href").catch(() => "")) || "";
    await page.waitForTimeout(4000);
    if (popup) { page = popup; await page.waitForLoadState("domcontentloaded").catch(() => {}); await page.waitForTimeout(3000); }
    // click didn't get us there? go straight to the link's address
    if (!(await onForm()) && href && !/^(#|javascript:)/i.test(href)) {
      await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(4500);
    }
  }
  const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (/suspicious (behaviou?r|activity)|unusual (traffic|behaviou?r)|verify you are (a )?human|access denied|are you a robot/.test(bodyText)) {
    await report("needs_you", "That site blocks automated visits, so I stopped. Apply by hand — your materials are ready in the Apply window.");
    process.exit(0);
  }
  if (await page.locator("iframe[src*=recaptcha], iframe[src*=hcaptcha], .g-recaptcha, .h-captcha, [data-sitekey]").count()) {
    await report("needs_you", "This form has a CAPTCHA, so a bot can't finish it. Apply by hand — your materials are in the Apply assistant.");
    process.exit(0);
  }
  const gh = (await bestFrame()).frame;
  const root = gh === page.mainFrame() ? page : gh;

  const filled = [], missing = [];
  const fields = await root.locator("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select").elementHandles();
  for (const el of fields) {
    if (!(await el.isVisible())) continue;
    const info = await el.evaluate(n => {
      const id = n.id;
      const lab = (id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) || n.closest("label") || n.closest("div")?.querySelector("label");
      return {
        tag: n.tagName.toLowerCase(), type: (n.type || "").toLowerCase(),
        text: ((lab && lab.innerText) || n.getAttribute("aria-label") || n.placeholder || n.name || id || "").trim().toLowerCase(),
        required: n.required || n.getAttribute("aria-required") === "true" || /\*/.test((lab && lab.innerText) || ""),
        value: n.value, checked: n.checked
      };
    });
    const t = info.text;
    let val = null, file = null;
    if (info.type === "file") file = /cover/.test(t) ? (packet.coverLetter ? coverPdf : null) : resumePdf;
    else if (/first.?name|given name/.test(t)) val = first;
    else if (/last.?name|family name|surname/.test(t)) val = last;
    else if (/full.?name|^name|your name/.test(t)) val = P.name;
    else if (/e-?mail/.test(t)) val = P.email;
    else if (/phone|mobile/.test(t)) val = P.phone;
    else if (/linkedin/.test(t)) val = P.linkedin;
    else if (/\bwebsite\b|portfolio|\bgithub\b|\burl\b/.test(t) && !/\?/.test(t)) val = P.website;
    else if (/location \(city\)|^location|^city|\bcity\b/.test(t) && !/\?/.test(t)) val = P.location;
    else if (info.tag === "textarea" && /cover|letter|why|message|additional/.test(t)) val = packet.coverLetter;

    const label = t.slice(0, 60) || info.type;
    if (file) { await el.setInputFiles(file).catch(() => {}); filled.push(label); continue; }
    if (val && info.tag !== "select") {
      if (!info.value) await el.fill(val).catch(() => {});
      filled.push(label); continue;
    }
    // anything required that we don't know how to answer: stop, don't guess
    if (info.required && !info.value && !info.checked && info.type !== "file") missing.push(t.slice(0, 100) || "(unlabeled required field)");
  }

  await page.screenshot({ path: "bot/out/form.png", fullPage: true });
  if (missing.length) {
    await report("needs_you", "The form asks questions I won't guess at. Finish those by hand.", filled, missing);
    process.exit(0);
  }
  if (!filled.length) {
    await report("needs_you", "I couldn't find an application form on that page.", filled, missing);
    process.exit(0);
  }
  if (packet.mode !== "submit") {
    await report("dry_run_ok", "Practice run done — the form filled cleanly and nothing was submitted.", filled, missing);
    process.exit(0);
  }

  const submit = root.getByRole("button", { name: /submit|send application|apply/i }).last();
  await submit.click({ timeout: 10000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "bot/out/after.png", fullPage: true });
  const body = (await page.locator("body").innerText().catch(() => "")) + (gh ? await gh.locator("body").innerText().catch(() => "") : "");
  if (/thank you|application (has been )?(received|submitted)|successfully (submitted|applied)|we('ve| have) received/i.test(body)) {
    await report("submitted", "Application submitted.", filled);
  } else {
    await report("needs_you", "I clicked submit but can't confirm it went through — check your email or the posting.", filled);
  }
} catch (e) {
  await page.screenshot({ path: "bot/out/error.png" }).catch(() => {});
  await report("failed", "The bot hit a snag: " + String(e.message).slice(0, 200));
} finally {
  await browser.close();
}
