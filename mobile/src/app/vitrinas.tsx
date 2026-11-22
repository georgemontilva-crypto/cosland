import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Store } from "lucide-react-native";
import { SHOP_KINDS } from "@shared/catalog";
import { trpc } from "@/lib/api";
import { C } from "@/lib/theme";
import { Btn, Chip, Empty, Input, Loading, Screen, T } from "@/ui/core";
import { PAD, ShopCard } from "@/ui/cards";

export default function Shops() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState(params.kind ?? "");
  const [store, setStore] = useState(false);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const res = trpc.shop.list.useQuery({ q: dq || undefined, kind: (kind || undefined) as never, store: store || undefined });
  return (
    <Screen title="Vitrinas" pad={false}>
      <View style={{ paddingHorizontal: PAD, paddingTop: 16, gap: 12 }}>
        <T color={C.cocoa}>Cosplayers, talleres, tiendas y artistas de la comunidad.</T>
        <Input value={q} onChangeText={setQ} placeholder="Busca por nombre o ciudad" accessibilityLabel="Buscar vitrinas" style={{ borderRadius: 999 }} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, gap: 8, paddingVertical: 14 }}>
        <Chip label="Todas" on={!kind} onPress={() => setKind("")} />
        {SHOP_KINDS.map((k) => <Chip key={k.id} label={k.plural} on={kind === k.id} onPress={() => setKind(k.id)} />)}
        <Chip label="Con tienda física" on={store} onPress={() => setStore((v) => !v)} icon={<Store size={15} color={store ? C.cream : C.ink} />} />
      </ScrollView>
      <View style={{ paddingHorizontal: PAD, gap: 12 }}>
        {res.isLoading ? <Loading /> : res.data?.length ? res.data.map((s) => <ShopCard key={s.id} shop={s} />)
          : <Empty title="Aún no hay vitrinas aquí" text="Abre la primera de este tipo." action={<Btn label="Abrir mi vitrina" kind="ink" onPress={() => router.push("/cuenta")} />} />}
      </View>
    </Screen>
  );
}
