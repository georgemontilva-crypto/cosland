import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { and, or, eq, ne, like, desc, asc, sql, inArray, isNull, gte, lte, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "./db";
import { publish, touch, T } from "./realtime";
import { deleteImages } from "./storage";
import {
  users, shops, listings, favorites, follows, conversations, messages, reviews, wanted, reports, contributions, settings, orders,
} from "./schema";
import {
  router, publicProcedure, authedProcedure, adminProcedure, signSession, wantsToken, COOKIE,
} from "./trpc";
import {
  ACCENT_IDS, CATEGORY_IDS, CONDITION_IDS, DEAL_IDS, DELIVERY_IDS, SHOP_KIND_IDS, REPORT_REASONS, categoryOf, hasStock,
} from "../shared/catalog";

const fail = (code: TRPCError["code"], message: string) => new TRPCError({ code, message });

// Cuenta una vista por persona y publicación cada media hora (en memoria, con tope de tamaño)
const seen = new Map<string, number>();
const VIEW_WINDOW = 30 * 60 * 1000;
function firstView(who: string, listingId: number) {
  const key = `${who}:${listingId}`, now = Date.now(), last = seen.get(key);
  if (last && now - last < VIEW_WINDOW) return false;
  if (seen.size > 50_000) for (const [k, t] of seen) { if (now - t > VIEW_WINDOW || seen.size > 40_000) seen.delete(k); else break; }
  seen.delete(key); seen.set(key, now); // se reinserta para mantener el orden por antigüedad
  return true;
}
const imageUrl = z.string().max(500).refine((u) => u.startsWith("/uploads/") || u.startsWith("https://") || u.startsWith("/demo/"), "Imagen no válida");
const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const dollars = z.number().min(0).max(1_000_000).optional().nullable();
const toCents = (v?: number | null) => (v == null ? null : Math.round(v * 100));
const n = (col: SQL) => col.mapWith(Number);

async function shopOf(userId: number) {
  const [s] = await db.select().from(shops).where(eq(shops.userId, userId)).limit(1);
  return s ?? null;
}

const card = {
  id: listings.id, title: listings.title, priceCents: listings.priceCents, deal: listings.deal, kind: listings.kind,
  category: listings.category, condition: listings.condition, size: listings.size, series: listings.series,
  images: listings.images, status: listings.status, featured: listings.featured, acceptsTrade: listings.acceptsTrade,
  createdAt: listings.createdAt, views: listings.views, stock: listings.stock,
  shopId: shops.id, shopHandle: shops.handle, shopName: shops.name, shopCity: shops.city,
  shopVerified: shops.verified, shopAccent: shops.accent,
};

// "shops.id" va literal: dentro de la subconsulta, un "id" sin tabla apuntaría a la tabla interna
const shopStats = {
  listingCount: n(sql`(select count(*) from listings l where l.shop_id = shops.id and l.status = 'active')`),
  followers: n(sql`(select count(*) from follows f where f.shop_id = shops.id)`),
  rating: n(sql`(select coalesce(avg(r.rating), 0) from reviews r where r.shop_id = shops.id)`),
  reviewCount: n(sql`(select count(*) from reviews r where r.shop_id = shops.id)`),
  supporter: n(sql`(select count(*) from contributions c where c.shop_id = shops.id and c.status = 'confirmed')`),
};

/* ───────── Aportes: 1 dólar voluntario por venta ───────── */
export const SUPPORT_CENTS = 100;
async function getSettings() {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.support_enabled === "1",
    account: map.support_account ?? "",
    goalCents: Number(map.support_goal_cents ?? 0) || 0,
  };
}
async function setSetting(key: string, value: string) {
  await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

/* ───────── Cuenta ───────── */
const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const shop = await shopOf(ctx.user.id);
    const [a] = await db.select({ c: n(sql`coalesce(sum(${conversations.buyerUnread}), 0)`) })
      .from(conversations).where(eq(conversations.buyerId, ctx.user.id));
    let unread = a?.c ?? 0;
    if (shop) {
      const [b] = await db.select({ c: n(sql`coalesce(sum(${conversations.sellerUnread}), 0)`) })
        .from(conversations).where(eq(conversations.shopId, shop.id));
      unread += b?.c ?? 0;
    }
    // Pedidos que esperan algo de esta persona: por aceptar (si vende) o por confirmar recibido (si compró)
    const [toDo] = await db.select({ c: n(sql`count(*)`) }).from(orders).where(or(
      and(eq(orders.buyerId, ctx.user.id), eq(orders.status, "delivered")),
      shop ? and(eq(orders.shopId, shop.id), eq(orders.status, "pending")) : undefined,
    ));
    return {
      ...ctx.user, unread, orders: toDo?.c ?? 0,
      shop: shop ? {
        id: shop.id, handle: shop.handle, name: shop.name, accent: shop.accent, avatarUrl: shop.avatarUrl,
        followers: (await db.select({ c: n(sql`count(*)`) }).from(follows).where(eq(follows.shopId, shop.id)))[0]?.c ?? 0,
      } : null,
    };
  }),

  register: publicProcedure
    .input(z.object({
      name: z.string().trim().min(2, "Escribe tu nombre").max(80),
      email: z.string().trim().toLowerCase().email("Correo no válido").max(190),
      password: z.string().min(8, "La contraseña necesita al menos 8 caracteres").max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (exists) throw fail("CONFLICT", "Ya hay una cuenta con ese correo. Entra con tu contraseña.");
      const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase() === input.email;
      const [r] = await db.insert(users).values({
        name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 10),
        role: admin ? "admin" : "user",
      });
      const token = signSession(ctx.res, r.insertId);
      touch(T.admin);
      return { ok: true, token: wantsToken(ctx.req) ? token : null };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [u] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!u || !(await bcrypt.compare(input.password, u.passwordHash))) {
        throw fail("UNAUTHORIZED", "El correo o la contraseña no coinciden.");
      }
      if (u.banned) throw fail("FORBIDDEN", "Esta cuenta está suspendida.");
      const token = signSession(ctx.res, u.id);
      return { ok: true, token: wantsToken(ctx.req) ? token : null };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  }),

  // Datos públicos del sitio para las páginas legales
  site: publicProcedure.query(() => ({ contactEmail: process.env.CONTACT_EMAIL?.trim() || null })),

  // Eliminar la cuenta y todo lo asociado: vitrina, publicaciones, fotos, mensajes, reseñas y pedidos
  deleteAccount: authedProcedure.input(z.object({ password: z.string().min(1).max(100) })).mutation(async ({ ctx, input }) => {
    const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!u || !(await bcrypt.compare(input.password, u.passwordHash))) throw fail("UNAUTHORIZED", "La contraseña no coincide.");
    const shop = await shopOf(u.id);
    const photos: (string | null)[] = [];
    if (shop) {
      const mine = await db.select({ id: listings.id, images: listings.images }).from(listings).where(eq(listings.shopId, shop.id));
      mine.forEach((l) => photos.push(...l.images));
      photos.push(shop.avatarUrl, shop.bannerUrl);
      const ids = mine.map((l) => l.id);
      if (ids.length) {
        await db.delete(favorites).where(inArray(favorites.listingId, ids));
        await db.delete(reports).where(inArray(reports.listingId, ids));
        await db.delete(listings).where(eq(listings.shopId, shop.id));
      }
      await db.delete(reviews).where(eq(reviews.shopId, shop.id));
      await db.delete(follows).where(eq(follows.shopId, shop.id));
      // Los aportes ya confirmados quedan solo como monto y fecha, sin comprobante ni referencia
      const proofs = await db.select({ url: contributions.proofUrl }).from(contributions).where(eq(contributions.shopId, shop.id));
      proofs.forEach((c) => photos.push(c.url));
      await db.delete(contributions).where(and(eq(contributions.shopId, shop.id), ne(contributions.status, "confirmed")));
      await db.update(contributions).set({ proofUrl: null, reference: null }).where(eq(contributions.shopId, shop.id));
    }
    const convs = await db.select({ id: conversations.id }).from(conversations)
      .where(or(eq(conversations.buyerId, u.id), shop ? eq(conversations.shopId, shop.id) : undefined));
    if (convs.length) {
      await db.delete(messages).where(inArray(messages.conversationId, convs.map((c) => c.id)));
      await db.delete(conversations).where(inArray(conversations.id, convs.map((c) => c.id)));
    }
    // Sus pedidos: lo que tenía apartado como comprador vuelve al vendedor
    const reserved = await db.select({ listingId: orders.listingId, quantity: orders.quantity }).from(orders)
      .where(and(eq(orders.buyerId, u.id), eq(orders.status, "accepted")));
    for (const o of reserved) await releaseStock(o.listingId, o.quantity);
    await db.delete(orders).where(or(eq(orders.buyerId, u.id), shop ? eq(orders.shopId, shop.id) : undefined));
    await db.delete(favorites).where(eq(favorites.userId, u.id));
    await db.delete(follows).where(eq(follows.userId, u.id));
    await db.delete(reviews).where(eq(reviews.authorId, u.id));
    await db.delete(wanted).where(eq(wanted.userId, u.id));
    await db.delete(reports).where(eq(reports.reporterId, u.id));
    if (shop) await db.delete(shops).where(eq(shops.id, shop.id));
    await db.delete(users).where(eq(users.id, u.id));
    await deleteImages(photos);
    ctx.res.clearCookie(COOKIE, { path: "/" });
    touch(T.feed, T.shops, T.wanted, T.admin, shop && T.shop(shop.id));
    return { ok: true };
  }),
});

/* ───────── Vitrinas ───────── */
const shopInput = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, "El enlace solo admite letras, números y guiones (mínimo 3)"),
  name: z.string().trim().min(2, "Ponle un nombre a tu vitrina").max(80),
  kind: z.enum(SHOP_KIND_IDS),
  bio: optText(1000),
  avatarUrl: imageUrl.optional().nullable(),
  bannerUrl: imageUrl.optional().nullable(),
  accent: z.enum(ACCENT_IDS),
  city: optText(80),
  country: optText(60),
  whatsapp: optText(30),
  instagram: optText(60),
  tiktok: optText(60),
  hasStore: z.boolean(),
  address: optText(255),
  hours: optText(255),
});

const shopRouter = router({
  mine: authedProcedure.query(({ ctx }) => shopOf(ctx.user.id)),

  save: authedProcedure.input(shopInput).mutation(async ({ ctx, input }) => {
    const mine = await shopOf(ctx.user.id);
    const [taken] = await db.select({ id: shops.id }).from(shops).where(eq(shops.handle, input.handle)).limit(1);
    if (taken && taken.id !== mine?.id) throw fail("CONFLICT", "Ese enlace ya lo usa otra vitrina. Prueba con otro.");
    const data = {
      ...input,
      whatsapp: input.whatsapp?.replace(/[^\d+]/g, "") || null,
      instagram: input.instagram?.replace(/^@/, "") || null,
      tiktok: input.tiktok?.replace(/^@/, "") || null,
    };
    let shopId = mine?.id;
    if (mine) await db.update(shops).set(data).where(eq(shops.id, mine.id));
    else shopId = (await db.insert(shops).values({ ...data, userId: ctx.user.id }))[0].insertId;
    // Nombre, foto y color de la vitrina salen también en sus publicaciones
    touch(T.shop(shopId!), T.shops, T.feed, !mine && T.admin);
    return { handle: input.handle };
  }),

  byHandle: publicProcedure.input(z.object({ handle: z.string().max(40) })).query(async ({ ctx, input }) => {
    const [s] = await db.select({ shop: shops, ...shopStats }).from(shops).where(eq(shops.handle, input.handle.toLowerCase())).limit(1);
    if (!s) throw fail("NOT_FOUND", "No encontramos esa vitrina.");
    let isFollowing = false;
    if (ctx.user) {
      const [f] = await db.select().from(follows).where(and(eq(follows.userId, ctx.user.id), eq(follows.shopId, s.shop.id))).limit(1);
      isFollowing = Boolean(f);
    }
    const { userId, ...shop } = s.shop;
    return { ...shop, listingCount: s.listingCount, followers: s.followers, rating: s.rating, reviewCount: s.reviewCount, supporter: s.supporter > 0, isFollowing, isMine: ctx.user?.id === userId };
  }),

  list: publicProcedure
    .input(z.object({ q: z.string().max(80).optional(), kind: z.enum(SHOP_KIND_IDS).optional(), store: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const where: SQL[] = [];
      if (input?.kind) where.push(eq(shops.kind, input.kind));
      if (input?.store) where.push(eq(shops.hasStore, true));
      if (input?.q?.trim()) {
        const q = `%${input.q.trim()}%`;
        where.push(or(like(shops.name, q), like(shops.city, q), like(shops.bio, q))!);
      }
      return db.select({
        id: shops.id, handle: shops.handle, name: shops.name, kind: shops.kind, bio: shops.bio, avatarUrl: shops.avatarUrl,
        accent: shops.accent, city: shops.city, country: shops.country, verified: shops.verified, hasStore: shops.hasStore,
        ...shopStats,
      }).from(shops).where(where.length ? and(...where) : undefined)
        .orderBy(desc(shops.verified), desc(shopStats.listingCount), desc(shops.id)).limit(60);
    }),

  toggleFollow: authedProcedure.input(z.object({ shopId: z.number().int() })).mutation(async ({ ctx, input }) => {
    const [shop] = await db.select({ id: shops.id, userId: shops.userId }).from(shops).where(eq(shops.id, input.shopId)).limit(1);
    if (!shop) throw fail("NOT_FOUND", "No encontramos esa vitrina.");
    if (shop.userId === ctx.user.id) throw fail("BAD_REQUEST", "Esta es tu propia vitrina.");
    const cond = and(eq(follows.userId, ctx.user.id), eq(follows.shopId, input.shopId));
    const [f] = await db.select().from(follows).where(cond).limit(1);
    if (f) await db.delete(follows).where(cond);
    else {
      await db.insert(follows).values({ userId: ctx.user.id, shopId: input.shopId });
      // Aviso en vivo al dueño de la vitrina, con el nombre público de quien lo sigue
      const mine = await shopOf(ctx.user.id);
      publish([shop.userId], "follow", { shopId: shop.id, name: mine?.name ?? ctx.user.name.split(" ")[0] });
    }
    touch(T.shop(shop.id)); // el contador cambia para quien esté mirando esa vitrina
    return { following: !f };
  }),

  // Quién sigue a una vitrina. Se muestra la vitrina del seguidor si tiene; si no, solo su primer nombre.
  followers: publicProcedure.input(z.object({ shopId: z.number().int() })).query(async ({ input }) => {
    const theirs = alias(shops, "follower_shop");
    const rows = await db.select({
      id: follows.userId, userName: users.name, at: follows.createdAt,
      handle: theirs.handle, shopName: theirs.name, avatarUrl: theirs.avatarUrl, accent: theirs.accent, verified: theirs.verified,
    }).from(follows)
      .innerJoin(users, eq(users.id, follows.userId))
      .leftJoin(theirs, eq(theirs.userId, follows.userId))
      .where(and(eq(follows.shopId, input.shopId), eq(users.banned, false)))
      .orderBy(desc(follows.createdAt)).limit(300);
    return rows.map((r) => ({
      id: r.id, name: r.shopName ?? r.userName.split(" ")[0], handle: r.handle, avatarUrl: r.avatarUrl,
      accent: r.accent, verified: Boolean(r.verified), at: r.at,
    }));
  }),

  // Las vitrinas que sigue la persona que tiene la sesión abierta
  following: authedProcedure.query(({ ctx }) =>
    db.select({
      id: shops.id, handle: shops.handle, name: shops.name, kind: shops.kind, bio: shops.bio, avatarUrl: shops.avatarUrl,
      accent: shops.accent, city: shops.city, country: shops.country, verified: shops.verified, hasStore: shops.hasStore,
      ...shopStats,
    }).from(follows).innerJoin(shops, eq(shops.id, follows.shopId))
      .where(eq(follows.userId, ctx.user.id)).orderBy(desc(follows.createdAt)).limit(200)),
});

/* ───────── Publicaciones ───────── */
const listingInput = z.object({
  id: z.number().int().optional(),
  category: z.enum(CATEGORY_IDS),
  deal: z.enum(DEAL_IDS),
  title: z.string().trim().min(4, "El título necesita al menos 4 letras").max(120),
  description: z.string().trim().min(10, "Cuenta un poco más en la descripción").max(5000),
  price: dollars,
  acceptsTrade: z.boolean(),
  condition: z.enum(CONDITION_IDS).optional().nullable(),
  size: optText(30),
  measurements: optText(255),
  series: optText(100),
  characterName: optText(100),
  delivery: z.enum(DELIVERY_IDS),
  images: z.array(imageUrl).max(8, "Máximo 8 fotos"),
  // Unidades disponibles (solo artículos en venta). Si no viene, no se toca.
  stock: z.number().int().min(1, "La cantidad mínima es 1").max(9999).optional(),
  // true: se suma 1 dólar al precio para aportarlo a Cosland. Si no viene, no se toca (la app nativa aún no lo usa).
  supportsApp: z.boolean().optional(),
});

const PAGE = 24;

const listingRouter = router({
  search: publicProcedure
    .input(z.object({
      q: z.string().max(80).optional(),
      category: z.string().max(40).optional(),
      kind: z.enum(["product", "service"]).optional(),
      deal: z.enum(DEAL_IDS).optional(),
      condition: z.enum(CONDITION_IDS).optional(),
      size: z.string().max(30).optional(),
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      city: z.string().max(80).optional(),
      trade: z.boolean().optional(),
      shopId: z.number().int().optional(),
      sort: z.enum(["recientes", "precio_asc", "precio_desc"]).optional(),
      page: z.number().int().min(1).max(500).optional(),
      cursor: z.number().int().min(1).max(500).nullish(), // la app pide las páginas de corrido con este campo
    }))
    .query(async ({ input }) => {
      const where: SQL[] = [eq(listings.status, "active")];
      if (input.category) where.push(eq(listings.category, input.category));
      if (input.kind) where.push(eq(listings.kind, input.kind));
      if (input.deal) where.push(eq(listings.deal, input.deal));
      if (input.condition) where.push(eq(listings.condition, input.condition));
      if (input.size) where.push(eq(listings.size, input.size));
      if (input.min != null) where.push(gte(listings.priceCents, Math.round(input.min * 100)));
      if (input.max != null) where.push(lte(listings.priceCents, Math.round(input.max * 100)));
      if (input.trade) where.push(eq(listings.acceptsTrade, true));
      if (input.shopId) where.push(eq(listings.shopId, input.shopId));
      if (input.city?.trim()) where.push(like(shops.city, `%${input.city.trim()}%`));
      if (input.q?.trim()) {
        const q = `%${input.q.trim()}%`;
        where.push(or(like(listings.title, q), like(listings.series, q), like(listings.characterName, q), like(listings.description, q), like(shops.name, q))!);
      }
      const page = input.cursor ?? input.page ?? 1;
      const order = input.sort === "precio_asc" ? [asc(listings.priceCents)]
        : input.sort === "precio_desc" ? [desc(listings.priceCents)]
        : [desc(listings.featured), desc(listings.id)];
      const [items, [tot]] = await Promise.all([
        db.select(card).from(listings).innerJoin(shops, eq(shops.id, listings.shopId))
          .where(and(...where)).orderBy(...order).limit(PAGE).offset((page - 1) * PAGE),
        db.select({ c: n(sql`count(*)`) }).from(listings).innerJoin(shops, eq(shops.id, listings.shopId)).where(and(...where)),
      ]);
      return { items, total: tot.c, page, pages: Math.max(1, Math.ceil(tot.c / PAGE)) };
    }),

  home: publicProcedure.query(async () => {
    const base = db.select(card).from(listings).innerJoin(shops, eq(shops.id, listings.shopId));
    const [recent, services, topShops, wants] = await Promise.all([
      base.where(and(eq(listings.status, "active"), eq(listings.kind, "product"))).orderBy(desc(listings.featured), desc(listings.id)).limit(8),
      db.select(card).from(listings).innerJoin(shops, eq(shops.id, listings.shopId))
        .where(and(eq(listings.status, "active"), eq(listings.kind, "service"))).orderBy(desc(listings.featured), desc(listings.id)).limit(4),
      db.select({
        id: shops.id, handle: shops.handle, name: shops.name, kind: shops.kind, avatarUrl: shops.avatarUrl,
        accent: shops.accent, city: shops.city, verified: shops.verified, hasStore: shops.hasStore, ...shopStats,
      }).from(shops).orderBy(desc(shops.verified), desc(shopStats.listingCount)).limit(8),
      db.select().from(wanted).where(eq(wanted.status, "open")).orderBy(desc(wanted.id)).limit(3),
    ]);
    return { recent, services, shops: topShops, wanted: wants.map(({ userId, contact, ...w }) => w) };
  }),

  byId: publicProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const [row] = await db.select({ listing: listings, shop: shops, ...shopStats })
      .from(listings).innerJoin(shops, eq(shops.id, listings.shopId)).where(eq(listings.id, input.id)).limit(1);
    const isMine = Boolean(row && ctx.user?.id === row.shop.userId);
    if (!row || (row.listing.status === "removed" && !isMine && ctx.user?.role !== "admin")) {
      throw fail("NOT_FOUND", "Esta publicación ya no está disponible.");
    }
    if (!isMine && firstView(ctx.user ? `u${ctx.user.id}` : `i${ctx.req.ip}`, input.id)) {
      await db.update(listings).set({ views: sql`${listings.views} + 1`, updatedAt: row.listing.updatedAt }).where(eq(listings.id, input.id));
    }
    let isFavorite = false;
    if (ctx.user) {
      const [f] = await db.select().from(favorites).where(and(eq(favorites.userId, ctx.user.id), eq(favorites.listingId, input.id))).limit(1);
      isFavorite = Boolean(f);
    }
    const more = await db.select(card).from(listings).innerJoin(shops, eq(shops.id, listings.shopId))
      .where(and(eq(listings.shopId, row.shop.id), eq(listings.status, "active"), ne(listings.id, input.id)))
      .orderBy(desc(listings.id)).limit(4);
    const { userId, ...shop } = row.shop;
    // Si esta persona ya lo pidió y el pedido sigue en curso, se le muestra en vez del botón
    let myOrder: { id: number; status: string } | null = null;
    if (ctx.user && !isMine) {
      const [o] = await db.select({ id: orders.id, status: orders.status }).from(orders)
        .where(and(eq(orders.listingId, input.id), eq(orders.buyerId, ctx.user.id), inArray(orders.status, ["pending", "accepted", "delivered"])))
        .orderBy(desc(orders.id)).limit(1);
      myOrder = o ?? null;
    }
    return {
      ...row.listing, isMine, isFavorite, more, myOrder,
      shop: { ...shop, listingCount: row.listingCount, followers: row.followers, rating: row.rating, reviewCount: row.reviewCount },
    };
  }),

  mine: authedProcedure.query(async ({ ctx }) => {
    const shop = await shopOf(ctx.user.id);
    if (!shop) return [];
    return db.select().from(listings).where(and(eq(listings.shopId, shop.id), ne(listings.status, "removed"))).orderBy(desc(listings.id));
  }),

  save: authedProcedure.input(listingInput).mutation(async ({ ctx, input }) => {
    const shop = await shopOf(ctx.user.id);
    if (!shop) throw fail("PRECONDITION_FAILED", "Crea tu vitrina antes de publicar.");
    const { id, price, supportsApp, stock, ...rest } = input;
    const kind = categoryOf(input.category)?.kind ?? "product";
    const base = toCents(price);
    const stocked = hasStock(kind, input.deal);
    const data = {
      ...rest, kind,
      priceCents: supportsApp && base != null ? base + SUPPORT_CENTS : base,
      condition: kind === "service" ? null : rest.condition ?? null,
      ...(supportsApp === undefined ? {} : { supportsApp }),
      ...(stocked && stock !== undefined ? { stock } : {}),
    } as const;
    if (id) {
      const [own] = await db.select({ id: listings.id, status: listings.status }).from(listings).where(and(eq(listings.id, id), eq(listings.shopId, shop.id))).limit(1);
      if (!own) throw fail("NOT_FOUND", "No encontramos esa publicación en tu vitrina.");
      // Reponer unidades de algo agotado lo vuelve a poner en venta
      const restock = own.status === "sold" && stocked && stock !== undefined && stock > 0;
      await db.update(listings).set(restock ? { ...data, status: "active" } : data).where(eq(listings.id, id));
      touch(T.listing(id), T.shop(shop.id), T.feed);
      return { id };
    }
    const [r] = await db.insert(listings).values({ ...data, shopId: shop.id });
    touch(T.shop(shop.id), T.feed, T.admin);
    return { id: r.insertId };
  }),

  setStatus: authedProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(["active", "paused", "sold", "removed"]) }))
    .mutation(async ({ ctx, input }) => {
      const shop = await shopOf(ctx.user.id);
      if (!shop) throw fail("NOT_FOUND", "No tienes vitrina.");
      const [l] = await db.select({ id: listings.id, supportsApp: listings.supportsApp, kind: listings.kind, deal: listings.deal, stock: listings.stock }).from(listings)
        .where(and(eq(listings.id, input.id), eq(listings.shopId, shop.id))).limit(1);
      if (!l) throw fail("NOT_FOUND", "No encontramos esa publicación en tu vitrina.");
      const stocked = hasStock(l.kind, l.deal);
      await db.update(listings).set({
        status: input.status,
        // Vendida del todo: sin unidades. Al volver a publicarla, al menos una.
        ...(stocked && input.status === "sold" ? { stock: 0 } : {}),
        ...(stocked && input.status === "active" && l.stock < 1 ? { stock: 1 } : {}),
      }).where(eq(listings.id, l.id));

      // Al vender (por fuera de un pedido) algo que llevaba el dólar para Cosland, queda un aporte pendiente
      let contributionId: number | null = null;
      const [open] = await db.select({ id: contributions.id, status: contributions.status }).from(contributions)
        .where(and(eq(contributions.listingId, l.id), isNull(contributions.orderId))).orderBy(desc(contributions.id)).limit(1);
      if (input.status === "sold" && l.supportsApp && (await getSettings()).enabled) {
        if (open?.status === "pending") contributionId = open.id;
        else {
          const [r] = await db.insert(contributions).values({ shopId: shop.id, listingId: l.id, amountCents: SUPPORT_CENTS });
          contributionId = r.insertId;
        }
      } else if (input.status !== "sold" && open?.status === "pending") {
        await db.delete(contributions).where(eq(contributions.id, open.id)); // se arrepintió de marcarla vendida
      }
      touch(T.listing(l.id), T.shop(shop.id), T.feed);
      return { ok: true, contributionId };
    }),

  // "Vendí una": una venta hecha por fuera de un pedido. Baja una unidad y, si era la última, queda vendida.
  sellOne: authedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const shop = await shopOf(ctx.user.id);
    if (!shop) throw fail("NOT_FOUND", "No tienes vitrina.");
    const [l] = await db.select({ id: listings.id, supportsApp: listings.supportsApp, kind: listings.kind, deal: listings.deal, stock: listings.stock, status: listings.status })
      .from(listings).where(and(eq(listings.id, input.id), eq(listings.shopId, shop.id))).limit(1);
    if (!l || l.status === "removed") throw fail("NOT_FOUND", "No encontramos esa publicación en tu vitrina.");
    const left = hasStock(l.kind, l.deal) ? Math.max(0, l.stock - 1) : 0;
    const sold = left === 0;
    await db.update(listings).set({ ...(hasStock(l.kind, l.deal) ? { stock: left } : {}), ...(sold ? { status: "sold" as const } : {}) }).where(eq(listings.id, l.id));
    let contributionId: number | null = null;
    if (l.supportsApp && (await getSettings()).enabled) {
      const [r] = await db.insert(contributions).values({ shopId: shop.id, listingId: l.id, amountCents: SUPPORT_CENTS });
      contributionId = r.insertId;
    }
    touch(T.listing(l.id), T.shop(shop.id), T.feed);
    return { ok: true, contributionId, stock: left, sold };
  }),

  toggleFavorite: authedProcedure.input(z.object({ listingId: z.number().int() })).mutation(async ({ ctx, input }) => {
    const cond = and(eq(favorites.userId, ctx.user.id), eq(favorites.listingId, input.listingId));
    const [f] = await db.select().from(favorites).where(cond).limit(1);
    if (f) await db.delete(favorites).where(cond);
    else await db.insert(favorites).values({ userId: ctx.user.id, listingId: input.listingId });
    return { favorite: !f };
  }),

  favoriteIds: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return [];
    const rows = await db.select({ id: favorites.listingId }).from(favorites).where(eq(favorites.userId, ctx.user.id));
    return rows.map((r) => r.id);
  }),

  favorites: authedProcedure.query(({ ctx }) =>
    db.select(card).from(favorites)
      .innerJoin(listings, eq(listings.id, favorites.listingId))
      .innerJoin(shops, eq(shops.id, listings.shopId))
      .where(and(eq(favorites.userId, ctx.user.id), ne(listings.status, "removed")))
      .orderBy(desc(favorites.createdAt))),
});

/* ───────── Mensajes ───────── */
async function postMessage(convId: number, senderId: number, fromSeller: boolean, body: string, listingId?: number | null, offerCents?: number | null, silent = false) {
  await db.insert(messages).values({ conversationId: convId, senderId, body, listingId: listingId ?? null, offerCents: offerCents ?? null });
  await db.update(conversations).set({
    lastBody: body.slice(0, 200), lastAt: new Date(),
    ...(fromSeller ? { buyerUnread: sql`${conversations.buyerUnread} + 1` } : { sellerUnread: sql`${conversations.sellerUnread} + 1` }),
  }).where(eq(conversations.id, convId));
  // Aviso en vivo a las dos personas de la conversación
  const [who] = await db.select({ buyerId: conversations.buyerId, ownerId: shops.userId, shopName: shops.name, buyerName: users.name })
    .from(conversations).innerJoin(shops, eq(shops.id, conversations.shopId)).innerJoin(users, eq(users.id, conversations.buyerId))
    .where(eq(conversations.id, convId)).limit(1);
  if (who) {
    publish([who.buyerId, who.ownerId], "chat", {
      conversationId: convId, from: senderId, fromName: fromSeller ? who.shopName : who.buyerName, preview: body.slice(0, 80), silent,
    });
  }
}

async function openConversation(buyerId: number, shopId: number) {
  const cond = and(eq(conversations.buyerId, buyerId), eq(conversations.shopId, shopId));
  const [c] = await db.select().from(conversations).where(cond).limit(1);
  if (c) return c.id;
  const [r] = await db.insert(conversations).values({ buyerId, shopId });
  return r.insertId;
}

const body = z.string().trim().min(1, "Escribe un mensaje").max(2000);

const chatRouter = router({
  // El comprador escribe a una vitrina (opcionalmente sobre una publicación o con una oferta)
  start: authedProcedure
    .input(z.object({ shopId: z.number().int(), listingId: z.number().int().optional(), body, offer: dollars }))
    .mutation(async ({ ctx, input }) => {
      const [shop] = await db.select().from(shops).where(eq(shops.id, input.shopId)).limit(1);
      if (!shop) throw fail("NOT_FOUND", "No encontramos esa vitrina.");
      if (shop.userId === ctx.user.id) throw fail("BAD_REQUEST", "Esta es tu propia vitrina.");
      const id = await openConversation(ctx.user.id, shop.id);
      await postMessage(id, ctx.user.id, false, input.body, input.listingId, toCents(input.offer));
      return { id };
    }),

  // Un vendedor responde a un pedido de "Se busca"
  answerWanted: authedProcedure.input(z.object({ wantedId: z.number().int(), body })).mutation(async ({ ctx, input }) => {
    const shop = await shopOf(ctx.user.id);
    if (!shop) throw fail("PRECONDITION_FAILED", "Crea tu vitrina para responder pedidos.");
    const [w] = await db.select().from(wanted).where(eq(wanted.id, input.wantedId)).limit(1);
    if (!w || w.status !== "open") throw fail("NOT_FOUND", "Ese pedido ya se cerró.");
    if (w.userId === ctx.user.id) throw fail("BAD_REQUEST", "Este pedido es tuyo.");
    const id = await openConversation(w.userId, shop.id);
    await postMessage(id, ctx.user.id, true, `Sobre tu pedido "${w.title}": ${input.body}`);
    return { id };
  }),

  list: authedProcedure.query(async ({ ctx }) => {
    const shop = await shopOf(ctx.user.id);
    const rows = await db.select({
      conv: conversations, shopName: shops.name, shopHandle: shops.handle, shopAvatar: shops.avatarUrl, shopAccent: shops.accent, buyerName: users.name,
    }).from(conversations)
      .innerJoin(shops, eq(shops.id, conversations.shopId))
      .innerJoin(users, eq(users.id, conversations.buyerId))
      .where(or(eq(conversations.buyerId, ctx.user.id), shop ? eq(conversations.shopId, shop.id) : undefined))
      .orderBy(desc(conversations.lastAt)).limit(100);
    return rows.map((r) => {
      const asSeller = shop?.id === r.conv.shopId && r.conv.buyerId !== ctx.user.id;
      return {
        id: r.conv.id, asSeller, lastBody: r.conv.lastBody, lastAt: r.conv.lastAt,
        unread: asSeller ? r.conv.sellerUnread : r.conv.buyerUnread,
        otherName: asSeller ? r.buyerName : r.shopName,
        otherHandle: asSeller ? null : r.shopHandle,
        otherAvatar: asSeller ? null : r.shopAvatar,
        accent: r.shopAccent,
      };
    });
  }),

  thread: authedProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const [r] = await db.select({ conv: conversations, shop: shops, buyerName: users.name }).from(conversations)
      .innerJoin(shops, eq(shops.id, conversations.shopId))
      .innerJoin(users, eq(users.id, conversations.buyerId))
      .where(eq(conversations.id, input.id)).limit(1);
    const asSeller = r?.shop.userId === ctx.user.id;
    if (!r || (!asSeller && r.conv.buyerId !== ctx.user.id)) throw fail("NOT_FOUND", "No encontramos esa conversación.");
    await db.update(conversations).set(asSeller ? { sellerUnread: 0 } : { buyerUnread: 0 }).where(eq(conversations.id, input.id));
    const rows = await db.select({
      id: messages.id, senderId: messages.senderId, body: messages.body, offerCents: messages.offerCents, createdAt: messages.createdAt,
      listingId: messages.listingId, listingTitle: listings.title, listingImages: listings.images, listingPrice: listings.priceCents, listingDeal: listings.deal,
    }).from(messages).leftJoin(listings, eq(listings.id, messages.listingId))
      .where(eq(messages.conversationId, input.id)).orderBy(desc(messages.id)).limit(200);
    return {
      id: r.conv.id, asSeller, me: ctx.user.id,
      otherName: asSeller ? r.buyerName : r.shop.name,
      otherHandle: asSeller ? null : r.shop.handle,
      whatsapp: asSeller ? null : r.shop.whatsapp,
      accent: r.shop.accent,
      messages: rows.reverse(),
    };
  }),

  send: authedProcedure.input(z.object({ id: z.number().int(), body, offer: dollars })).mutation(async ({ ctx, input }) => {
    const [r] = await db.select({ conv: conversations, ownerId: shops.userId }).from(conversations)
      .innerJoin(shops, eq(shops.id, conversations.shopId)).where(eq(conversations.id, input.id)).limit(1);
    const asSeller = r?.ownerId === ctx.user.id;
    if (!r || (!asSeller && r.conv.buyerId !== ctx.user.id)) throw fail("NOT_FOUND", "No encontramos esa conversación.");
    await postMessage(input.id, ctx.user.id, asSeller, input.body, null, toCents(input.offer));
    return { ok: true };
  }),
});

/* ───────── Pedidos: el flujo de venta ───────── */
// Devuelve unidades a una publicación (pedido cancelado) y la reactiva si se había agotado
async function releaseStock(listingId: number, quantity: number) {
  const [l] = await db.select({ kind: listings.kind, deal: listings.deal, status: listings.status }).from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!l || !hasStock(l.kind, l.deal)) return;
  await db.update(listings).set({ stock: sql`${listings.stock} + ${quantity}`, ...(l.status === "sold" ? { status: "active" as const } : {}) }).where(eq(listings.id, listingId));
}

const orderRouter = router({
  // El comprador toca "Lo quiero": queda el pedido y se abre el chat con el vendedor
  create: authedProcedure
    .input(z.object({ listingId: z.number().int(), quantity: z.number().int().min(1).max(99).default(1), note: optText(500) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.select({ l: listings, shopId: shops.id, ownerId: shops.userId }).from(listings)
        .innerJoin(shops, eq(shops.id, listings.shopId)).where(eq(listings.id, input.listingId)).limit(1);
      if (!row || row.l.status !== "active") throw fail("BAD_REQUEST", "Esta publicación ya no está disponible.");
      if (row.ownerId === ctx.user.id) throw fail("BAD_REQUEST", "Esta publicación es tuya.");
      const stocked = hasStock(row.l.kind, row.l.deal);
      const quantity = stocked ? input.quantity : 1;
      if (stocked && quantity > row.l.stock) throw fail("BAD_REQUEST", row.l.stock === 1 ? "Solo queda una unidad." : `Solo quedan ${row.l.stock} unidades.`);
      // Un pedido en curso por publicación y persona
      const [open] = await db.select({ id: orders.id, conversationId: orders.conversationId }).from(orders)
        .where(and(eq(orders.listingId, row.l.id), eq(orders.buyerId, ctx.user.id), inArray(orders.status, ["pending", "accepted"]))).limit(1);
      if (open) return { id: open.id, conversationId: open.conversationId, existing: true };

      const conversationId = await openConversation(ctx.user.id, row.shopId);
      const [r] = await db.insert(orders).values({
        listingId: row.l.id, shopId: row.shopId, buyerId: ctx.user.id, conversationId,
        title: row.l.title, unitPriceCents: row.l.priceCents, quantity, note: input.note,
      });
      const what = quantity > 1 ? `${quantity} unidades de "${row.l.title}"` : `"${row.l.title}"`;
      await postMessage(conversationId, ctx.user.id, false, `Hola, quiero ${row.l.kind === "service" ? "pedir" : "comprar"} ${what}.${input.note ? `\n${input.note}` : ""}`, row.l.id, null, true);
      publish([row.ownerId], "order", { id: r.insertId, text: `Nuevo pedido de ${ctx.user.name.split(" ")[0]}: ${row.l.title}` });
      touch(T.admin);
      return { id: r.insertId, conversationId, existing: false };
    }),

  // Mis compras y mis ventas
  mine: authedProcedure.query(async ({ ctx }) => {
    const shop = await shopOf(ctx.user.id);
    const rows = await db.select({
      id: orders.id, status: orders.status, title: orders.title, quantity: orders.quantity, unitPriceCents: orders.unitPriceCents, note: orders.note,
      createdAt: orders.createdAt, updatedAt: orders.updatedAt, listingId: orders.listingId, conversationId: orders.conversationId,
      buyerId: orders.buyerId, buyerName: users.name, shopName: shops.name, shopHandle: shops.handle, shopAccent: shops.accent,
      images: listings.images, deal: listings.deal,
    }).from(orders)
      .innerJoin(shops, eq(shops.id, orders.shopId)).innerJoin(users, eq(users.id, orders.buyerId)).leftJoin(listings, eq(listings.id, orders.listingId))
      .where(or(eq(orders.buyerId, ctx.user.id), shop ? eq(orders.shopId, shop.id) : undefined))
      .orderBy(desc(orders.id)).limit(200);
    const view = ({ buyerId, buyerName, images, ...o }: (typeof rows)[number]) => ({ ...o, image: images?.[0] ?? null, buyerName: buyerName.split(" ")[0] });
    return {
      hasShop: Boolean(shop),
      buying: rows.filter((o) => o.buyerId === ctx.user.id).map(view),
      selling: shop ? rows.filter((o) => o.buyerId !== ctx.user.id).map(view) : [],
    };
  }),

  // Cada paso del pedido. Quién puede hacer qué depende del estado.
  act: authedProcedure
    .input(z.object({ id: z.number().int(), action: z.enum(["accept", "reject", "cancel", "deliver", "receive"]) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db.select({ o: orders, ownerId: shops.userId }).from(orders).innerJoin(shops, eq(shops.id, orders.shopId)).where(eq(orders.id, input.id)).limit(1);
      const isSeller = row?.ownerId === ctx.user.id, isBuyer = row?.o.buyerId === ctx.user.id;
      if (!row || (!isSeller && !isBuyer)) throw fail("NOT_FOUND", "No encontramos ese pedido.");
      const o = row.o;
      const stale = () => fail("CONFLICT", "Ese pedido ya cambió. Mira cómo quedó y vuelve a intentar.");
      const [l] = await db.select({ kind: listings.kind, deal: listings.deal, supportsApp: listings.supportsApp }).from(listings).where(eq(listings.id, o.listingId)).limit(1);
      const stocked = Boolean(l) && hasStock(l.kind, l.deal);
      const move = async (from: (typeof o.status)[], to: typeof o.status, extra: Record<string, unknown> = {}) => {
        const [r] = await db.update(orders).set({ status: to, ...extra }).where(and(eq(orders.id, o.id), inArray(orders.status, from)));
        if (!r.affectedRows) throw stale(); // otra pestaña o la otra persona se adelantó
      };
      let say = "", contributionId: number | null = null;

      if (input.action === "accept" && isSeller) {
        if (o.status !== "pending") throw stale();
        if (stocked) {
          // Se apartan las unidades; si ya no alcanzan, no se puede aceptar
          const [r] = await db.update(listings).set({ stock: sql`${listings.stock} - ${o.quantity}` }).where(and(eq(listings.id, o.listingId), gte(listings.stock, o.quantity)));
          if (!r.affectedRows) throw fail("BAD_REQUEST", "Ya no te quedan suficientes unidades para este pedido. Repón la cantidad en la publicación o recházalo.");
        }
        try { await move(["pending"], "accepted"); } catch (e) { if (stocked) await releaseStock(o.listingId, o.quantity); throw e; }
        if (stocked) await db.update(listings).set({ status: "sold" }).where(and(eq(listings.id, o.listingId), lte(listings.stock, 0), eq(listings.status, "active")));
        say = `Acepté tu pedido de "${o.title}". Cuéntame cómo prefieres pagar y recibirlo.`;
      } else if (input.action === "reject" && isSeller) {
        await move(["pending"], "rejected");
        say = `No puedo atender el pedido de "${o.title}".`;
      } else if (input.action === "cancel" && (isBuyer || isSeller)) {
        const from: (typeof o.status)[] = isBuyer ? ["pending", "accepted"] : ["accepted"];
        if (!from.includes(o.status)) throw stale();
        await move(from, "cancelled");
        if (o.status === "accepted") await releaseStock(o.listingId, o.quantity);
        say = `Cancelé el pedido de "${o.title}".`;
      } else if (input.action === "deliver" && isSeller) {
        await move(["accepted"], "delivered", { deliveredAt: new Date() });
        // La venta se cerró: si la publicación llevaba el dólar para Cosland, queda el aporte de este pedido
        if (l?.supportsApp && (await getSettings()).enabled) {
          const [r] = await db.insert(contributions).values({ shopId: o.shopId, listingId: o.listingId, orderId: o.id, amountCents: SUPPORT_CENTS * o.quantity });
          contributionId = r.insertId;
        }
        say = `Marqué como entregado tu pedido de "${o.title}". Cuando lo tengas, confírmalo en Pedidos.`;
      } else if (input.action === "receive" && isBuyer) {
        await move(["delivered"], "completed");
        say = `Confirmé que recibí "${o.title}". ¡Gracias!`;
      } else throw fail("FORBIDDEN", "No puedes hacer eso con este pedido.");

      if (o.conversationId) await postMessage(o.conversationId, ctx.user.id, isSeller, say, o.listingId);
      publish([isSeller ? o.buyerId : row.ownerId], "order", { id: o.id });
      touch(T.listing(o.listingId), T.shop(o.shopId), T.feed, T.admin, contributionId ? T.support : null);
      return { ok: true, contributionId };
    }),
});

/* ───────── Reseñas ───────── */
async function canReview(userId: number, shopId: number) {
  const [shop] = await db.select({ userId: shops.userId }).from(shops).where(eq(shops.id, shopId)).limit(1);
  if (!shop || shop.userId === userId) return false;
  // Solo opina quien ya conversó con la vitrina
  const [c] = await db.select({ id: conversations.id }).from(conversations)
    .where(and(eq(conversations.buyerId, userId), eq(conversations.shopId, shopId))).limit(1);
  return Boolean(c);
}

const reviewRouter = router({
  list: publicProcedure.input(z.object({ shopId: z.number().int() })).query(async ({ ctx, input }) => ({
    canReview: ctx.user ? await canReview(ctx.user.id, input.shopId) : false,
    items: await db.select({
      id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, author: users.name, authorId: reviews.authorId,
    }).from(reviews).innerJoin(users, eq(users.id, reviews.authorId)).where(eq(reviews.shopId, input.shopId)).orderBy(desc(reviews.id)).limit(100),
  })),

  save: authedProcedure
    .input(z.object({ shopId: z.number().int(), rating: z.number().int().min(1).max(5), comment: optText(1000) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await canReview(ctx.user.id, input.shopId))) {
        throw fail("FORBIDDEN", "Para dejar una reseña, primero escríbele a la vitrina por una compra.");
      }
      await db.insert(reviews).values({ shopId: input.shopId, authorId: ctx.user.id, rating: input.rating, comment: input.comment })
        .onDuplicateKeyUpdate({ set: { rating: input.rating, comment: input.comment } });
      touch(T.shop(input.shopId), T.shops);
      return { ok: true };
    }),
});

/* ───────── Se busca ───────── */
const wantedRouter = router({
  list: publicProcedure.input(z.object({ category: z.string().max(40).optional() }).optional()).query(async ({ ctx, input }) => {
    const where: SQL[] = [eq(wanted.status, "open")];
    if (input?.category) where.push(eq(wanted.category, input.category));
    const rows = await db.select({ w: wanted, author: users.name }).from(wanted)
      .innerJoin(users, eq(users.id, wanted.userId)).where(and(...where)).orderBy(desc(wanted.id)).limit(100);
    return rows.map(({ w: { userId, contact, ...w }, author }) => ({ ...w, author: author.split(" ")[0], isMine: ctx.user?.id === userId }));
  }),

  create: authedProcedure
    .input(z.object({
      title: z.string().trim().min(4, "Cuenta qué buscas").max(120),
      description: optText(2000),
      category: z.enum(CATEGORY_IDS),
      budget: dollars,
      size: optText(30),
      city: optText(80),
    }))
    .mutation(async ({ ctx, input }) => {
      const { budget, ...rest } = input;
      const [r] = await db.insert(wanted).values({ ...rest, budgetCents: toCents(budget), userId: ctx.user.id });
      touch(T.wanted);
      return { id: r.insertId };
    }),

  close: authedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    await db.update(wanted).set({ status: "closed" }).where(and(eq(wanted.id, input.id), eq(wanted.userId, ctx.user.id)));
    touch(T.wanted);
    return { ok: true };
  }),
});

/* ───────── Aportes a Cosland ───────── */
const supportRouter = router({
  // Lo que ve todo el mundo: si está activo, la meta del mes y cuánto va. La cuenta solo se muestra con sesión.
  info: publicProcedure.query(async ({ ctx }) => {
    const cfg = await getSettings();
    const [m] = await db.select({
      total: n(sql`coalesce(sum(${contributions.amountCents}), 0)`),
      shops: n(sql`count(distinct ${contributions.shopId})`),
    }).from(contributions).where(and(eq(contributions.status, "confirmed"), sql`${contributions.confirmedAt} >= date_format(utc_timestamp(), '%Y-%m-01')`));
    return {
      enabled: cfg.enabled, amountCents: SUPPORT_CENTS, goalCents: cfg.goalCents,
      monthCents: m?.total ?? 0, supporters: m?.shops ?? 0,
      account: ctx.user ? cfg.account : null,
    };
  }),

  mine: authedProcedure.query(async ({ ctx }) => {
    const shop = await shopOf(ctx.user.id);
    if (!shop) return [];
    return db.select({
      id: contributions.id, status: contributions.status, amountCents: contributions.amountCents, createdAt: contributions.createdAt,
      listingId: contributions.listingId, listingTitle: listings.title,
    }).from(contributions).leftJoin(listings, eq(listings.id, contributions.listingId))
      .where(and(eq(contributions.shopId, shop.id), ne(contributions.status, "dismissed"))).orderBy(desc(contributions.id)).limit(100);
  }),

  // El vendedor avisa que ya envió el dólar (con referencia o comprobante, si quiere)
  report: authedProcedure
    .input(z.object({ id: z.number().int(), reference: optText(120), proofUrl: imageUrl.optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const shop = await shopOf(ctx.user.id);
      const [c] = shop ? await db.select().from(contributions).where(and(eq(contributions.id, input.id), eq(contributions.shopId, shop.id))).limit(1) : [];
      if (!c || c.status === "confirmed") throw fail("NOT_FOUND", "No encontramos ese aporte pendiente.");
      await db.update(contributions).set({ status: "reported", reference: input.reference, proofUrl: input.proofUrl ?? null, reportedAt: new Date() })
        .where(eq(contributions.id, c.id));
      touch(T.admin);
      return { ok: true };
    }),

  // Es voluntario: el vendedor puede decir que esta vez no
  skip: authedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const shop = await shopOf(ctx.user.id);
    if (shop) {
      await db.update(contributions).set({ status: "dismissed" })
        .where(and(eq(contributions.id, input.id), eq(contributions.shopId, shop.id), eq(contributions.status, "pending")));
    }
    return { ok: true };
  }),
});

/* ───────── Denuncias y administración ───────── */
const reportRouter = router({
  create: authedProcedure
    .input(z.object({ listingId: z.number().int(), reason: z.enum(REPORT_REASONS), detail: optText(1000) }))
    .mutation(async ({ ctx, input }) => {
      await db.insert(reports).values({ ...input, reporterId: ctx.user.id });
      touch(T.admin);
      return { ok: true };
    }),
});

const adminRouter = router({
  overview: adminProcedure.query(async () => {
    const c = (q: SQL) => db.execute(q).then((r: any) => Number(r[0][0].c));
    const [usersN, shopsN, listingsN, openReports, wantedN] = await Promise.all([
      c(sql`select count(*) c from users`), c(sql`select count(*) c from shops`),
      c(sql`select count(*) c from listings where status = 'active'`),
      c(sql`select count(*) c from reports where status = 'open'`),
      c(sql`select count(*) c from wanted where status = 'open'`),
    ]);
    const toVerify = await c(sql`select count(*) c from contributions where status = 'reported'`);
    const sales = await c(sql`select count(*) c from orders where status in ('delivered', 'completed')`);
    const openOrders = await c(sql`select count(*) c from orders where status in ('pending', 'accepted')`);
    return { users: usersN, shops: shopsN, listings: listingsN, openReports, wanted: wantedN, contributionsToVerify: toVerify, sales, openOrders };
  }),

  listings: adminProcedure.input(z.object({ q: z.string().max(80).optional() }).optional()).query(({ input }) =>
    db.select(card).from(listings).innerJoin(shops, eq(shops.id, listings.shopId))
      .where(input?.q?.trim() ? or(like(listings.title, `%${input.q.trim()}%`), like(shops.name, `%${input.q.trim()}%`)) : undefined)
      .orderBy(desc(listings.id)).limit(200)),

  setListing: adminProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(["active", "paused", "sold", "removed"]).optional(), featured: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const set: Record<string, unknown> = {};
      if (input.status) set.status = input.status;
      if (input.featured != null) set.featured = input.featured;
      if (Object.keys(set).length) await db.update(listings).set(set).where(eq(listings.id, input.id));
      const [own] = await db.select({ shopId: shops.id, userId: shops.userId }).from(listings)
        .innerJoin(shops, eq(shops.id, listings.shopId)).where(eq(listings.id, input.id)).limit(1);
      touch(T.listing(input.id), T.feed, T.admin, own && T.shop(own.shopId));
      if (own) publish([own.userId], "me", {});
      return { ok: true };
    }),

  shops: adminProcedure.query(() =>
    db.select({
      id: shops.id, handle: shops.handle, name: shops.name, kind: shops.kind, city: shops.city, verified: shops.verified,
      userId: users.id, email: users.email, banned: users.banned, ...shopStats,
    }).from(shops).innerJoin(users, eq(users.id, shops.userId)).orderBy(desc(shops.id)).limit(300)),

  setVerified: adminProcedure.input(z.object({ shopId: z.number().int(), verified: z.boolean() })).mutation(async ({ input }) => {
    await db.update(shops).set({ verified: input.verified }).where(eq(shops.id, input.shopId));
    const [own] = await db.select({ userId: shops.userId }).from(shops).where(eq(shops.id, input.shopId)).limit(1);
    touch(T.shop(input.shopId), T.shops, T.feed, T.admin);
    if (own) publish([own.userId], "me", {});
    return { ok: true };
  }),

  users: adminProcedure.query(() =>
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role, banned: users.banned, createdAt: users.createdAt })
      .from(users).orderBy(desc(users.id)).limit(300)),

  setBanned: adminProcedure.input(z.object({ userId: z.number().int(), banned: z.boolean() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw fail("BAD_REQUEST", "No puedes suspender tu propia cuenta.");
    await db.update(users).set({ banned: input.banned }).where(eq(users.id, input.userId));
    if (input.banned) {
      // Al suspender una cuenta, sus publicaciones salen de la tienda
      const mine = await db.select({ id: shops.id }).from(shops).where(eq(shops.userId, input.userId));
      if (mine.length) {
        await db.update(listings).set({ status: "removed" }).where(inArray(listings.shopId, mine.map((s) => s.id)));
        await db.update(orders).set({ status: "cancelled" }).where(and(inArray(orders.shopId, mine.map((s) => s.id)), inArray(orders.status, ["pending", "accepted"])));
      }
      touch(T.feed, T.shops, ...mine.map((s) => T.shop(s.id)));
    }
    touch(T.admin);
    publish([input.userId], "me", {});
    return { ok: true };
  }),

  reports: adminProcedure.query(() =>
    db.select({
      id: reports.id, reason: reports.reason, detail: reports.detail, status: reports.status, createdAt: reports.createdAt,
      listingId: listings.id, listingTitle: listings.title, listingStatus: listings.status, reporter: users.name,
    }).from(reports).innerJoin(listings, eq(listings.id, reports.listingId)).innerJoin(users, eq(users.id, reports.reporterId))
      .orderBy(asc(reports.status), desc(reports.id)).limit(200)),

  resolveReport: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    await db.update(reports).set({ status: "resolved" }).where(eq(reports.id, input.id));
    touch(T.admin);
    return { ok: true };
  }),

  // Ventas: todos los pedidos hechos dentro de Cosland
  orders: adminProcedure.query(() =>
    db.select({
      id: orders.id, status: orders.status, title: orders.title, quantity: orders.quantity, unitPriceCents: orders.unitPriceCents,
      createdAt: orders.createdAt, deliveredAt: orders.deliveredAt, listingId: orders.listingId,
      shopName: shops.name, shopHandle: shops.handle, buyerName: users.name, buyerEmail: users.email,
      contribution: sql<string | null>`(select c.status from contributions c where c.order_id = orders.id limit 1)`,
    }).from(orders).innerJoin(shops, eq(shops.id, orders.shopId)).innerJoin(users, eq(users.id, orders.buyerId))
      .orderBy(desc(orders.id)).limit(300)),

  /* Aportes: ajustes y verificación */
  supportSettings: adminProcedure.query(() => getSettings()),

  saveSupportSettings: adminProcedure
    .input(z.object({ enabled: z.boolean(), account: z.string().trim().max(1000), goal: z.number().min(0).max(1_000_000) }))
    .mutation(async ({ input }) => {
      if (input.enabled && !input.account) throw fail("BAD_REQUEST", "Escribe los datos de la cuenta antes de activar los aportes.");
      await setSetting("support_enabled", input.enabled ? "1" : "0");
      await setSetting("support_account", input.account);
      await setSetting("support_goal_cents", String(Math.round(input.goal * 100)));
      touch(T.support, T.admin);
      return { ok: true };
    }),

  contributions: adminProcedure.query(() =>
    db.select({
      id: contributions.id, status: contributions.status, amountCents: contributions.amountCents, reference: contributions.reference,
      proofUrl: contributions.proofUrl, createdAt: contributions.createdAt, reportedAt: contributions.reportedAt, confirmedAt: contributions.confirmedAt,
      shopName: shops.name, shopHandle: shops.handle, listingTitle: listings.title,
    }).from(contributions)
      .leftJoin(shops, eq(shops.id, contributions.shopId)).leftJoin(listings, eq(listings.id, contributions.listingId))
      .where(ne(contributions.status, "dismissed"))
      .orderBy(sql`field(${contributions.status}, 'reported', 'pending', 'confirmed')`, desc(contributions.id)).limit(300)),

  setContribution: adminProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(["confirmed", "dismissed", "reported"]) }))
    .mutation(async ({ input }) => {
      await db.update(contributions).set({ status: input.status, confirmedAt: input.status === "confirmed" ? new Date() : null })
        .where(eq(contributions.id, input.id));
      const [own] = await db.select({ shopId: shops.id, userId: shops.userId }).from(contributions)
        .innerJoin(shops, eq(shops.id, contributions.shopId)).where(eq(contributions.id, input.id)).limit(1);
      touch(T.support, T.admin, own && T.shop(own.shopId));
      if (own) publish([own.userId], "me", {});
      return { ok: true };
    }),
});

export const appRouter = router({
  auth: authRouter, shop: shopRouter, listing: listingRouter, chat: chatRouter,
  review: reviewRouter, wanted: wantedRouter, report: reportRouter, support: supportRouter, order: orderRouter, admin: adminRouter,
});
export type AppRouter = typeof appRouter;
