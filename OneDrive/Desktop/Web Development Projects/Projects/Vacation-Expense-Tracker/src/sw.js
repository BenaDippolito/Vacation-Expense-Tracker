const CACHE = "vet-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/src/styles.css",
  "/src/app.js",
  "/src/idb.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Try cache first for app shell, otherwise network
  if (ASSETS.includes(url.pathname) || url.pathname === "/") {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    return;
  }
  // For API calls, try network then fallback to cache
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // default: network fallback to cache
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
