// Bump this version when shipping changes to the offline library.
const CACHE_PREFIX = "ultimate-games-dashboard::";
const CACHE_NAME = CACHE_PREFIX + "v8";
const root = self.registration.scope;
const absolute = path => new URL(path, root).href;
const indexUrl = absolute("index.html");
const catalogUrl = absolute("catalog.json");
const shell = [
  "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "assets/bricolage-latin.woff2", "assets/arcade-night.png",
  "assets/arrow-cube-cover.png", "assets/bus-jam-cover.png", "assets/glow-words-cover.png",
  "assets/tic-tac-toe-cover.png", "assets/boxes-cover.png",
  "icons/ultimate-games-180.png", "icons/ultimate-games-192.png", "icons/ultimate-games-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const response = await fetch(catalogUrl, { cache: "reload" });
    if (!response.ok) throw new Error("Could not cache the catalog");
    const games = await response.clone().json();
    const files = [...shell, ...games.map(game => game.icon)];
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(files.map(file => new Request(absolute(file), { cache: "reload" })));
    await cache.put(catalogUrl, response);
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "APPLY_DASHBOARD_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(root)) return;
  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  const isHome = request.mode === "navigate" && (path === root || path === indexUrl);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(isHome ? indexUrl : request) || fetch(request);
  })());
});
