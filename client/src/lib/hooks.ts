import { useEffect } from "react";
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

// Chat en vivo: una conexión abierta con el servidor que avisa apenas llega un mensaje
export function useRealtime(userId: number | null) {
  const utils = trpc.useUtils();
  const toast = useToast();
  useEffect(() => {
    if (!userId || typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const refresh = (id?: number) => {
      utils.chat.list.invalidate();
      utils.auth.me.invalidate();
      if (id) utils.chat.thread.invalidate({ id }); else utils.chat.thread.invalidate();
    };
    const connect = () => {
      if (stopped) return;
      es?.close();
      es = new EventSource("/api/events");
      let first = true;
      es.onopen = () => { if (!first) refresh(); first = false; }; // al reconectar, se pone al día
      es.addEventListener("chat", (e) => {
        const m = JSON.parse((e as MessageEvent).data) as { conversationId: number; from: number; fromName: string };
        refresh(m.conversationId);
        const open = location.pathname === `/mensajes/${m.conversationId}` && document.visibilityState === "visible";
        if (m.from !== userId && !open) toast(`Nuevo mensaje de ${m.fromName}`);
      });
      es.onerror = () => {
        // El navegador reintenta solo; si la conexión quedó cerrada del todo, se abre otra
        if (es?.readyState === EventSource.CLOSED) { clearTimeout(retry); retry = setTimeout(connect, 5000); }
      };
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refresh(); // el teléfono pausa la conexión en segundo plano
      if (!es || es.readyState === EventSource.CLOSED) connect();
    };
    connect();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true; clearTimeout(retry); es?.close();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [userId]);
}
