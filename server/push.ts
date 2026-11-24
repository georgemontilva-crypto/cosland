import { createHash, createSign } from "node:crypto";
import webpush from "web-push";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import { conversations, deviceTokens, orders, pushSubscriptions, settings, shops } from "./schema";
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

/* ── App Android: avisos por Firebase Cloud Messaging ──
   Se activan al poner en Railway la variable FIREBASE_SERVICE_ACCOUNT con el JSON de la cuenta de servicio
   del proyecto de Firebase. Sin ella, esta parte no hace nada. */
type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };
const firebase: ServiceAccount | null = (() => {
  try {
    const a = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "") as ServiceAccount;
    return a.project_id && a.client_email && a.private_key ? a : null;
  } catch { return null; }
})();
export const fcmReady = Boolean(firebase);
const FCM_HOST = process.env.FCM_HOST?.trim() || "https://fcm.googleapis.com"; // se cambia solo en pruebas
let fcmAccess: { token: string; until: number } | null = null;

async function fcmToken() {
  if (fcmAccess && fcmAccess.until > Date.now() + 60_000) return fcmAccess.token;
  const b64 = (x: object) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const now = Math.floor(Date.now() / 1000), aud = firebase!.token_uri || "https://oauth2.googleapis.com/token";
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: firebase!.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud, iat: now, exp: now + 3600 })}`;
  const jwt = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(firebase!.private_key).toString("base64url")}`;
  const r = await fetch(aud, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }), signal: AbortSignal.timeout(15_000) });
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!r.ok || !d.access_token) throw new Error(`Firebase no dio acceso (${r.status})`);
  fcmAccess = { token: d.access_token, until: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return fcmAccess.token;
}

async function sendToDevices(userId: number, alert: Alert, badge: number) {
  if (!firebase) return;
  const devices = await db.select().from(deviceTokens).where(eq(deviceTokens.userId, userId));
  if (!devices.length) return;
  const access = await fcmToken();
  await Promise.all(devices.map(async (d) => {
    try {
      const r = await fetch(`${FCM_HOST}/v1/projects/${firebase.project_id}/messages:send`, {
        method: "POST", headers: { authorization: `Bearer ${access}`, "content-type": "application/json" }, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ message: {
          token: d.token,
          notification: { title: alert.title, body: alert.body.slice(0, 180) },
          data: { url: alert.url, tag: alert.tag, badge: String(badge) },
          android: { priority: "HIGH", ttl: "86400s", notification: { channel_id: "avisos", sound: "default", tag: alert.tag, default_vibrate_timings: true, notification_count: badge } },
        } }),
      });
      // El teléfono desinstaló la app o el token caducó: se olvida
      if (r.status === 404 || r.status === 410) await db.delete(deviceTokens).where(eq(deviceTokens.id, d.id));
      else if (!r.ok) console.warn("[push] Firebase respondió", r.status, (await r.text().catch(() => "")).slice(0, 200));
    } catch (e) { console.warn("[push] no se pudo enviar al teléfono:", (e as Error).message); }
  }));
}

export async function saveDeviceToken(userId: number, token: string) {
  // Un teléfono pertenece a la última cuenta que entró en él
  await db.insert(deviceTokens).values({ userId, tokenHash: hash(token), token }).onDuplicateKeyUpdate({ set: { userId } });
}
export async function removeDeviceToken(token: string, userId?: number) {
  await db.delete(deviceTokens).where(and(eq(deviceTokens.tokenHash, hash(token)), userId ? eq(deviceTokens.userId, userId) : undefined));
}

// Notificación al teléfono o al computador. Si la persona tiene Cosland a la vista, no se manda:
// el aviso ya le sale dentro de la app. Nunca frena ni rompe la acción que lo provocó.
export function notify(userId: number, alert: Alert, always = false) {
  void (async () => {
    if (!always && isWatching(userId)) return;
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    const count = await pendingCount(userId);
    await sendToDevices(userId, alert, count.unread + count.orders).catch((e) => console.warn("[push]", (e as Error).message));
    if (!subs.length) return;
    const k = await vapid();
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
