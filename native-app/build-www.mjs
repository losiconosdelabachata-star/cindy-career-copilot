// Copies the website (the same files served at cindy-career-copilot.pages.dev) into ./www so the
// iPhone app ships with its own copy of the app — it opens instantly and the screens don't depend on a web load.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("..");
const out = path.resolve("www");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const files = ["index.html", "manifest.webmanifest", "privacy.html", "terms.html", "delete-account.html"];
for (const f of files) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });

// inside the native app there is no service worker to register
const idx = path.join(out, "index.html");
fs.writeFileSync(idx, fs.readFileSync(idx, "utf8"));
console.log("www ready:", fs.readdirSync(out).join(", "));
