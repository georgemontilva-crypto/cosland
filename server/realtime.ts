import type { Response } from "express";

// Canal en vivo (Server-Sent Events): cada pestaña visible mantiene una conexión
// y el servidor le empuja avisos cortos. Vive en memoria del proceso; si algún día
// se corre más de una instancia, hay que pasar esto por Redis.
//
// Hay dos tipos de aviso:
//  · personales (chat, seguidores, "me"): van solo a las conexiones de esa persona.
//  · de novedades ("sync"): una lista de temas que cambiaron ("l:12", "s:3", "feed"…).
//    No llevan datos: cada pantalla vuelve a pedir únicamente lo que tiene abierto.
//    Se juntan durante un momento para que mucha actividad sea un solo mensaje.

type Conn = { res: Response; userId: number | null; ip: string };

const conns = new Set<Conn>();
const byUser = new Map<number, Set<Conn>>();
const anonByIp = new Map<string, number>();

const MAX_TOTAL = 4000;        // tope de conexiones abiertas a la vez
const MAX_PER_USER = 6;        // pestañas o dispositivos de una misma cuenta
const MAX_ANON_PER_IP = 40;    // visitantes sin cuenta desde una misma red
const MAX_BUFFER = 64 * 1024;  // si un cliente no lee, se suelta en vez de acumularle
const FLUSH_MS = 1500;         // ventana para juntar novedades
const MAX_TOPICS = 60;         // si cambió demasiado a la vez, se manda "all"

export function canSubscribe(userId: number | null, ip: string) {
  if (conns.size >= MAX_TOTAL) return false;
  if (userId == null && (anonByIp.get(ip) ?? 0) >= MAX_ANON_PER_IP) return false;
  return true;
}

function drop(c: Conn) {
  if (!conns.delete(c)) return;
  if (c.userId != null) {
    const set = byUser.get(c.userId);
    set?.delete(c);
    if (set && !set.size) byUser.delete(c.userId);
  } else {
    const left = (anonByIp.get(c.ip) ?? 1) - 1;
    if (left > 0) anonByIp.set(c.ip, left); else anonByIp.delete(c.ip);
  }
}

function send(c: Conn, payload: string) {
  try {
    if (c.res.writableEnded || c.res.destroyed) return drop(c);
    if (c.res.writableLength > MAX_BUFFER) { drop(c); c.res.end(); return; }
    c.res.write(payload);
  } catch { drop(c); }
}

export function subscribe(userId: number | null, ip: string, res: Response) {
  const c: Conn = { res, userId, ip };
  if (userId != null) {
    let set = byUser.get(userId);
    if (!set) byUser.set(userId, (set = new Set()));
    if (set.size >= MAX_PER_USER) {
      // Se cierra la más vieja y se le avisa que no reconecte hasta que la vuelvan a mirar
      const oldest = set.values().next().value;
      if (oldest) { try { oldest.res.write("event: bye\ndata: 1\n\n"); oldest.res.end(); } catch { /* ya cerrada */ } drop(oldest); }
    }
    set.add(c);
  } else {
    anonByIp.set(ip, (anonByIp.get(ip) ?? 0) + 1);
  }
  conns.add(c);
  return () => drop(c);
}

// Aviso personal: solo a las conexiones de esas cuentas
export function publish(userIds: number[], event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const id of new Set(userIds)) byUser.get(id)?.forEach((c) => send(c, payload));
}

// Novedades públicas: se acumulan y salen juntas en un solo mensaje
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function touch(...topics: (string | null | undefined | false)[]) {
  for (const t of topics) if (t) pending.add(t);
  if (!pending.size || flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_MS);
  flushTimer.unref?.();
}

function flush() {
  flushTimer = null;
  const topics = pending.size > MAX_TOPICS ? ["all"] : [...pending];
  pending.clear();
  if (!conns.size) return;
  const payload = `event: sync\ndata: ${JSON.stringify(topics)}\n\n`;
  for (const c of conns) send(c, payload);
}

// Un solo latido para todas las conexiones (mantiene vivo el canal a través de proxies)
const beat = setInterval(() => { for (const c of conns) send(c, ": ping\n\n"); }, 25_000);
beat.unref?.();

export const liveStats = () => ({ connections: conns.size, accounts: byUser.size });

// Nombres de los temas, en un solo lugar
export const T = {
  listing: (id: number) => `l:${id}`,
  shop: (id: number) => `s:${id}`,
  feed: "feed",      // cambió alguna lista de publicaciones
  shops: "shops",    // cambió la lista de vitrinas
  wanted: "wanted",
  support: "support",
  admin: "admin",    // algo nuevo para el panel de administración
} as const;
