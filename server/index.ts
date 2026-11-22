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
import { listings, shops, users } from "./schema";
import { saveImage, UPLOAD_DIR, storageMode } from "./storage";
import { subscribe } from "./realtime";
import { formatPrice } from "../shared/catalog";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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

// Canal en vivo para el chat: la conexión queda abierta y el servidor empuja los avisos
app.get("/api/events", async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).end();
  res.writeHead(200, {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  const off = subscribe(user.id, res);
  const beat = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => { clearInterval(beat); off(); });
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

const port = Number(process.env.PORT ?? 3000);
(async () => {
  await runMigrations();
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (admin) await db.update(users).set({ role: "admin" }).where(eq(users.email, admin));
  app.listen(port, "0.0.0.0", () => console.log(`Cosland en el puerto ${port} (imágenes: ${storageMode})`));
})().catch((e) => {
  console.error("No se pudo arrancar:", e);
  process.exit(1);
});
