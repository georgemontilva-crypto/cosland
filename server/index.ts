import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext, userFromRequest } from "./trpc";
import { db, runMigrations } from "./db";
import { listings, messages, settings, shops, users } from "./schema";
import { saveImage, UPLOAD_DIR, storageMode, imageOrigin, backfillThumbs } from "./storage";
import { subscribe, canSubscribe, liveStats, setVisible } from "./realtime";
import { formatPrice } from "../shared/catalog";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cookieParser());

// Orígenes extra con permiso para llamar a la API desde el navegador (la app nativa no lo necesita)
const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
if (corsOrigins.length) {
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");
    if (origin && corsOrigins.includes(origin)) {
      res.set({
        "Access-Control-Allow-Origin": origin, Vary: "Origin",
        "Access-Control-Allow-Headers": "authorization, content-type, x-cosland-client, trpc-accept, accept, cache-control, x-requested-with, last-event-id",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      });
      if (req.method === "OPTIONS") return res.status(204).end();
    }
    next();
  });
}

app.get("/api/health", (_req, res) => res.json({ ok: true, live: liveStats().connections }));

// Vínculo entre la web y la app Android (Digital Asset Links). Con las huellas correctas
// en ANDROID_SHA256, la app abre a pantalla completa, sin barra de direcciones.
app.get("/.well-known/assetlinks.json", (_req, res) => {
  const fingerprints = (process.env.ANDROID_SHA256 ?? "").split(",").map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  res.set("Cache-Control", "public, max-age=300").json(fingerprints.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: process.env.ANDROID_PACKAGE?.trim() || "com.cosland.app", sha256_cert_fingerprints: fingerprints },
  }] : []);
});

// Freno a intentos repetidos de entrar o registrarse
const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
app.use(["/api/trpc/auth.login", "/api/trpc/auth.register"], authLimiter);

// Subida de fotos (solo con sesión iniciada)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const uploadLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
app.post("/api/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Entra a tu cuenta para subir fotos." });
  if (!req.file || !req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Sube una imagen (JPG, PNG o WebP)." });
  try {
    res.json({ url: await saveImage(req.file.buffer) });
  } catch (e) {
    console.error("upload", e);
    res.status(400).json({ error: "No pudimos leer esa imagen. Prueba con otra." });
  }
});
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "365d", immutable: true }));

// Canal en vivo: la conexión queda abierta y el servidor empuja avisos cortos.
// Con cuenta llegan además los personales (chat, seguidores); sin cuenta, solo las novedades públicas.
app.get("/api/events", async (req, res) => {
  const user = await userFromRequest(req);
  const ip = req.ip ?? "";
  if (!canSubscribe(user?.id ?? null, ip)) return res.status(503).set("Retry-After", "60").end();
  res.writeHead(200, {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no",
  });
  // El reintento va con azar para que, tras un reinicio, no vuelvan todos a la vez
  res.write(`retry: ${3000 + Math.floor(Math.random() * 5000)}\n\n`);
  const cid = typeof req.query.c === "string" && /^[\w-]{8,40}$/.test(req.query.c) ? req.query.c : null;
  const off = subscribe(user?.id ?? null, ip, res, cid);
  req.on("close", off);
});

// La pestaña avisa si pasó a segundo plano o volvió (decide si un aviso va como notificación o dentro de la app)
app.post("/api/presence", express.text({ type: "*/*", limit: "1kb" }), (req, res) => {
  const [cid, v] = String(req.body ?? "").split(":");
  if (cid && /^[\w-]{8,40}$/.test(cid)) setVisible(cid, v === "1");
  res.status(204).end();
});

app.use("/api/trpc", express.json({ limit: "200kb" }), createExpressMiddleware({ router: appRouter, createContext }));

/* ── Cliente (producción): archivos estáticos + vista previa al compartir enlaces ── */
const publicDir = path.resolve("dist/public");
if (fs.existsSync(path.join(publicDir, "index.html"))) {
  const template = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const page = (req: express.Request, meta: { title: string; description: string; image?: string | null }) => {
    const origin = process.env.PUBLIC_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
    const image = meta.image ? (meta.image.startsWith("http") ? meta.image : origin + meta.image) : `${origin}/og.jpg`;
    const tags = [
      `<title>${esc(meta.title)}</title>`,
      `<meta name="description" content="${esc(meta.description)}">`,
      `<meta property="og:title" content="${esc(meta.title)}">`,
      `<meta property="og:description" content="${esc(meta.description)}">`,
      `<meta property="og:image" content="${esc(image)}">`,
      `<meta property="og:type" content="website">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      // Las fotos viven en otro servidor: se abre la conexión de una vez para que la primera no espere
      ...(imageOrigin ? [`<link rel="preconnect" href="${esc(imageOrigin)}">`] : []),
    ].join("\n    ");
    return template.replace(/<!--meta-->[\s\S]*<!--\/meta-->/, tags);
  };
  const base = { title: "Cosland: compra y vende cosplay, figuras y más", description: "El mercado de la comunidad cosplayer, otaku y geek. Abre tu vitrina y vende lo que ya no usas." };

  app.get("/sw.js", (_req, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(publicDir, "sw.js")));
  app.use(express.static(publicDir, { index: false, maxAge: "1h" }));

  app.get("/p/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const [l] = Number.isInteger(id)
        ? await db.select({ title: listings.title, description: listings.description, images: listings.images, price: listings.priceCents, deal: listings.deal, status: listings.status })
            .from(listings).where(eq(listings.id, id)).limit(1)
        : [];
      if (!l || l.status === "removed") return res.send(page(req, base));
      res.send(page(req, {
        title: `${l.title} (${formatPrice(l.price, l.deal)}) | Cosland`,
        description: l.description.slice(0, 160), image: l.images[0],
      }));
    } catch (e) { next(e); }
  });

  app.get("/v/:handle", async (req, res, next) => {
    try {
      const [s] = await db.select({ name: shops.name, bio: shops.bio, avatar: shops.avatarUrl, banner: shops.bannerUrl })
        .from(shops).where(eq(shops.handle, String(req.params.handle).toLowerCase())).limit(1);
      if (!s) return res.send(page(req, base));
      res.send(page(req, { title: `${s.name} | Vitrina en Cosland`, description: (s.bio ?? base.description).slice(0, 160), image: s.banner ?? s.avatar }));
    } catch (e) { next(e); }
  });

  app.get("*", (req, res) => res.send(page(req, base)));
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Algo falló de nuestro lado. Intenta de nuevo." });
});

// Una sola vez: crea la miniatura de las fotos subidas antes de que existieran. Corre de fondo, sin frenar el arranque.
async function thumbsForOldPhotos() {
  try {
    const [done] = await db.select().from(settings).where(eq(settings.key, "thumbs_v1")).limit(1);
    if (done) return;
    const urls: (string | null)[] = [
      ...(await db.select({ images: listings.images }).from(listings)).flatMap((l) => l.images ?? []),
      ...(await db.select({ a: shops.avatarUrl, b: shops.bannerUrl }).from(shops)).flatMap((s) => [s.a, s.b]),
      ...(await db.select({ u: messages.imageUrl }).from(messages)).map((m) => m.u),
    ];
    const r = await backfillThumbs(urls.filter((u): u is string => Boolean(u)));
    console.log(`[fotos] miniaturas: ${r.made} creadas de ${r.total} fotos, ${r.failed} con error`);
    // Si alguna falló, se vuelve a intentar en el próximo arranque
    if (!r.failed) await db.insert(settings).values({ key: "thumbs_v1", value: new Date().toISOString() }).onDuplicateKeyUpdate({ set: { value: new Date().toISOString() } });
  } catch (e) { console.warn("[fotos] no se pudieron crear las miniaturas:", (e as Error).message); }
}

const port = Number(process.env.PORT ?? 3000);
(async () => {
  await runMigrations();
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (admin) await db.update(users).set({ role: "admin" }).where(eq(users.email, admin));
  app.listen(port, "0.0.0.0", () => console.log(`Cosland en el puerto ${port} (imágenes: ${storageMode})`));
  void thumbsForOldPhotos();
})().catch((e) => {
  console.error("No se pudo arrancar:", e);
  process.exit(1);
});
