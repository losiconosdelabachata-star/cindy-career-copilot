// Cloudflare Pages Function — POST /api/qualify
// {state, adults:1|2, kidAges:[…], income} → estimated annual value of benefits a household
// may qualify for, computed by PolicyEngine's open-source US tax-benefit model
// (https://github.com/PolicyEngine/policyengine-us, hosted API at api.policyengine.org).
// These are estimates from federal/state rules — the real agency decides eligibility.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, CORS) });
}
export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

const ABBR = { "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY" };

const YEAR = "2025";
const y = function (v) { const o = {}; o[YEAR] = v; return o; };

export async function onRequestPost({ request }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "invalid_json" }, 400); }
  const st = ABBR[String(b.state || "")];
  if (!st) return json({ error: "bad_state", message: "Choose your state." }, 400);
  const adults = b.adults === 2 ? 2 : 1;
  const kids = (Array.isArray(b.kidAges) ? b.kidAges : []).slice(0, 8).map(function (a) { return Math.max(0, Math.min(17, parseInt(a, 10) || 0)); });
  const income = Math.max(0, Math.min(1000000, Number(b.income) || 0));

  const people = {};
  const ids = [];
  for (let i = 0; i < adults; i++) {
    const id = "adult" + i; ids.push(id);
    people[id] = { age: y(35), employment_income: y(i === 0 ? income : 0), medicaid: y(null), wic: y(null) };
  }
  kids.forEach(function (age, i) {
    const id = "kid" + i; ids.push(id);
    people[id] = { age: y(age), medicaid: y(null), is_chip_eligible: y(null) };
  });
  const adultIds = ids.filter(function (x) { return x.indexOf("adult") === 0; });
  const household = {
    people: people,
    families: { f: { members: ids } },
    spm_units: { s: { members: ids, snap: y(null), tanf: y(null), spm_unit_energy_subsidy: y(null) } },
    tax_units: { t: { members: ids, eitc: y(null), refundable_ctc: y(null) } },
    households: { h: { members: ids, state_name: y(st) } },
    marital_units: adults === 2 ? { m: { members: adultIds } } : { m: { members: adultIds } }
  };
  kids.forEach(function (_, i) { household.marital_units["mk" + i] = { members: ["kid" + i] }; });

  let r;
  try {
    const res = await fetch("https://api.policyengine.org/us/calculate", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ household: household })
    });
    r = await res.json();
    if (!res.ok || r.status !== "ok") return json({ error: "upstream", message: "The benefits calculator couldn't run that. Try again." }, 502);
  } catch (e) {
    return json({ error: "upstream", message: "The benefits calculator is busy. Try again in a minute." }, 502);
  }
  const R = r.result, P = R.people;
  const sum = function (fn) { return Object.keys(P).reduce(function (t, k) { return t + (fn(k, P[k]) || 0); }, 0); };
  const adultMedicaid = sum(function (k, p) { return k.indexOf("adult") === 0 ? p.medicaid[YEAR] : 0; });
  const kidMedicaid = sum(function (k, p) { return k.indexOf("kid") === 0 ? p.medicaid[YEAR] : 0; });
  const chip = Object.keys(P).some(function (k) { return k.indexOf("kid") === 0 && P[k].is_chip_eligible[YEAR]; });
  const wic = sum(function (k, p) { return p.wic ? p.wic[YEAR] : 0; });
  const spm = R.spm_units.s, tax = R.tax_units.t;

  const items = [
    { key: "snap", label: "SNAP (food assistance)", yearly: spm.snap[YEAR], where: "Apply through your state's SNAP office — find it at benefits.gov or your state's .gov benefits site." },
    { key: "tanf", label: "TANF (cash assistance)", yearly: spm.tanf[YEAR], where: "Apply through your state's social services agency." },
    { key: "medicaid_adult", label: "Medicaid (adults)", yearly: adultMedicaid, where: "Apply at healthcare.gov or your state's Medicaid site." },
    { key: "medicaid_kids", label: "Medicaid / CHIP (children)", yearly: kidMedicaid, chip: chip, where: "Apply at healthcare.gov or your state's Medicaid/CHIP site." },
    { key: "wic", label: "WIC (food for pregnancy and young kids)", yearly: wic, where: "Contact your local WIC clinic — find it through your state's health department." },
    { key: "eitc", label: "Earned Income Tax Credit", yearly: tax.eitc[YEAR], where: "Claimed when you file taxes. Free filing help: IRS VITA sites (irs.gov/vita)." },
    { key: "ctc", label: "Child Tax Credit (refundable part)", yearly: tax.refundable_ctc[YEAR], where: "Claimed when you file taxes. Free filing help: IRS VITA sites (irs.gov/vita)." },
    { key: "energy", label: "Energy bill help (LIHEAP-type subsidy)", yearly: spm.spm_unit_energy_subsidy[YEAR], where: "Apply through your state or county energy assistance office." }
  ];
  return json({
    year: YEAR,
    items: items.map(function (i) { return { key: i.key, label: i.label, yearly: Math.round(i.yearly || 0), chip: !!i.chip, where: i.where }; })
      .filter(function (i) { return i.yearly > 0 || i.chip; })
  });
}
