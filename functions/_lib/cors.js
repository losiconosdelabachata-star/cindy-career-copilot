// Shared CORS + JSON response helpers for account/data Functions.
// Filename is underscore-prefixed so Cloudflare Pages doesn't treat it as
// its own route — it's a plain module other functions import from.

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization"
};

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "content-type": "application/json" }, CORS)
  });
}
