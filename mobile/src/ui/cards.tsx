import { Pressable, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { BadgeCheck, Heart, MapPin, Repeat2, Sparkles, Store } from "lucide-react-native";
import { conditionLabel, dealLabel, formatPrice, shopKindLabel } from "@shared/catalog";
import type { Card, ShopSummary } from "@/lib/api";
import { useFavorites } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Awning, Avatar, Photo, Stars, T, Tag, panel } from "./core";

export const PAD = 18;

// Vitrina que apoyó a Cosland y por eso sale primero. Se marca siempre, para que quien compra sepa por qué está arriba.
export const FeaturedTag = () => <Tag label="Destacada" bg={C.yuzu} icon={<Sparkles size={12} color={C.ink} strokeWidth={2.4} />} />;
const GAP = 14;
// Ancho de cada tarjeta en la cuadrícula de dos columnas
export function useCardWidth() {
  const { width } = useWindowDimensions();
  return (Math.min(width, 620) - PAD * 2 - GAP) / 2;
}

export function ListingCard({ item, width }: { item: Card; width: number }) {
  const fav = useFavorites();
  const on = fav.has(item.id);
  const badge = item.kind === "service" ? "Servicio" : item.deal !== "venta" ? dealLabel(item.deal) : conditionLabel(item.condition);
  return (
    <View style={{ width }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${item.title}, ${formatPrice(item.priceCents, item.deal)}`} onPress={() => router.push(`/p/${item.id}`)} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <View style={{ width, height: width, borderRadius: 24, overflow: "hidden", borderWidth: BORDER, borderColor: C.ink, backgroundColor: C.oat }}>
          <Photo src={item.images[0]} accent={item.shopAccent} />
          {item.shopFeatured > 0 && <View style={{ position: "absolute", left: 8, top: 8 }}><FeaturedTag /></View>}
          {item.status === "sold" && (
            <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(251,241,220,0.78)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ transform: [{ rotate: "-6deg" }] }}><Tag label="Vendido" /></View>
            </View>
          )}
          <View style={{ position: "absolute", left: 8, right: 8, bottom: 8, flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
            {badge ? <Tag label={badge} /> : null}
            {item.acceptsTrade && <Tag label="Acepta cambio" bg={C.matcha} icon={<Repeat2 size={12} color={C.ink} strokeWidth={2.5} />} />}
          </View>
        </View>
        <View style={{ paddingTop: 9, paddingHorizontal: 3 }}>
          <T w="black" size={17.5}>{formatPrice(item.priceCents, item.deal)}</T>
          <T w="bold" size={14.5} numberOfLines={2} style={{ marginTop: 1 }}>{item.title}</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
            <T size={13} color={C.cocoa} numberOfLines={1} style={{ flexShrink: 1 }}>{item.shopName}{item.shopCity ? ` en ${item.shopCity}` : ""}</T>
            {item.shopVerified && <BadgeCheck size={14} color={C.ink} />}
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={on ? "Quitar de favoritos" : "Guardar en favoritos"} onPress={() => fav.toggle(item.id)} hitSlop={6}
        style={({ pressed }) => [{ position: "absolute", top: 8, right: 8, width: 40, height: 40, borderRadius: 20, borderWidth: BORDER, borderColor: C.ink, backgroundColor: on ? C.sakura : C.paper, alignItems: "center", justifyContent: "center" }, pressed && { transform: [{ scale: 0.9 }] }]}>
        <Heart size={18} strokeWidth={2.2} color={on ? C.berry : C.ink} fill={on ? C.berry : "transparent"} />
      </Pressable>
    </View>
  );
}

export function Grid({ items }: { items: Card[] }) {
  const w = useCardWidth();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: GAP, rowGap: 24 }}>{items.map((it) => <ListingCard key={it.id} item={it} width={w} />)}</View>;
}

/* Tarjeta de vitrina: una fachada con su toldo */
export function ShopCard({ shop }: { shop: Pick<ShopSummary, "handle" | "name" | "kind" | "avatarUrl" | "accent" | "city" | "verified" | "hasStore" | "listingCount" | "rating" | "reviewCount"> & { sales?: number; featured?: number } }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Vitrina ${shop.name}`} onPress={() => router.push(`/v/${shop.handle}`)} style={({ pressed }) => [panel, pressed && { opacity: 0.85 }]}>
      <Awning accent={shop.accent} size={28} />
      {(shop.featured ?? 0) > 0 && <View style={{ position: "absolute", right: 10, top: 10 }}><FeaturedTag /></View>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingTop: 10 }}>
        <Avatar src={shop.avatarUrl} name={shop.name} accent={shop.accent} size={56} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <T w="black" size={16.5} numberOfLines={1} style={{ flexShrink: 1 }}>{shop.name}</T>
            {shop.verified && <BadgeCheck size={16} color={C.ink} />}
          </View>
          <T size={13.5} color={C.cocoa} numberOfLines={1}>{shopKindLabel(shop.kind)}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, marginTop: 3 }}>
            {shop.city ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><MapPin size={13} color={C.cocoa} /><T size={13} color={C.cocoa}>{shop.city}</T></View> : null}
            {shop.hasStore && <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Store size={13} color={C.cocoa} /><T size={13} color={C.cocoa}>Tienda física</T></View>}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2, marginTop: 3 }}>
            {shop.reviewCount > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Stars value={shop.rating} size={13} /><T size={13} color={C.cocoa}>({shop.reviewCount})</T></View>}
            {(shop.sales ?? 0) > 0 ? <T size={13} w="bold">{shop.sales} {shop.sales === 1 ? "venta" : "ventas"}</T> : null}
            <T size={13} color={C.cocoa}>{shop.listingCount} {shop.listingCount === 1 ? "publicación" : "publicaciones"}</T>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
