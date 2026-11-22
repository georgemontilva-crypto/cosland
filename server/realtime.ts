import type { Response } from "express";

// Canal en vivo (Server-Sent Events): cada pestaña abierta mantiene una conexión
// y el servidor le empuja los avisos al instante. Vive en memoria del proceso;
// si algún día se corre más de una instancia, hay que pasar esto por Redis.
const streams = new Map<number, Set<Response>>();
const MAX_PER_USER = 6;

export function subscribe(userId: number, res: Response) {
  let set = streams.get(userId);
  if (!set) streams.set(userId, (set = new Set()));
  if (set.size >= MAX_PER_USER) {
    const oldest = set.values().next().value;
    if (oldest) { set.delete(oldest); oldest.end(); }
  }
  set.add(res);
  return () => {
    set!.delete(res);
    if (!set!.size) streams.delete(userId);
  };
}

export function publish(userIds: number[], event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const id of new Set(userIds)) {
    streams.get(id)?.forEach((res) => { try { res.write(payload); } catch { /* conexión cerrada */ } });
  }
}
