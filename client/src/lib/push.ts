import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { trpc } from "./trpc";
import { useToast } from "@/components/ui";

// Avisos fuera de la app: notificaciones del navegador o de Cosland instalada en la pantalla de inicio.
// "install" es el iPhone con Cosland abierta en Safari: ahí los avisos solo existen si se añade al inicio.
export type PushState = "unsupported" | "install" | "off" | "on" | "blocked";
const KEY = ["push-state"];

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((ok) => setTimeout(() => ok(null), 3000))]);
}

export async function currentSubscription() {
  try { return (await (await registration())?.pushManager?.getSubscription()) ?? null; } catch { return null; }
}

async function readState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") return isIos() && !standalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (!(await registration())) return "unsupported";
  return Notification.permission === "granted" && (await currentSubscription()) ? "on" : "off";
}

const toBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const keysOf = (sub: PushSubscription) => {
  const j = sub.toJSON();
  return j.endpoint && j.keys?.p256dh && j.keys?.auth ? { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth } : null;
};

export function usePush() {
  const qc = useQueryClient();
  const utils = trpc.useUtils();
  const toast = useToast();
  const state = useQuery({ queryKey: KEY, queryFn: readState, staleTime: Infinity }).data;
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  // Tiene que llamarse directo desde el toque: el permiso solo se puede pedir así
  const enable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast(permission === "denied" ? "Los avisos quedaron bloqueados. Puedes permitirlos en los ajustes del navegador." : "No se activaron los avisos.", true); return false; }
      const reg = await registration();
      if (!reg) throw new Error("sin service worker");
      const { key } = await utils.client.push.publicKey.query();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
      const data = keysOf(sub);
      if (!data) throw new Error("suscripción incompleta");
      await utils.client.push.subscribe.mutate(data);
      toast("Avisos activados. Te mandamos uno de prueba.");
      utils.client.push.test.mutate().catch(() => {});
      return true;
    } catch {
      toast("No se pudieron activar los avisos en este dispositivo.", true);
      return false;
    } finally { refresh(); }
  };

  const disable = async () => {
    const sub = await currentSubscription();
    if (sub) {
      await utils.client.push.unsubscribe.mutate({ endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    toast("Avisos desactivados en este dispositivo");
    refresh();
  };
  return { state, enable, disable };
}

// Mantiene al día lo que no depende de un toque: a qué cuenta pertenece este dispositivo,
// el número en el icono de la app y a dónde lleva tocar una notificación.
export function usePushSync(me: { id: number; unread: number; orders: number } | null) {
  const utils = trpc.useUtils();
  const [, go] = useLocation();
  const userId = me?.id ?? null;
  useEffect(() => {
    if (!userId || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let live = true;
    currentSubscription().then((sub) => { const data = sub && keysOf(sub); if (live && data) utils.client.push.subscribe.mutate(data).catch(() => {}); });
    return () => { live = false; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Número en el icono: mensajes sin leer más pedidos que esperan algo
  const count = me ? me.unread + me.orders : 0;
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try { (count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.())?.catch(() => {}); } catch { /* este navegador no pone número en el icono */ }
  }, [count]);

  // Al tocar una notificación con Cosland ya abierta, el service worker pide ir a esa pantalla
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const url = (e.data as { go?: string } | null)?.go;
      if (typeof url !== "string") return;
      try { const u = new URL(url, location.origin); if (u.origin === location.origin) { go(u.pathname + u.search); utils.auth.me.invalidate(); utils.chat.invalidate(); utils.order.invalidate(); } } catch { /* dirección rara: se ignora */ }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
