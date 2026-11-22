import { router } from "expo-router";
import { trpc } from "@/lib/api";
import { requireLogin, useSession } from "@/lib/session";
import { Btn, Empty, Loading, Screen } from "@/ui/core";
import { Grid } from "@/ui/cards";

export default function Favorites() {
  const { me, loading } = useSession();
  const q = trpc.listing.favorites.useQuery(undefined, { enabled: Boolean(me) });
  return (
    <Screen title="Favoritos">
      {loading || (me && q.isLoading) ? <Loading /> : !me ? (
        <Empty title="Entra para ver tus favoritos" action={<Btn label="Entrar" kind="ink" onPress={() => requireLogin("/favoritos")} />} />
      ) : q.data?.length ? <Grid items={q.data} /> : (
        <Empty title="Aún no guardas nada" text="Toca el corazón en cualquier publicación para guardarla aquí." action={<Btn label="Explorar" kind="ink" onPress={() => router.replace("/explorar")} />} />
      )}
    </Screen>
  );
}
