// Service worker de Cosland: hace la web instalable y deja una página útil sin conexión.
// La API y el chat en vivo nunca pasan por caché.
const CACHE = "cosland-v1";
const SHELL = ["/offline.html", "/gato-ink.png", "/icon-192.png"];
const MAX_ENTRIES = 120;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  // Páginas: siempre la versión nueva; sin conexión, la página de aviso
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Archivos con nombre único (JS, CSS, fuentes, fotos subidas): primero la caché
  const immutable = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/logo/");
  if (immutable) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) { cache.put(req, res.clone()); trim(cache); }
        return res;
      }),
    );
  }
});
