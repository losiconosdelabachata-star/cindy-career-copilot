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

if (/(^|\.)(linkedin|indeed)\.com/i.test(new URL(packet.url).hostname)) {
  await report("needs_you", "LinkedIn and Indeed don't allow bots — use the Apply assistant there.");
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

const page = await (await browser.newContext({ viewport: { width: 1280, height: 1800 } })).newPage();
try {
  await report("running", "Opening the application…");
  await page.goto(packet.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  // jump to the form if the posting page has an Apply button/tab first (only a VISIBLE file or
  // first-name field counts as "already on the form")
  async function onForm() {
    for (const sel of ["input[type=file]", "input[name*=first i]", "input[id*=first i]", "input[autocomplete=given-name]"]) {
      const loc = page.locator(sel);
      for (let i = 0; i < Math.min(await loc.count(), 5); i++) if (await loc.nth(i).isVisible().catch(() => false)) return true;
    }
    return false;
  }
  for (let attempt = 0; attempt < 2 && !(await onForm()); attempt++) {
    const re = /^\s*(apply( now| for this (job|position|role))?|application|start application)\s*$/i;
    const btn = page.getByRole("link", { name: re }).or(page.getByRole("button", { name: re })).or(page.getByRole("tab", { name: re })).first();
    if (!(await btn.count())) break;
    await btn.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(4000);
  }
  if (await page.locator("iframe[src*=recaptcha], iframe[src*=hcaptcha], .g-recaptcha, .h-captcha, [data-sitekey]").count()) {
    await report("needs_you", "This form has a CAPTCHA, so a bot can't finish it. Apply by hand — your materials are in the Apply assistant.");
    process.exit(0);
  }
  // greenhouse embeds the form in an iframe
  const gh = page.frames().find(f => /greenhouse\.io/.test(f.url()) && f !== page.mainFrame());
  const root = gh || page;

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
