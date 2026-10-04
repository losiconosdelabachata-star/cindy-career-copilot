// Copies ONLY the website files into ./site — that folder is what gets published to Cloudflare Pages.
// (The native app projects, store graphics, bot and docs stay out of the public website.)
import fs from "node:fs";
import path from "node:path";
const out = path.resolve("site");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ["index.html", "sw.js", "manifest.webmanifest", "privacy.html", "terms.html", "delete-account.html"]) {
  fs.copyFileSync(f, path.join(out, f));
}
fs.cpSync("assets", path.join(out, "assets"), { recursive: true });
console.log("site ready:", fs.readdirSync(out).join(", "));
