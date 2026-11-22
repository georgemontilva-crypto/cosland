import { useLocation } from "wouter";
import { trpc } from "./trpc";
import { useToast } from "@/components/ui";

export function useMe() {
  const q = trpc.auth.me.useQuery(undefined, { staleTime: 30_000, refetchInterval: 60_000 });
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
