import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, SlidersHorizontal } from "lucide-react-native";
import { CATEGORIES, CONDITIONS, DEALS, SIZES } from "@shared/catalog";
import { trpc } from "@/lib/api";
import { C } from "@/lib/theme";
import { Btn, Check2, Chip, Empty, Field, H1, Input, Loading, Select, Sheet, T } from "@/ui/core";
import { ListingCard, PAD, useCardWidth } from "@/ui/cards";

type Filters = { q: string; kind: string; category: string; deal: string; condition: string; size: string; min: string; max: string; city: string; trade: boolean; sort: string };
const EMPTY: Filters = { q: "", kind: "", category: "", deal: "", condition: "", size: "", min: "", max: "", city: "", trade: false, sort: "recientes" };
const opt = (items: readonly { id: string; label: string }[], all: string) => [{ value: "", label: all }, ...items.map((i) => ({ value: i.id, label: i.label }))];
const num = (v: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

export default function Explore() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; kind?: string; category?: string }>();
  const [f, setF] = useState<Filters>({ ...EMPTY, q: params.q ?? "", kind: params.kind ?? "", category: params.category ?? "" });
  const [text, setText] = useState(f.q);
  const [open, setOpen] = useState(false);
  const w = useCardWidth();

  // Llegar desde Inicio con otra búsqueda o categoría reinicia los filtros
  useEffect(() => {
    if (params.q === undefined && params.kind === undefined && params.category === undefined) return;
    setF({ ...EMPTY, q: params.q ?? "", kind: params.kind ?? "", category: params.category ?? "" });
    setText(params.q ?? "");
  }, [params.q, params.kind, params.category]);

  const set = (patch: Partial<Filters>) => setF((p) => ({ ...p, ...patch }));
  const res = trpc.listing.search.useInfiniteQuery({
    q: f.q || undefined, category: f.category || undefined, kind: (f.kind || undefined) as "product" | "service" | undefined,
    deal: (f.deal || undefined) as never, condition: (f.condition || undefined) as never, size: f.size || undefined,
    min: num(f.min), max: num(f.max), city: f.city.trim() || undefined, trade: f.trade || undefined, sort: f.sort as never,
  }, { getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined), initialCursor: 1 });

  const items = res.data?.pages.flatMap((p) => p.items) ?? [];
  const total = res.data?.pages[0]?.total ?? 0;
  const active = [f.category, f.deal, f.condition, f.size, f.min, f.max, f.city, f.trade ? "1" : ""].filter(Boolean).length;
  const cats = CATEGORIES.filter((c) => !f.kind || c.kind === f.kind);
  const clear = () => { setF({ ...EMPTY, q: f.q, kind: f.kind, sort: f.sort }); };

  return (
    <View style={{ flex: 1, backgroundColor: C.cream, paddingTop: insets.top }}>
      <FlatList
        data={items} keyExtractor={(it) => String(it.id)} numColumns={2}
        columnWrapperStyle={{ gap: 14, paddingHorizontal: PAD }} contentContainerStyle={{ paddingBottom: 40, rowGap: 24 }}
        keyboardShouldPersistTaps="handled" onEndReachedThreshold={0.6}
        onEndReached={() => { if (res.hasNextPage && !res.isFetchingNextPage) res.fetchNextPage(); }}
        refreshing={res.isRefetching && !res.isFetchingNextPage} onRefresh={() => { res.refetch(); }}
        renderItem={({ item }) => <ListingCard item={item} width={w} />}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: PAD, paddingTop: 14, gap: 14 }}>
            <H1>{f.q ? `Resultados para “${f.q}”` : "Explorar"}</H1>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Input value={text} onChangeText={setText} placeholder="Personaje, serie o artículo" returnKeyType="search" onSubmitEditing={() => set({ q: text.trim() })} accessibilityLabel="Buscar" style={{ borderRadius: 999, paddingLeft: 44 }} />
                <View pointerEvents="none" style={{ position: "absolute", left: 16 }}><Search size={18} color={C.cocoa} /></View>
              </View>
              <Btn label="Buscar" kind="ink" onPress={() => set({ q: text.trim() })} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip label="Todo" on={!f.kind} onPress={() => set({ kind: "", category: "" })} />
              <Chip label="Artículos" on={f.kind === "product"} onPress={() => set({ kind: "product", category: "" })} />
              <Chip label="Servicios" on={f.kind === "service"} onPress={() => set({ kind: "service", category: "" })} />
              <Chip label={active ? `Filtros (${active})` : "Filtros"} onPress={() => setOpen(true)} icon={<SlidersHorizontal size={15} color={C.ink} />} />
            </View>
            {!res.isLoading && items.length > 0 && <T color={C.cocoa}>{total} {total === 1 ? "publicación" : "publicaciones"}</T>}
          </View>
        }
        ListEmptyComponent={res.isLoading ? <Loading label="Buscando" /> : (
          <View style={{ paddingHorizontal: PAD }}>
            <Empty title="Nada por aquí todavía" text="Prueba con menos filtros o con otra palabra. También puedes dejar un pedido en “Se busca”."
              action={<Btn label="Publicar lo que busco" kind="yuzu" onPress={() => router.push({ pathname: "/se-busca", params: { nuevo: "1" } })} />} />
          </View>
        )}
        ListFooterComponent={res.isFetchingNextPage ? <Loading label="Cargando más" /> : undefined}
      />

      <Sheet open={open} onClose={() => setOpen(false)} title="Filtros">
        <View style={{ gap: 16 }}>
          <Field label="Ordenar"><Select title="Ordenar" value={f.sort} onChange={(v) => set({ sort: v })} options={[{ value: "recientes", label: "Más recientes" }, { value: "precio_asc", label: "Precio: menor a mayor" }, { value: "precio_desc", label: "Precio: mayor a menor" }]} /></Field>
          <Field label="Categoría"><Select title="Categoría" value={f.category} onChange={(v) => set({ category: v })} options={opt(cats, "Todas")} /></Field>
          <Field label="Modalidad"><Select title="Modalidad" value={f.deal} onChange={(v) => set({ deal: v })} options={opt(DEALS, "Cualquiera")} /></Field>
          {f.kind !== "service" && (
            <>
              <Field label="Condición"><Select title="Condición" value={f.condition} onChange={(v) => set({ condition: v })} options={opt(CONDITIONS, "Cualquiera")} /></Field>
              <Field label="Talla"><Select title="Talla" value={f.size} onChange={(v) => set({ size: v })} options={[{ value: "", label: "Cualquiera" }, ...SIZES.map((s) => ({ value: s, label: s }))]} /></Field>
            </>
          )}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><Field label="Desde $"><Input keyboardType="decimal-pad" placeholder="0" value={f.min} onChangeText={(v) => set({ min: v.replace(/[^\d.]/g, "") })} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Hasta $"><Input keyboardType="decimal-pad" placeholder="Sin tope" value={f.max} onChangeText={(v) => set({ max: v.replace(/[^\d.]/g, "") })} /></Field></View>
          </View>
          <Field label="Ciudad"><Input placeholder="Maracaibo, Bogotá…" value={f.city} onChangeText={(v) => set({ city: v })} /></Field>
          <Check2 value={f.trade} onChange={(v) => set({ trade: v })} label="Solo los que aceptan cambio" />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Btn label="Quitar filtros" grow onPress={() => { clear(); setOpen(false); }} />
            <Btn label="Ver resultados" kind="ink" grow onPress={() => setOpen(false)} />
          </View>
        </View>
      </Sheet>
    </View>
  );
}
