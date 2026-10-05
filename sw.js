// Service worker: lets the app open instantly and show its shell offline (needed for the Android app).
// It never caches /api/ calls or other sites — those always go to the network.
const CACHE = "cindy-shell-v5";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "privacy.html",
  "terms.html",
  "delete-account.html",
  "assets/favicon-32.png",
  "assets/favicon-192.png",
  "assets/favicon-512.png",
  "assets/apple-touch-icon.png",
  "assets/logo-badge.png",
  "assets/logo-full.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // other sites: network only
  if (url.pathname.indexOf("/api/") !== -1) return;           // API calls: network only

  // pages: network first (always fresh), fall back to the cached copy when offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match("index.html"); });
      })
    );
    return;
  }

  // images, icons, manifest: cache first, refresh in the background
  e.respondWith(
    caches.match(req).then(function (hit) {
      const net = fetch(req).then(function (res) {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
