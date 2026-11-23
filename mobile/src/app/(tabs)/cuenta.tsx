import { useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Eye, FileText, Heart, LogOut, Megaphone, Pencil, Plus, Share2, Shield, ShieldCheck, ShoppingBag, Store, Trash2, UserX, Volume2, VolumeX, Wallet } from "lucide-react-native";
import { formatPrice, hasStock } from "@shared/catalog";
import { getFlag, setFlag, trpc } from "@/lib/api";
import { openWebPage, shareLink } from "@/lib/actions";
import { useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Awning, Avatar, Btn, Empty, H1, H2, Loading, Photo, Sheet, T, Tag, panel, soft, useToast } from "@/ui/core";
import { PAD } from "@/ui/cards";
import FollowersSheet from "@/ui/FollowersSheet";
import { SOUND_KEY, playWelcome } from "@/ui/Intro";

const STATUS: Record<string, { label: string; bg: string }> = {
  active: { label: "Publicado", bg: C.matcha }, paused: { label: "En pausa", bg: C.yuzu }, sold: { label: "Vendido", bg: C.fuji },
};

function Row({ icon, label, onPress, danger }: { icon: ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 }, pressed && { backgroundColor: C.oat }]}>
      {icon}
      <T w="bold" color={danger ? C.berry : C.ink} style={{ flex: 1 }}>{label}</T>
      <ChevronRight size={18} color={C.cocoa} />
    </Pressable>
  );
}

export default function Account() {
  const insets = useSafeAreaInsets();
  const { me, loading, signOut } = useSession();
  const toast = useToast();
  const utils = trpc.useUtils();
  const mine = trpc.listing.mine.useQuery(undefined, { enabled: Boolean(me?.shop) });
  const pays = trpc.shop.payments.useQuery(undefined, { enabled: Boolean(me?.shop) });
  const [removing, setRemoving] = useState<null | { id: number; title: string }>(null);
  const [followers, setFollowers] = useState(false);
  const sellOne = trpc.listing.sellOne.useMutation({
    onSuccess: (r) => { utils.listing.invalidate(); utils.shop.invalidate(); toast(r.sold ? "Marcada como vendida" : `Anotado. Te quedan ${r.stock}.`); },
  });
  // La voz que acompaña al logo al abrir la app
  const [sound, setSound] = useState(() => getFlag(SOUND_KEY) !== "0");
  const toggleSound = () => { const next = !sound; setSound(next); setFlag(SOUND_KEY, next ? "1" : "0"); if (next) playWelcome(); };
  const setStatus = trpc.listing.setStatus.useMutation({ onSuccess: () => { utils.listing.invalidate(); utils.shop.invalidate(); setRemoving(null); toast("Publicación actualizada"); } });
  const items = mine.data ?? [];
  const shop = me?.shop;

  return (
    <View style={{ flex: 1, backgroundColor: C.cream, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 40, gap: 18 }}
        refreshControl={<RefreshControl refreshing={mine.isRefetching} onRefresh={() => { mine.refetch(); utils.auth.me.invalidate(); }} tintColor={C.ink} colors={[C.ink]} />}>
        {loading ? <Loading /> : !me ? (
          <>
            <H1>Tu vitrina te espera</H1>
            <View style={panel}>
              <Awning accent="sakura" size={30} />
              <View style={{ padding: 20, gap: 12 }}>
                <T size={16}>Entra para guardar favoritos, escribirle a los vendedores y abrir tu propia vitrina.</T>
                <Btn label="Crear mi cuenta" kind="ink" onPress={() => router.push({ pathname: "/registro", params: { volver: "/cuenta" } })} />
                <Btn label="Ya tengo cuenta" onPress={() => router.push({ pathname: "/entrar", params: { volver: "/cuenta" } })} />
              </View>
            </View>
          </>
        ) : !shop ? (
          <>
            <H1>Hola, {me.name.split(" ")[0]}</H1>
            <View style={panel}>
              <Awning accent="matcha" size={30} />
              <View style={{ padding: 20, gap: 12 }}>
                <T w="black" size={21}>Abre tu vitrina</T>
                <T size={16} color={C.cocoa}>Elige un nombre y el color de tu toldo. Después publicas lo que quieras vender o el servicio que ofreces.</T>
                <Btn label="Abrir mi vitrina" kind="ink" icon={<Store size={18} color={C.cream} />} onPress={() => router.push("/vitrina-editar")} />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={panel}>
              <Awning accent={shop.accent} size={32} />
              <View style={{ padding: 18, gap: 14 }}>
                <Pressable accessibilityRole="link" accessibilityLabel="Ver mi vitrina como la ve el público" onPress={() => router.push(`/v/${shop.handle}`)} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Avatar src={shop.avatarUrl} name={shop.name} accent={shop.accent} size={66} />
                  <View style={{ flex: 1 }}>
                    <T w="black" size={22} numberOfLines={1}>{shop.name}</T>
                    <T size={13.5} color={C.cocoa} style={{ textDecorationLine: "underline" }}>Ver mi vitrina como la ve el público</T>
                  </View>
                </Pressable>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Btn label="Publicar" kind="ink" icon={<Plus size={18} color={C.cream} strokeWidth={2.6} />} onPress={() => router.push("/publicar")} />
                  <Btn label="Compartir" icon={<Share2 size={17} color={C.ink} />} onPress={() => shareLink(shop.name, `/v/${shop.handle}`, toast)} />
                  <Btn label="Editar" icon={<Pencil size={16} color={C.ink} />} onPress={() => router.push("/vitrina-editar")} />
                </View>
              </View>
              <View style={{ flexDirection: "row", borderTopWidth: BORDER, borderTopColor: C.ink }}>
                {[["Publicadas", items.filter((l) => l.status === "active").length], ["Vendidas", items.filter((l) => l.status === "sold").length], ["Visitas", items.reduce((a, l) => a + l.views, 0)]].map(([k, v]) => (
                  <View key={k} style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRightWidth: BORDER, borderRightColor: C.ink }}>
                    <T w="black" size={22}>{v}</T><T size={12.5} color={C.cocoa}>{k}</T>
                  </View>
                ))}
                <Pressable accessibilityRole="button" accessibilityLabel={`${shop.followers} seguidores, ver quiénes son`} onPress={() => setFollowers(true)}
                  style={({ pressed }) => [{ flex: 1, alignItems: "center", paddingVertical: 14 }, pressed && { backgroundColor: C.oat }]}>
                  <T w="black" size={22}>{shop.followers}</T><T size={12.5} color={C.cocoa} style={{ textDecorationLine: "underline" }}>Seguidores</T>
                </Pressable>
              </View>
            </View>

            <H2 style={{ marginTop: 8 }}>Mis publicaciones</H2>
            {mine.isLoading ? <Loading /> : !items.length ? (
              <Empty title="Tu vitrina está lista para su primer artículo" text="Un cosplay que ya no usas, una peluca, una figura o el servicio que ofreces." action={<Btn label="Publicar ahora" kind="sakura" onPress={() => router.push("/publicar")} />} />
            ) : (
              <View style={{ gap: 10 }}>
                {items.map((l) => (
                  <View key={l.id} style={[soft, { padding: 12, flexDirection: "row", gap: 12 }]}>
                    <Pressable accessibilityRole="link" accessibilityLabel={l.title} onPress={() => router.push(`/p/${l.id}`)} style={{ width: 78, height: 78, borderRadius: 18, overflow: "hidden", borderWidth: BORDER, borderColor: C.ink }}>
                      <Photo src={l.images[0]} accent={shop.accent} />
                    </Pressable>
                    <View style={{ flex: 1, gap: 5 }}>
                      <T w="black" numberOfLines={1}>{l.title}</T>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <T w="bold" size={14}>{formatPrice(l.priceCents, l.deal)}</T>
                        <Tag label={STATUS[l.status]?.label ?? l.status} bg={STATUS[l.status]?.bg} />
                        {hasStock(l.kind, l.deal) && l.status === "active" && l.stock > 1 ? <T w="bold" size={13}>Quedan {l.stock}</T> : null}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Eye size={13} color={C.cocoa} /><T size={13} color={C.cocoa}>{l.views}</T></View>
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                        <Btn small label="Editar" onPress={() => router.push(`/editar/${l.id}`)} />
                        {l.status === "active" && <Btn small kind="matcha" label={hasStock(l.kind, l.deal) && l.stock > 1 ? "Vendí una" : "Vendido"} disabled={sellOne.isPending} onPress={() => sellOne.mutate({ id: l.id })} />}
                        {l.status === "active" && <Btn small label="Pausar" onPress={() => setStatus.mutate({ id: l.id, status: "paused" })} />}
                        {l.status !== "active" && <Btn small label="Volver a publicar" onPress={() => setStatus.mutate({ id: l.id, status: "active" })} />}
                        <Btn small kind="ghost" label="Eliminar" icon={<Trash2 size={15} color={C.berry} />} onPress={() => setRemoving({ id: l.id, title: l.title })} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={[soft, { overflow: "hidden", marginTop: 6 }]}>
          {me && <Row icon={<ShoppingBag size={19} color={C.ink} />} label={me.orders ? `Pedidos (${me.orders} por atender)` : "Pedidos"} onPress={() => router.push("/pedidos")} />}
          {shop && <Row icon={<Wallet size={19} color={C.ink} />} label={pays.data && !pays.data.methods.length ? "Agrega cómo te pagan" : "Cómo te pagan"} onPress={() => router.push("/cobros")} />}
          {me && <Row icon={<Heart size={19} color={C.ink} />} label="Favoritos" onPress={() => router.push("/favoritos")} />}
          <Row icon={<Megaphone size={19} color={C.ink} />} label="Se busca" onPress={() => router.push("/se-busca")} />
          <Row icon={<Store size={19} color={C.ink} />} label="Vitrinas" onPress={() => router.push("/vitrinas")} />
          <Row icon={<ShieldCheck size={19} color={C.ink} />} label="Consejos de compra segura" onPress={() => router.push("/compra-segura")} />
          <Row icon={sound ? <Volume2 size={19} color={C.ink} /> : <VolumeX size={19} color={C.ink} />} label={`Sonido de bienvenida: ${sound ? "activado" : "apagado"}`} onPress={toggleSound} />
          {me?.role === "admin" && <Row icon={<Shield size={19} color={C.ink} />} label="Administración (en la web)" onPress={() => openWebPage("/admin")} />}
          <Row icon={<FileText size={19} color={C.ink} />} label="Términos de uso" onPress={() => openWebPage("/terminos")} />
          <Row icon={<FileText size={19} color={C.ink} />} label="Política de privacidad" onPress={() => openWebPage("/privacidad")} />
          {me && <Row icon={<UserX size={19} color={C.berry} />} label="Eliminar mi cuenta" danger onPress={() => router.push("/eliminar-cuenta")} />}
          {me && <Row icon={<LogOut size={19} color={C.ink} />} label="Salir" onPress={async () => { await signOut(); toast("Sesión cerrada"); }} />}
        </View>
        {me && <T size={13} color={C.cocoa} center>{me.email}</T>}
      </ScrollView>

      {shop && <FollowersSheet open={followers} onClose={() => setFollowers(false)} shopId={shop.id} mine />}
      <Sheet open={Boolean(removing)} onClose={() => setRemoving(null)} title="Eliminar publicación">
        <View style={{ gap: 16 }}>
          <T size={16}>Vas a eliminar “{removing?.title}”. No se puede deshacer.</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label="Cancelar" grow onPress={() => setRemoving(null)} />
            <Btn label="Eliminar" kind="danger" grow busy={setStatus.isPending} onPress={() => removing && setStatus.mutate({ id: removing.id, status: "removed" })} />
          </View>
        </View>
      </Sheet>
    </View>
  );
}
