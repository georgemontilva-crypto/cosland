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

// ── Avisos ──
// Llega un aviso con Cosland cerrada o en segundo plano: se muestra y se actualiza el número del icono
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* aviso sin datos legibles */ }
  e.waitUntil((async () => {
    try {
      if (typeof d.badge === "number" && self.navigator.setAppBadge) await (d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge());
    } catch { /* este sistema no pone número en el icono */ }
    await self.registration.showNotification(d.title || "Cosland", {
      body: d.body || "", icon: "/icon-192.png", badge: "/badge-96.png", lang: "es",
      tag: d.tag || undefined, renotify: Boolean(d.tag), data: { url: d.url || "/" },
    });
  })());
});

// Al tocarlo: lleva a la pantalla del aviso, en la ventana de Cosland que ya esté abierta o en una nueva
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = wins.find((c) => new URL(c.url).origin === self.location.origin);
    if (open) {
      try { await open.focus(); } catch { /* el sistema no dejó traerla al frente */ }
      open.postMessage({ go: url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
