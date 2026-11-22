import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Gem, Heart, Palette, Scissors, Search, Shirt, Store } from "lucide-react-native";
import { CATEGORIES, categoryOf, formatPrice } from "@shared/catalog";
import { timeAgo, trpc } from "@/lib/api";
import { BORDER, C, NOTE, accentHex } from "@/lib/theme";
import { Awning, Btn, H2, IconBtn, Input, Loading, Logo, T, panel } from "@/ui/core";
import { Grid, PAD, ShopCard } from "@/ui/cards";

const STREET = [
  { kind: "cosplayer", title: "Cosplayers", text: "Cosplays, pelucas y props", accent: "sakura", Icon: Shirt },
  { kind: "taller", title: "Talleres", text: "Costura y props por encargo", accent: "matcha", Icon: Scissors },
  { kind: "tienda", title: "Tiendas", text: "Figuras, manga y merch", accent: "ramune", Icon: Store },
  { kind: "artista", title: "Artistas", text: "Prints, stickers y fanart", accent: "fuji", Icon: Palette },
  { kind: "fotografo", title: "Fotógrafos", text: "Sesiones y video", accent: "yuzu", Icon: Camera },
  { kind: "coleccionista", title: "Coleccionistas", text: "Piezas raras y cartas", accent: "momo", Icon: Gem },
] as const;

function Head({ title, link, onPress }: { title: string; link?: string; onPress?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
      <H2 style={{ flex: 1 }}>{title}</H2>
      {link ? <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}><T w="bold" size={14} style={{ textDecorationLine: "underline" }}>{link}</T></Pressable> : null}
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const home = trpc.listing.home.useQuery();
  const search = () => router.push({ pathname: "/explorar", params: q.trim() ? { q: q.trim() } : {} });

  return (
    <View style={{ flex: 1, backgroundColor: C.cream, paddingTop: insets.top }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PAD - 4 }}>
        <Logo width={148} />
        <IconBtn label="Favoritos" onPress={() => router.push("/favoritos")}><Heart size={23} color={C.ink} strokeWidth={2} /></IconBtn>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => { home.refetch(); }} tintColor={C.ink} colors={[C.ink]} />}>
        <View style={{ paddingHorizontal: PAD, paddingTop: 14 }}>
          <T w="black" size={33} style={{ lineHeight: 37 }}>Vende el cosplay que ya no usas. Encuentra el que te falta.</T>
          <T size={16.5} color={C.cocoa} style={{ marginTop: 12 }}>Cosplays, pelucas, figuras, manga y quien te cose el próximo traje. Cada vendedor tiene su vitrina.</T>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Input value={q} onChangeText={setQ} placeholder="Nezuko talla M, peluca rubia" returnKeyType="search" onSubmitEditing={search} accessibilityLabel="¿Qué buscas?"
                style={{ borderRadius: 999, paddingLeft: 44, borderColor: C.ink, minHeight: 52 }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 16 }}><Search size={19} color={C.cocoa} /></View>
            </View>
            <Btn label="Buscar" kind="ink" onPress={search} style={{ minHeight: 52 }} />
          </View>
        </View>

        {/* La calle: una fachada por cada tipo de vitrina */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, gap: 12, paddingTop: 26 }}>
          {STREET.map(({ kind, title, text, accent, Icon }) => (
            <Pressable key={kind} accessibilityRole="link" accessibilityLabel={`${title}: ${text}`} onPress={() => router.push({ pathname: "/vitrinas", params: { kind } })} style={({ pressed }) => [{ width: 150 }, pressed && { opacity: 0.8 }]}>
              <View style={{ backgroundColor: C.paper, borderWidth: BORDER, borderBottomWidth: 0, borderColor: C.ink, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" }}>
                <Awning accent={accent} size={28} />
                <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
                  <View style={{ height: 132, borderTopLeftRadius: 999, borderTopRightRadius: 999, borderWidth: BORDER, borderBottomWidth: 0, borderColor: C.ink, backgroundColor: accentHex(accent), alignItems: "center", justifyContent: "center" }}>
                    <Icon size={36} color={C.ink} strokeWidth={1.7} />
                  </View>
                </View>
              </View>
              <View style={{ borderTopWidth: BORDER, borderTopColor: C.ink, paddingTop: 9, paddingHorizontal: 3 }}>
                <T w="black" size={15.5}>{title}</T>
                <T size={13} color={C.cocoa} style={{ lineHeight: 17 }}>{text}</T>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, gap: 8, paddingTop: 28 }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={c.label} onPress={() => router.push({ pathname: "/explorar", params: { category: c.id } })}
              style={({ pressed }) => [{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: BORDER, borderColor: C.line, backgroundColor: C.paper }, pressed && { opacity: 0.7 }]}>
              <T w="bold" size={14}>{c.short}</T>
              <T w="bold" size={10.5} color={C.cocoa} style={{ letterSpacing: 1.2, lineHeight: 14 }}>{c.jp}</T>
            </Pressable>
          ))}
        </ScrollView>

        {home.isLoading ? <Loading /> : home.error ? (
          <View style={{ padding: PAD, paddingTop: 30 }}>
            <View style={[panel, { padding: 22, alignItems: "center", gap: 12 }]}>
              <T w="black" size={18} center>No pudimos cargar la tienda</T>
              <T color={C.cocoa} center>Revisa tu conexión e inténtalo de nuevo.</T>
              <Btn label="Reintentar" kind="ink" onPress={() => home.refetch()} />
            </View>
          </View>
        ) : home.data && (
          <>
            <View style={{ paddingHorizontal: PAD, marginTop: 36 }}>
              <Head title="Recién publicado" link="Ver todo" onPress={() => router.push({ pathname: "/explorar", params: { kind: "product" } })} />
              {home.data.recent.length ? <Grid items={home.data.recent} /> : (
                <View style={{ backgroundColor: C.paper, borderRadius: 26, padding: 24, alignItems: "center" }}>
                  <T w="bold" size={17} center>Las vitrinas están por abrir.</T>
                  <T color={C.cocoa} center style={{ marginTop: 4, marginBottom: 16 }}>Sé de las primeras personas en publicar.</T>
                  <Btn label="Publicar un artículo" kind="sakura" onPress={() => router.push("/publicar")} />
                </View>
              )}
            </View>

            {home.data.services.length > 0 && (
              <View style={{ marginTop: 40, marginHorizontal: 8, paddingVertical: 28, paddingHorizontal: PAD - 8, borderRadius: 36, backgroundColor: "rgba(243,230,203,0.75)" }}>
                <Head title="Manos que cosen, peinan y fotografían" link="Ver servicios" onPress={() => router.push({ pathname: "/explorar", params: { kind: "service" } })} />
                <Grid items={home.data.services} />
              </View>
            )}

            <View style={{ paddingHorizontal: PAD, marginTop: 40 }}>
              <Head title="Se busca" link="Ver pedidos" onPress={() => router.push("/se-busca")} />
              <T color={C.cocoa} style={{ marginTop: -8, marginBottom: 14 }}>¿No encuentras algo? Publica lo que buscas y deja que los vendedores te escriban.</T>
              <View style={{ gap: 12 }}>
                {home.data.wanted.map((w, i) => (
                  <Pressable key={w.id} accessibilityRole="link" onPress={() => router.push("/se-busca")} style={({ pressed }) => [{ borderRadius: 26, borderWidth: BORDER, borderColor: C.ink, padding: 18, backgroundColor: NOTE[i % 3] }, pressed && { opacity: 0.85 }]}>
                    <T w="bold" size={13}>{categoryOf(w.category)?.short}, {timeAgo(w.createdAt)}</T>
                    <T w="black" size={18} style={{ marginTop: 4 }}>{w.title}</T>
                    <T w="bold" size={13.5} style={{ marginTop: 6 }}>{w.budgetCents != null ? `Presupuesto: ${formatPrice(w.budgetCents)}` : "Presupuesto abierto"}{w.city ? `, en ${w.city}` : ""}</T>
                  </Pressable>
                ))}
                <Btn label="Publicar lo que busco" onPress={() => router.push({ pathname: "/se-busca", params: { nuevo: "1" } })} />
              </View>
            </View>

            {home.data.shops.length > 0 && (
              <View style={{ paddingHorizontal: PAD, marginTop: 40 }}>
                <Head title="Vitrinas para visitar" link="Ver todas" onPress={() => router.push("/vitrinas")} />
                <View style={{ gap: 12 }}>{home.data.shops.slice(0, 5).map((s) => <ShopCard key={s.id} shop={s} />)}</View>
              </View>
            )}
          </>
        )}

        <View style={{ paddingHorizontal: PAD, marginTop: 40 }}>
          <View style={panel}>
            <Awning accent="sakura" size={32} />
            <View style={{ padding: 22 }}>
              <T w="black" size={26} style={{ lineHeight: 30 }}>Abre tu vitrina en tres pasos</T>
              <T color={C.cocoa} style={{ marginTop: 8 }}>Publicar es gratis. Tú pones el precio y acuerdas la entrega con quien compra.</T>
              <View style={{ gap: 10, marginTop: 18 }}>
                {[["Crea tu vitrina", "Elige nombre, foto y el color de tu toldo."], ["Publica con fotos", "Talla, medidas, personaje y precio."], ["Acuerda la venta", "Te escriben por el chat o por WhatsApp."]].map(([t, d], i) => (
                  <View key={t} style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: C.cream, borderRadius: 22, padding: 14 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: BORDER, borderColor: C.ink, backgroundColor: [C.matcha, C.ramune, C.fuji][i], alignItems: "center", justifyContent: "center" }}><T w="black">{i + 1}</T></View>
                    <View style={{ flex: 1 }}><T w="black" size={15.5}>{t}</T><T size={13.5} color={C.cocoa}>{d}</T></View>
                  </View>
                ))}
              </View>
              <Btn label="Abrir mi vitrina" kind="ink" onPress={() => router.push("/cuenta")} style={{ marginTop: 18 }} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
