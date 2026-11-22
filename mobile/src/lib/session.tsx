import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { router, usePathname } from "expo-router";
import EventSource from "react-native-sse";
import { useQueryClient } from "@tanstack/react-query";
import { createLive, retryDelay } from "@shared/live";
import { API, authHeaders, getToken, loadToken, saveToken, trpc } from "./api";
import { useToast } from "@/ui/core";

type Session = {
  ready: boolean;
  me: NonNullable<ReturnType<typeof useMeQuery>["data"]> | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const Ctx = createContext<Session>({ ready: false, me: null, loading: true, signIn: async () => {}, signOut: async () => {} });
export const useSession = () => useContext(Ctx);

function useMeQuery(enabled: boolean) {
  return trpc.auth.me.useQuery(undefined, { enabled, staleTime: 30_000, refetchInterval: 120_000 });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const utils = trpc.useUtils();
  useEffect(() => { loadToken().finally(() => setReady(true)); }, []);
  const q = useMeQuery(ready);

  const signIn = useCallback(async (token: string) => { await saveToken(token); await utils.invalidate(); }, [utils]);
  const signOut = useCallback(async () => { await saveToken(null); await utils.invalidate(); }, [utils]);

  return (
    <Ctx.Provider value={{ ready, me: q.data ?? null, loading: !ready || q.isLoading, signIn, signOut }}>
      <Realtime userId={q.data?.id ?? null} ready={ready} />
      {children}
    </Ctx.Provider>
  );
}

// Canal en vivo: una sola conexión abierta con el servidor mientras la app está en primer plano.
// Trae el chat y los seguidores al instante, y los avisos de qué cambió en vitrinas y publicaciones.
const AWAY_MS = 20_000; // si la app estuvo en segundo plano más que esto, al volver se pone al día
type LiveEvent = "chat" | "follow" | "sync" | "me" | "bye";

function Realtime({ userId, ready }: { userId: number | null; ready: boolean }) {
  const utils = trpc.useUtils();
  const qc = useQueryClient();
  const toast = useToast();
  const path = usePathname();
  useEffect(() => { currentPath = path; }, [path]);

  useEffect(() => {
    if (!ready) return;
    const live = createLive(qc);
    let es: EventSource<LiveEvent> | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false, attempts = 0, opened = false, awayAt = 0;
    const refreshChat = (id?: number) => {
      if (!userId) return;
      utils.chat.list.invalidate();
      utils.auth.me.invalidate();
      if (id) utils.chat.thread.invalidate({ id }); else utils.chat.thread.invalidate();
    };
    const close = () => { clearTimeout(retry); if (es) { es.removeAllEventListeners(); es.close(); es = null; } };
    const connect = () => {
      if (stopped || AppState.currentState !== "active") return;
      close();
      const src = (es = new EventSource<LiveEvent>(`${API}/api/events`, { headers: authHeaders(), pollingInterval: 5000, timeout: 0 }));
      src.addEventListener("open", () => {
        attempts = 0;
        if (opened) { refreshChat(); live.catchUp(); } // al reconectar, se pone al día
        opened = true;
      });
      src.addEventListener("sync", (e) => {
        try { if (e.data) live.push(JSON.parse(e.data) as string[]); } catch { /* aviso ilegible */ }
      });
      src.addEventListener("me", () => live.push(["me"]));
      src.addEventListener("chat", (e) => {
        if (!e.data) return;
        const m = JSON.parse(e.data) as { conversationId: number; from: number; fromName: string };
        refreshChat(m.conversationId);
        if (m.from !== userId && currentPath !== `/mensajes/${m.conversationId}`) toast(`Nuevo mensaje de ${m.fromName}`);
      });
      src.addEventListener("follow", (e) => {
        if (!e.data) return;
        const m = JSON.parse(e.data) as { name: string };
        utils.auth.me.invalidate();
        toast(`${m.name} empezó a seguir tu vitrina`);
      });
      // El servidor cerró esta conexión por haber demasiadas de la misma cuenta: vuelve al reabrir la app
      src.addEventListener("bye", () => { if (es === src) close(); });
      src.addEventListener("error", () => {
        // Se cierra en el siguiente turno (la librería programa su propio reintento justo después de avisar)
        setTimeout(() => {
          if (es !== src || stopped) return;
          close();
          retry = setTimeout(connect, retryDelay(attempts++));
        }, 0);
      });
    };
    connect();
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active") {
        if (!awayAt) awayAt = Date.now();
        live.setVisible(false);
        close(); // en segundo plano no se gasta batería ni conexión
        return;
      }
      live.setVisible(true);
      const away = awayAt ? Date.now() - awayAt : 0;
      awayAt = 0;
      refreshChat();
      if (away > AWAY_MS) live.catchUp();
      if (!es) { attempts = 0; connect(); }
    });
    return () => { stopped = true; close(); live.stop(); sub.remove(); };
  }, [userId, ready, qc, utils, toast]);
  return null;
}
let currentPath = "/";

// Lleva a entrar y vuelve al mismo lugar después
export function requireLogin(back: string) {
  router.push({ pathname: "/entrar", params: { volver: back } });
}

// Corazón de favoritos con respuesta inmediata
export function useFavorites() {
  const utils = trpc.useUtils();
  const toast = useToast();
  const { me } = useSession();
  const path = usePathname();
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
      if (!me) { toast("Entra a tu cuenta para guardar favoritos"); requireLogin(path); return; }
      m.mutate({ listingId: id });
    },
  };
}
