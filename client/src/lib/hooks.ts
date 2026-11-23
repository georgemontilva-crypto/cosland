import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createLive, retryDelay } from "@shared/live";
import { useLocation } from "wouter";
import { trpc } from "./trpc";
import { useToast } from "@/components/ui";

export function useMe() {
  const q = trpc.auth.me.useQuery(undefined, { staleTime: 30_000, refetchInterval: 120_000 });
  return { me: q.data ?? null, loading: q.isLoading };
}

// Corazón de favoritos con respuesta inmediata
export function useFavorites() {
  const utils = trpc.useUtils();
  const toast = useToast();
  const [, go] = useLocation();
  const { me } = useMe();
  const ids = trpc.listing.favoriteIds.useQuery(undefined, { staleTime: 60_000 }).data ?? [];
  const m = trpc.listing.toggleFavorite.useMutation({
    onMutate: async ({ listingId }) => {
      await utils.listing.favoriteIds.cancel();
      const prev = utils.listing.favoriteIds.getData() ?? [];
      utils.listing.favoriteIds.setData(undefined, prev.includes(listingId) ? prev.filter((i) => i !== listingId) : [...prev, listingId]);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx) utils.listing.favoriteIds.setData(undefined, ctx.prev); },
    onSuccess: (r) => { toast(r.favorite ? "Guardado en tus favoritos" : "Quitado de tus favoritos"); utils.listing.favorites.invalidate(); },
  });
  return {
    has: (id: number) => ids.includes(id),
    toggle: (id: number) => {
      if (!me) { toast("Entra a tu cuenta para guardar favoritos"); go(`/entrar?volver=${encodeURIComponent(location.pathname)}`); return; }
      m.mutate({ listingId: id });
    },
  };
}

// Canal en vivo: una sola conexión abierta con el servidor mientras la pestaña está a la vista.
// Trae el chat y los seguidores al instante, y los avisos de qué cambió en vitrinas y publicaciones.
const PARK_AFTER_MS = 60_000;  // en segundo plano, la conexión se suelta al minuto
const AWAY_MS = 20_000;        // si estuvo fuera más que esto, al volver se pone al día

export function useRealtime(userId: number | null) {
  const utils = trpc.useUtils();
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const live = createLive(qc);
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let park: ReturnType<typeof setTimeout> | undefined;
    let stopped = false, attempts = 0, opened = false, hiddenAt = 0;
    const refreshChat = (id?: number) => {
      if (!userId) return;
      utils.chat.list.invalidate();
      utils.auth.me.invalidate();
      if (id) utils.chat.thread.invalidate({ id }); else utils.chat.thread.invalidate();
    };
    const close = () => { clearTimeout(retry); es?.close(); es = null; };
    const connect = () => {
      if (stopped || document.visibilityState !== "visible") return;
      close();
      const src = (es = new EventSource("/api/events"));
      src.onopen = () => {
        attempts = 0;
        if (opened) { refreshChat(); live.catchUp(); } // al reconectar, se pone al día
        opened = true;
      };
      src.addEventListener("sync", (e) => {
        try { live.push(JSON.parse((e as MessageEvent).data) as string[]); } catch { /* aviso ilegible */ }
      });
      src.addEventListener("me", () => live.push(["me"]));
      src.addEventListener("chat", (e) => {
        const m = JSON.parse((e as MessageEvent).data) as { conversationId: number; from: number; fromName: string; silent?: boolean };
        refreshChat(m.conversationId);
        const open = location.pathname === `/mensajes/${m.conversationId}` && document.visibilityState === "visible";
        if (m.from !== userId && !open && !m.silent) toast(`Nuevo mensaje de ${m.fromName}`);
      });
      // Pedidos: llega uno nuevo o la otra persona dio un paso
      src.addEventListener("order", (e) => {
        const m = JSON.parse((e as MessageEvent).data) as { text?: string };
        live.push(["me"]);
        if (m.text) toast(m.text);
      });
      src.addEventListener("follow", (e) => {
        const m = JSON.parse((e as MessageEvent).data) as { name: string };
        utils.auth.me.invalidate();
        toast(`${m.name} empezó a seguir tu vitrina`);
      });
      // El servidor cerró esta pestaña por tener demasiadas abiertas: vuelve al mirarla de nuevo
      src.addEventListener("bye", () => { if (es === src) close(); });
      src.onerror = () => {
        // Si solo se cortó, el navegador reintenta solo. Si quedó cerrada, se reabre con espera creciente.
        if (es !== src || src.readyState !== EventSource.CLOSED) return;
        clearTimeout(retry);
        retry = setTimeout(connect, retryDelay(attempts++));
      };
    };
    const onVisibility = () => {
      clearTimeout(park);
      if (document.visibilityState !== "visible") {
        hiddenAt = Date.now();
        live.setVisible(false);
        park = setTimeout(close, PARK_AFTER_MS);
        return;
      }
      live.setVisible(true);
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      refreshChat(); // el teléfono pausa la conexión en segundo plano
      if (away > AWAY_MS) live.catchUp();
      if (!es || es.readyState === EventSource.CLOSED) { attempts = 0; connect(); }
    };
    const onOnline = () => { if (!es || es.readyState === EventSource.CLOSED) { attempts = 0; connect(); } };
    connect();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true; clearTimeout(park); close(); live.stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [userId]);
}
