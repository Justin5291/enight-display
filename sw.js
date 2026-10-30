/* App-shell cache. Network first, so a show-day fix still arrives, then fall back offline. */
const CACHE = "enight-shell-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./assets/kalshi-logo.webp",
  "./assets/show-logo.png",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-512.png",
  "./js/app.js",
  "./js/data.js",
  "./js/util.js",
  "./js/state.js",
  "./js/markup.js",
  "./js/kalshi.js",
  "./js/nyt.js",
  "./js/pages.js",
  "./js/dock.js",
  "./js/media-db.js",
  "./js/screens.js",
  "./js/screen-control.js",
  "./js/screen-seats.js",
  "./js/screen-races.js",
  "./js/screen-show.js",
  "./js/screen-kalshi.js",
  "./js/screen-sites.js",
  "./js/screen-media.js",
  "./js/screen-home.js",
  "./js/operator.js",
  "./js/settings.js",
  "./js/screen-maps.js",
  "./js/us-states.js",
  "./js/zoom-view.js",
  "./js/pdf-view.js",
  "./js/kalshi-races.js",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(ASSETS.map(async (url) => {
        try {
          const res = await fetch(url, { cache: "reload" });
          if (res.ok) await cache.put(url, res);
        } catch (e) { /* one missing file should not sink the shell */ }
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") {
        const home = await caches.match("./index.html");
        if (home) return home;
      }
      return new Response("", { status: 504, statusText: "Offline" });
    })
  );
});
