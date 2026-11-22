import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { router, usePathname } from "expo-router";
import EventSource from "react-native-sse";
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
      <Realtime userId={q.data?.id ?? null} />
      {children}
    </Ctx.Provider>
  );
}

// Chat en vivo: una conexión abierta con el servidor que avisa apenas llega un mensaje
function Realtime({ userId }: { userId: number | null }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const path = usePathname();
  useEffect(() => { currentPath = path; }, [path]);

  useEffect(() => {
    if (!userId || !getToken()) return;
    const refresh = (id?: number) => {
      utils.chat.list.invalidate();
      utils.auth.me.invalidate();
      if (id) utils.chat.thread.invalidate({ id }); else utils.chat.thread.invalidate();
    };
    const es = new EventSource<"chat">(`${API}/api/events`, { headers: authHeaders(), pollingInterval: 4000, timeout: 0 });
    let first = true;
    es.addEventListener("open", () => { if (!first) refresh(); first = false; });
    es.addEventListener("chat", (e) => {
      if (!e.data) return;
      const m = JSON.parse(e.data) as { conversationId: number; from: number; fromName: string };
      refresh(m.conversationId);
      if (m.from !== userId && currentPath !== `/mensajes/${m.conversationId}`) toast(`Nuevo mensaje de ${m.fromName}`);
    });
    // Al volver a la app se pone al día por si la conexión estuvo en pausa
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") refresh(); });
    return () => { es.removeAllEventListeners(); es.close(); sub.remove(); };
  }, [userId, utils, toast]);
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
