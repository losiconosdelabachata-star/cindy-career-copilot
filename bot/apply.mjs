// Auto-apply bot (runs in GitHub Actions). Fills a company-hosted application
// form (Greenhouse / Lever / Ashby / most simple forms). It NEVER guesses:
// any required field it can't fill, any CAPTCHA, or any login wall stops the
// run with status "needs_you". LinkedIn / Indeed are refused outright.
import { chromium } from "playwright";
import fs from "node:fs";

const { RUN_ID, BOT_SECRET, API_BASE, LOCAL_PACKET } = process.env;
// LOCAL_PACKET (a JSON file path) is the self-test mode used by the daily canary workflow: no server, no account, practice run only.
let H = {}, packet;
if (LOCAL_PACKET) {
  packet = JSON.parse(fs.readFileSync(LOCAL_PACKET, "utf8"));
  packet.mode = "dry";
} else {
  // GitHub Actions identity token (audience-scoped) — verified server-side, no shared secret needed
  const idRes = await fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL + "&audience=cindy-career-copilot", {
    headers: { authorization: "Bearer " + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN }
  });
  const { value: idToken } = await idRes.json();
  H = { authorization: "Bearer " + idToken, "x-bot-secret": BOT_SECRET || "", "content-type": "application/json" };
}

async function report(status, message, filled = [], missing = []) {
  console.log(status, message, filled, missing);
  if (LOCAL_PACKET) { fs.mkdirSync("bot/out", { recursive: true }); fs.writeFileSync("bot/out/result.json", JSON.stringify({ status, message, filled, missing })); return; }
  await fetch(API_BASE + "/api/autoapply/bot", { method: "POST", headers: H, body: JSON.stringify({ id: RUN_ID, status, message, filled, missing }) }).catch(() => {});
}

if (!LOCAL_PACKET) {
  const res = await fetch(API_BASE + "/api/autoapply/bot?id=" + RUN_ID, { headers: H });
  if (!res.ok) { console.error("no packet", res.status); process.exit(1); }
  packet = (await res.json()).packet;
}
const P = packet.profile;
const [first, ...rest] = P.name.trim().split(/\s+/);
const last = rest.join(" ") || first;

if (/(^|\.)(linkedin|indeed|adzuna|ziprecruiter|glassdoor|monster|simplyhired|remotive|remoteok|jobicy|himalayas|weworkremotely|themuse|arbeitnow|flexjobs)\.(com|co\.uk|io|app)$/i.test(new URL(packet.url).hostname)) {
  await report("needs_you", "Job boards like LinkedIn, Indeed and Adzuna don't allow bots. Open the job, click Apply there, and save the company's own apply link on the job instead.");
  process.exit(0);
}

// The bot is built and tested for Greenhouse, Lever and Ashby application pages only. Other company systems
// (Workday, Phenom, iCIMS, Taleo...) need an account or multi-step sign-in, which the bot never creates.
if (!/(^|.)(greenhouse.io|lever.co|ashbyhq.com)$/i.test(new URL(packet.url).hostname)) {
  await report("needs_you", "This company uses an application system the bot doesn't support (" + new URL(packet.url).hostname + "). The bot works on Greenhouse, Lever and Ashby pages, and it never creates accounts. Apply by hand with the résumé and cover letter in the Apply window, or search 'Only jobs the bot can apply to' in Job Matches.");
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
  // Cookie banners cover the page and its buttons. Choose the privacy-friendly option (reject / necessary only).
  async function dismissCookies() {
    const sels = ["#onetrust-reject-all-handler", "button#reject-all", "button[id*=reject i]", "[data-testid*=reject i]"];
    for (const sel of sels) {
      const el = page.locator(sel).first();
      if (await el.isVisible().catch(() => false)) { await el.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); return; }
    }
    const btn = page.getByRole("button", { name: /^s*(reject all|reject non-?essential|decline( all)?|only (necessary|essential)|necessary only|deny)s*$/i }).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); }
  }
  await dismissCookies();

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
  // Many systems (Ashby especially) load the form after the page appears ("Fetching application form…"), so wait for it.
  async function waitForForm(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await onForm()) return true; await page.waitForTimeout(1000); }
    return onForm();
  }

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
    await waitForForm(15000);
    // click didn't get us there? go straight to the link's address
    if (!(await onForm()) && href && !/^(#|javascript:)/i.test(href)) {
      await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(4500);
    }
  }
  await waitForForm(12000);
  await dismissCookies();
  // Still no application form? Say why: an account/sign-in wall, or just a job description page.
  if (!(await onForm())) {
    const pw = await page.locator("input[type=password]").first().isVisible().catch(() => false);
    const t0 = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (pw || /sign in to (apply|continue)|log ?in to (apply|continue)|create (an )?account to apply|create (your )?account/.test(t0)) {
      await page.screenshot({ path: "bot/out/error.png", fullPage: true }).catch(() => {});
      await report("needs_you", "This company makes you sign in or create an account before applying, and the bot never creates accounts or enters passwords. Apply by hand — your résumé and cover letter are ready in the Apply window.");
      process.exit(0);
    }
  }
  const bodyText = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (/suspicious (behaviou?r|activity)|unusual (traffic|behaviou?r)|verify you are (a )?human|access denied|are you a robot/.test(bodyText)) {
    await report("needs_you", "That site blocks automated visits, so I stopped. Apply by hand — your materials are ready in the Apply window.");
    process.exit(0);
  }
  // A CAPTCHA means a bot can't finish the submit. In a real run we stop here; in a practice run we
  // still fill the form (so you can see what would work) and say a CAPTCHA is present.
  const hasCaptcha = (await page.locator("iframe[src*=recaptcha], iframe[src*=hcaptcha], .g-recaptcha, .h-captcha, [data-sitekey]").count()) > 0;
  if (hasCaptcha && packet.mode === "submit") {
    await report("needs_you", "This form has a CAPTCHA, so a bot can't finish it. Apply by hand — your materials are in the Apply assistant.");
    process.exit(0);
  }
  const gh = (await bestFrame()).frame;
  const root = gh === page.mainFrame() ? page : gh;

  const filled = [], missing = [];

  // ----- the user's saved answers to common application questions -----
  const A = packet.answers || {};
  const isDecline = v => /^decline/i.test(v || "");
  // forms word the voluntary self-ID options differently; match each saved choice by meaning
  const MEANING = {
    "male": /^(male|man)\b/i,
    "female": /^(female|woman)\b/i,
    "non-binary": /non.?binary|nonconforming|non-conforming|genderqueer/i,
    "hispanic or latino": /hispanic|latin/i,
    "white": /^white|caucasian/i,
    "black or african american": /black|african/i,
    "asian": /^asian/i,
    "native hawaiian or pacific islander": /hawaiian|pacific/i,
    "american indian or alaska native": /american indian|alaska/i,
    "two or more races": /two or more|multi.?racial|more than one/i,
    "not a protected veteran": /not a (protected )?veteran|i am not a protected|not.*protected veteran|^no\b/i,
    "protected veteran": /^(?!.*\bnot\b).*(protected )?veteran|identify as one or more of the classifications/i,
    "no, i don't have a disability": /no,? (i )?(do not|don.t) have|^no\b|do not have a disability|not have a disability/i,
    "yes, i have a disability": /^(?!.*\b(no|not)\b).*(yes|have a disability)/i
  };
  const meaningOf = v => MEANING[(v || "").toLowerCase()] || null;
  function pickAnswer(t) {
    if (/agree|acknowledge|confirm that you have read|privacy|plagiarism|consent|i understand|certify/.test(t)) return null; // never tick agreements
    if (/sponsor/.test(t)) return A.sponsor;
    if (/authori[sz]ed to work|work authori[sz]ation|right to work|eligible to work|legally (able|eligible)/.test(t)) return A.workAuth;
    if (/relocat/.test(t)) return A.relocate;
    if (/how did you hear|where did you (hear|find|see)|referral source/.test(t)) return A.heard;
    if (/salary|compensation expectation|pay expectation|desired pay/.test(t)) return A.salary;
    if (/notice period|start date|available to start|earliest (start|date)/.test(t)) return A.notice;
    if (/18 years|at least 18|over 18|legal age/.test(t)) return A.over18;
    if (/\bcountry\b/.test(t) && !/code|phone/.test(t)) return A.country;
    if (/gender/.test(t) && !/orientation/.test(t)) return A.gender;
    if (/\brace\b|ethnic/.test(t)) return A.race;
    if (/veteran/.test(t)) return A.veteran;
    if (/disabilit/.test(t)) return A.disability;
    return null;
  }
  async function setAnswer(el, info, ans) {
    try {
      if (info.tag === "select") {
        const opts = await el.evaluate(n => [...n.options].map(o => o.text.trim()));
        const want = ans.toLowerCase();
        const mre = meaningOf(ans);
        const pick = isDecline(ans)
          ? opts.find(o => /decline|prefer not|do not wish|don.t wish|choose not/i.test(o))
          : (opts.find(o => o.toLowerCase() === want) || (mre && opts.find(o => mre.test(o))) || opts.find(o => o.toLowerCase().startsWith(want)) || opts.find(o => o.toLowerCase().includes(want)));
        if (!pick) return false;
        await el.selectOption({ label: pick });
        return true;
      }
      if (info.combo) {
        await el.click();
        await page.waitForTimeout(500);
        // read the dropdown's real options and click the one that fits the saved answer
        const shellH = await el.evaluateHandle(n => n.closest(".select-shell") || (n.closest(".select__control") && n.closest(".select__control").parentElement && n.closest(".select__control").parentElement.parentElement) || n.parentElement.parentElement.parentElement);
        const optHandles = (await shellH.asElement().$$('[role="option"]').catch(() => [])).slice(0, 400);
        const n = optHandles.length;
        if (n > 0) {
          const texts = [];
          for (const oh of optHandles) texts.push(((await oh.innerText().catch(() => "")) || "").trim());
          const want = ans.toLowerCase();
          const declineRe = /decline|prefer not|do not wish|don.t wish|choose not|not to (answer|disclose|say)|rather not/i;
          let idx = isDecline(ans)
            ? texts.findIndex(o => declineRe.test(o))
            : texts.findIndex(o => o.toLowerCase() === want);
          const mre2 = meaningOf(ans);
          if (idx < 0 && mre2) idx = texts.findIndex(o => mre2.test(o));
          if (idx < 0 && !isDecline(ans)) idx = texts.findIndex(o => o.toLowerCase().startsWith(want));
          if (idx < 0 && !isDecline(ans)) idx = texts.findIndex(o => o.toLowerCase().includes(want));
          if (idx >= 0) {
            await optHandles[idx].click();
            await page.waitForTimeout(300);
            return true;
          }
          await page.keyboard.press("Escape").catch(() => {});
          return false;
        }
        await page.keyboard.type(isDecline(ans) ? "Decline" : ans.slice(0, 40), { delay: 40 });
        await page.waitForTimeout(500);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
        const shown = (await el.evaluate(n => ((n.closest(".select__control") || n.closest('[class*="select-shell"]') || n.parentElement.parentElement || n).innerText || "")).catch(() => "")).toLowerCase();
        const key = isDecline(ans) ? "decline" : ans.toLowerCase().split(/\s+/)[0];
        if (shown.includes(key) || (isDecline(ans) && /prefer not|do not wish|don.t wish/.test(shown))) return true;
        await page.keyboard.press("Escape").catch(() => {});
        return false;
      }
      await el.fill(ans);
      return true;
    } catch (e) { return false; }
  }

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
        value: n.value, checked: n.checked,
        combo: n.getAttribute("role") === "combobox" || !!n.getAttribute("aria-autocomplete") || /select__input|react-select/.test(n.className || "")
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
    // answers the user saved in their profile (never guessed, never agreement boxes)
    if (!info.value && info.type !== "checkbox" && info.type !== "radio" && info.type !== "file") {
      const ans = pickAnswer(t);
      if (ans && (await setAnswer(el, info, ans))) { filled.push(label); continue; }
    }
    // anything required that we don't know how to answer: stop, don't guess
    // (unlabeled required inputs are the hidden twins of dropdowns — not real questions)
    if (t && info.required && !info.value && !info.checked && info.type !== "file") missing.push(t.slice(0, 160));
  }

  await page.screenshot({ path: "bot/out/form.png", fullPage: true });
  if (missing.length) {
    await report("needs_you", "The form asks questions I won't guess at. Finish those by hand.", filled, missing);
    process.exit(0);
  }
  if (!filled.length || !(await onForm())) {
    await page.screenshot({ path: "bot/out/error.png", fullPage: true }).catch(() => {});
    await report("needs_you", "I couldn't find a real application form on that page (it may be a job description page or need a sign-in). Nothing was submitted. Apply by hand — your materials are ready in the Apply window.", filled, missing);
    process.exit(0);
  }
  if (packet.mode !== "submit") {
    await report("dry_run_ok", hasCaptcha
      ? "Practice run done — the form filled, but it has a CAPTCHA, so a real submit would need you to finish it by hand. Nothing was submitted."
      : "Practice run done — the form filled cleanly and nothing was submitted.", filled, missing);
    process.exit(0);
  }

  // Find the real Submit button: a visible submit-type button first, then buttons literally named Submit / Send application,
  // and only then a generic "Apply" (which is often a header or sticky button, not the form's own submit).
  async function findSubmit() {
    const tries = [
      root.locator('button[type="submit"], input[type="submit"]'),
      root.getByRole("button", { name: /^\s*(submit|send)( my)?( the)?( application)?\s*$/i }),
      root.getByRole("button", { name: /submit application|send application|complete application|finish application/i }),
      root.getByRole("button", { name: /^\s*apply( now)?\s*$/i })
    ];
    for (const loc of tries) {
      const n = await loc.count().catch(() => 0);
      for (let i = n - 1; i >= 0; i--) {
        const el = loc.nth(i);
        if (await el.isVisible().catch(() => false)) return el;
      }
    }
    return null;
  }
  // Visible form errors, to tell the user what is blocking the submit.
  async function pageErrors() {
    const sel = '[role="alert"], [aria-invalid="true"], [class*="error" i], [class*="invalid" i]';
    const texts = [];
    for (const fr of [page, gh]) {
      if (!fr) continue;
      const els = await fr.locator(sel).elementHandles().catch(() => []);
      for (const h of els.slice(0, 12)) {
        const t = (await h.evaluate(n => (n.getAttribute("aria-label") || n.innerText || "").trim()).catch(() => "")).replace(/\s+/g, " ").slice(0, 90);
        if (t && t.length > 3 && !texts.includes(t)) texts.push(t);
      }
    }
    return texts.slice(0, 5);
  }
  const submit = await findSubmit();
  if (!submit) {
    await page.screenshot({ path: "bot/out/error.png", fullPage: true }).catch(() => {});
    await report("needs_you", "I filled the form but couldn't find its Submit button. Nothing was submitted. Open the posting and finish it by hand.", filled, missing);
    process.exit(0);
  }
  await submit.scrollIntoViewIfNeeded().catch(() => {});
  // wait (up to ~8s) for the button to become clickable: it stays greyed out until the form is valid
  let ready = false;
  for (let i = 0; i < 16 && !ready; i++) {
    ready = await submit.isEnabled().catch(() => false);
    if (!ready) await page.waitForTimeout(500);
  }
  if (!ready) {
    await page.screenshot({ path: "bot/out/error.png", fullPage: true }).catch(() => {});
    const errs = await pageErrors();
    await report("needs_you", "The Submit button is still greyed out, so the form isn't ready (a required field, checkbox or verification is probably missing)." + (errs.length ? " The form says: " + errs.join(" | ") : "") + " Nothing was submitted. Finish it by hand.", filled, missing);
    process.exit(0);
  }
  try {
    await submit.click({ timeout: 10000 });
  } catch (e) {
    await page.screenshot({ path: "bot/out/error.png", fullPage: true }).catch(() => {});
    const errs = await pageErrors();
    await report("needs_you", "I couldn't press Submit: something on the page is covering it or the form isn't ready." + (errs.length ? " The form says: " + errs.join(" | ") : "") + " Nothing was submitted. Finish it by hand.", filled, missing);
    process.exit(0);
  }
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
