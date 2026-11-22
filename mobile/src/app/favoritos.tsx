import { router } from "expo-router";
import { trpc } from "@/lib/api";
import { requireLogin, useSession } from "@/lib/session";
import { View } from "react-native";
import { Btn, Empty, H2, Loading, Screen } from "@/ui/core";
import { Grid, ShopCard } from "@/ui/cards";

export default function Favorites() {
  const { me, loading } = useSession();
  const q = trpc.listing.favorites.useQuery(undefined, { enabled: Boolean(me) });
  const following = trpc.shop.following.useQuery(undefined, { enabled: Boolean(me) });
  return (
    <Screen title="Favoritos">
      {loading || (me && q.isLoading) ? <Loading /> : !me ? (
        <Empty title="Entra para ver tus favoritos" action={<Btn label="Entrar" kind="ink" onPress={() => requireLogin("/favoritos")} />} />
      ) : q.data?.length ? <Grid items={q.data} /> : (
        <Empty title="Aún no guardas nada" text="Toca el corazón en cualquier publicación para guardarla aquí." action={<Btn label="Explorar" kind="ink" onPress={() => router.replace("/explorar")} />} />
      )}
      {me && (following.data?.length ?? 0) > 0 && (
        <View style={{ marginTop: 34, gap: 12 }}>
          <H2>Vitrinas que sigues</H2>
          {following.data!.map((s) => <ShopCard key={s.id} shop={s} />)}
        </View>
      )}
    </Screen>
  );
}
