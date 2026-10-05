// Helper: tells an AI prompt which language to write in (the language the person picked in the app).
export function langLine(code, json) {
  code = String(code || "en").toLowerCase().slice(0, 6);
  if (!code || code === "en") return "";
  let name = code;
  try { name = new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code; } catch (e) {}
  return json
    ? " IMPORTANT: write all the human-readable text values in " + name + ", but keep the JSON keys and the required structure exactly as specified in English."
    : " IMPORTANT: write your entire reply in " + name + ".";
}
