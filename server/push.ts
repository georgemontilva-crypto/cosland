import { createHash } from "node:crypto";
import webpush from "web-push";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import { conversations, orders, pushSubscriptions, settings, shops } from "./schema";
import { isWatching, publish } from "./realtime";

// Avisos fuera de la app: notificaciones push del navegador y de la app instalada (también en iPhone,
// con Cosland añadida a la pantalla de inicio). Las llaves se crean solas la primera vez y se guardan
// en la base; si prefieres fijarlas, define VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.
let keys: Promise<{ publicKey: string; privateKey: string }> | null = null;

async function loadKeys() {
  const env = { publicKey: process.env.VAPID_PUBLIC_KEY?.trim(), privateKey: process.env.VAPID_PRIVATE_KEY?.trim() };
  if (env.publicKey && env.privateKey) return { publicKey: env.publicKey, privateKey: env.privateKey };
  const read = async () => {
    const rows = await db.select().from(settings).where(inArray(settings.key, ["push_public", "push_private"]));
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return map.push_public && map.push_private ? { publicKey: map.push_public as string, privateKey: map.push_private as string } : null;
  };
  const had = await read();
  if (had) return had;
  const made = webpush.generateVAPIDKeys();
  // Si dos procesos arrancan a la vez, gana el primero que guardó la llave pública
  await db.insert(settings).values({ key: "push_public", value: made.publicKey }).onDuplicateKeyUpdate({ set: { key: "push_public" } });
  const [pub] = await db.select().from(settings).where(eq(settings.key, "push_public")).limit(1);
  if (pub?.value === made.publicKey) await db.insert(settings).values({ key: "push_private", value: made.privateKey }).onDuplicateKeyUpdate({ set: { value: made.privateKey } });
  return (await read()) ?? made;
}
const vapid = () => (keys ??= loadKeys().catch((e) => { keys = null; throw e; }));
export const pushPublicKey = async () => (await vapid()).publicKey;

// Solo se aceptan direcciones de los servicios de avisos de los navegadores: así nadie puede usar
// una suscripción inventada para hacer que el servidor llame a otra dirección.
const PUSH_HOSTS = ["fcm.googleapis.com", ".push.apple.com", ".push.services.mozilla.com", ".notify.windows.com", ".push.samsungosp.com"];
export function pushEndpointAllowed(endpoint: string) {
  try {
    const u = new URL(endpoint);
    const extra = (process.env.PUSH_ALLOW_HOSTS ?? "").split(",").map((h: string) => h.trim()).filter(Boolean); // para pruebas locales
    if (extra.includes(u.host)) return true;
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => (h.startsWith(".") ? u.hostname.endsWith(h) : u.hostname === h));
  } catch { return false; }
}

const hash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");
const subject = () => `mailto:${process.env.CONTACT_EMAIL?.trim() || "hola@cosland.app"}`;

export async function savePushSubscription(userId: number, s: { endpoint: string; p256dh: string; auth: string }) {
  // Un dispositivo pertenece a la última cuenta que activó los avisos en él
  await db.insert(pushSubscriptions).values({ userId, endpointHash: hash(s.endpoint), endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    .onDuplicateKeyUpdate({ set: { userId, p256dh: s.p256dh, auth: s.auth } });
}
export async function removePushSubscription(endpoint: string, userId?: number) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpointHash, hash(endpoint)), userId ? eq(pushSubscriptions.userId, userId) : undefined));
}

// Lo que espera a esta persona: mensajes sin leer y pedidos con algo por hacer. Es el número del icono.
export async function pendingCount(userId: number) {
  const n = (v: unknown) => Number(v ?? 0);
  const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.userId, userId)).limit(1);
  const [a] = await db.select({ c: sql`coalesce(sum(${conversations.buyerUnread}), 0)` }).from(conversations).where(eq(conversations.buyerId, userId));
  let unread = n(a?.c);
  if (shop) {
    const [b] = await db.select({ c: sql`coalesce(sum(${conversations.sellerUnread}), 0)` }).from(conversations).where(eq(conversations.shopId, shop.id));
    unread += n(b?.c);
  }
  const [toDo] = await db.select({ c: sql`count(*)` }).from(orders).where(or(
    and(eq(orders.buyerId, userId), or(eq(orders.status, "delivered"), and(eq(orders.status, "accepted"), eq(orders.payStatus, "unpaid")))),
    shop ? and(eq(orders.shopId, shop.id), or(eq(orders.status, "pending"), and(eq(orders.status, "accepted"), ne(orders.payStatus, "unpaid")))) : undefined,
  ));
  return { unread, orders: n(toDo?.c) };
}

export type Alert = { title: string; body: string; url: string; tag: string };

// Notificación al teléfono o al computador. Si la persona tiene Cosland a la vista, no se manda:
// el aviso ya le sale dentro de la app. Nunca frena ni rompe la acción que lo provocó.
export function notify(userId: number, alert: Alert, always = false) {
  void (async () => {
    if (!always && isWatching(userId)) return;
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (!subs.length) return;
    const k = await vapid();
    const count = await pendingCount(userId);
    const payload = JSON.stringify({ ...alert, body: alert.body.slice(0, 180), badge: count.unread + count.orders });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 24, urgency: "high", topic: alert.tag.replace(/[^\w-]/g, "").slice(0, 32) || undefined,
          vapidDetails: { subject: subject(), publicKey: k.publicKey, privateKey: k.privateKey },
        });
      } catch (e) {
        // El dispositivo ya no existe o quitó el permiso: se olvida
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        else console.warn("[push] no se pudo enviar:", status ?? (e as Error).message);
      }
    }));
  })().catch((e) => console.warn("[push]", (e as Error).message));
}

// Aviso corto que no es chat ni pedido: sale como mensajito dentro de la app y como notificación fuera
export function alertUser(userId: number, alert: Alert) {
  publish([userId], "note", { text: alert.body, url: alert.url });
  notify(userId, alert);
}
