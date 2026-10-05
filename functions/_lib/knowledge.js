// Offline knowledge retrieval for The Cindy Bot: BM25 over the built-in knowledge cards. No internet needed.
import { APP_CARDS } from "./kb_app.js";
import { CAREER_CARDS } from "./kb_career.js";
import { MONEY_CARDS } from "./kb_money.js";
import { CREATOR_CARDS } from "./kb_creator.js";

const STOP = new Set(("a an the and or but if of to in on at for with from by is are was were be been am do does did can could should would will " +
  "i me my we our you your it its this that these those what how why when where which who whom about as into than then so not no yes " +
  "please tell explain want need have has had get got just also more any some there here they them").split(" "));

function stem(w) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
function tokens(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter(function(w) { return w && !STOP.has(w); }).map(stem);
}

const ALL = [].concat(APP_CARDS, CAREER_CARDS, MONEY_CARDS, CREATOR_CARDS);
let INDEX = null;

function build() {
  const docs = ALL.map(function(c) {
    const tf = new Map();
    // title and keywords count extra
    const parts = [[c[1], 3], [c[2], 3], [c[3], 1]];
    let len = 0;
    parts.forEach(function(p) {
      tokens(p[0]).forEach(function(t) { tf.set(t, (tf.get(t) || 0) + p[1]); len += p[1]; });
    });
    return { card: c, tf: tf, len: len };
  });
  const df = new Map();
  docs.forEach(function(d) { d.tf.forEach(function(_, t) { df.set(t, (df.get(t) || 0) + 1); }); });
  const avg = docs.reduce(function(a, d) { return a + d.len; }, 0) / docs.length;
  return { docs: docs, df: df, avg: avg, n: docs.length };
}

// Returns the best-matching cards (always including the app overview) within a character budget.
export function retrieve(query, maxChars) {
  if (!INDEX) INDEX = build();
  const budget = maxChars || 4500;
  const q = tokens(query);
  const k1 = 1.4, b = 0.75;
  const scored = [];
  INDEX.docs.forEach(function(d) {
    let s = 0;
    q.forEach(function(t) {
      const f = d.tf.get(t);
      if (!f) return;
      const df = INDEX.df.get(t) || 0;
      const idf = Math.log(1 + (INDEX.n - df + 0.5) / (df + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / INDEX.avg));
    });
    if (s > 0) scored.push({ s: s, c: d.card });
  });
  scored.sort(function(a, b2) { return b2.s - a.s; });
  const out = [];
  let used = 0;
  const overview = ALL.find(function(c) { return c[0] === "overview"; });
  if (overview) { out.push(overview); used += overview[3].length; }
  for (let i = 0; i < scored.length && out.length < 7; i++) {
    const c = scored[i].c;
    if (out.indexOf(c) >= 0) continue;
    if (used + c[3].length > budget && out.length > 1) continue;
    out.push(c); used += c[3].length;
  }
  return out;
}

export function knowledgeBlock(query) {
  const cards = retrieve(query);
  return cards.map(function(c) { return "## " + c[1] + "\n" + c[3]; }).join("\n\n");
}
