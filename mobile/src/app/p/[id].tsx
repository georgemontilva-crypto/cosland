import { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, BadgeCheck, Eye, Flag, Heart, MapPin, MessageCircle, Pencil, Repeat2, Share2, ShieldCheck, Phone, ShoppingBag, Wallet } from "lucide-react-native";
import { REPORT_REASONS, categoryOf, conditionLabel, dealLabel, deliveryLabel, formatPrice, shopKindLabel, hasStock } from "@shared/catalog";
import { errText, timeAgo, trpc, whatsappLink } from "@/lib/api";
import { openExternal, shareLink } from "@/lib/actions";
import { requireLogin, useFavorites, useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Awning, Avatar, Btn, Empty, Field, H2, IconBtn, Input, Loading, Photo, Screen, Select, Sheet, T, Tag, panel, soft, useToast } from "@/ui/core";
import { Grid, PAD } from "@/ui/cards";
import ContactSheet from "@/ui/ContactSheet";
import CheckoutSheet, { Reputation, canBuy, payList } from "@/ui/Checkout";

export default function ListingScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 620);
  const { me } = useSession();
  const toast = useToast();
  const fav = useFavorites();
  const utils = trpc.useUtils();
  const q = trpc.listing.byId.useQuery({ id }, { retry: false, enabled: Number.isInteger(id) });
  const [photo, setPhoto] = useState(0);
  const [contact, setContact] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const setStatus = trpc.listing.setStatus.useMutation({ onSuccess: () => { utils.listing.invalidate(); toast("Publicación actualizada"); } });
  const report = trpc.report.create.useMutation({ onSuccess: () => { setReporting(false); setDetail(""); toast("Denuncia enviada. La revisaremos."); }, onError: (e) => toast(errText(e), true) });

  if (q.isLoading) return <Screen title=""><Loading /></Screen>;
  if (!q.data) return <Screen title=""><Empty title="Esta publicación ya no está" text="Puede que se haya vendido o retirado." action={<Btn label="Seguir explorando" kind="ink" onPress={() => router.replace("/explorar")} />} /></Screen>;
  const l = q.data, s = l.shop, on = fav.has(l.id);
  const login = () => { toast("Entra a tu cuenta para continuar"); requireLogin(`/p/${id}`); };
  const rows = [
    ["Categoría", categoryOf(l.category)?.label], ["Modalidad", dealLabel(l.deal)], ["Condición", conditionLabel(l.condition)], ["Talla", l.size],
    ["Medidas", l.measurements], ["Serie", l.series], ["Personaje", l.characterName], ["Entrega", deliveryLabel(l.delivery)],
    ["Ubicación", s.city ? `${s.city}${s.country ? `, ${s.country}` : ""}` : null],
  ].filter(([, v]) => v) as [string, string][];
  const photos = l.images.length ? l.images : [null];

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ width: "100%", alignItems: "center", backgroundColor: C.oat }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: W }}
            onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / W))} scrollEventThrottle={32}
            onScroll={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / W); if (i !== photo) setPhoto(i); }}>
            {photos.map((src, i) => <View key={i} style={{ width: W, height: W }}><Photo src={src} accent={s.accent} /></View>)}
          </ScrollView>
          {l.status !== "active" && (
            <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: "rgba(251,241,220,0.75)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ transform: [{ rotate: "-6deg" }], backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.ink, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 6 }}>
                <T w="black" size={19}>{l.status === "sold" ? "Vendido" : l.status === "paused" ? "En pausa" : "Retirado"}</T>
              </View>
            </View>
          )}
          {photos.length > 1 && (
            <View style={{ position: "absolute", bottom: 12, flexDirection: "row", gap: 6, backgroundColor: "rgba(255,250,239,0.85)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }} accessibilityLabel={`Foto ${photo + 1} de ${photos.length}`}>
              {photos.map((_, i) => <View key={i} style={{ width: i === photo ? 16 : 7, height: 7, borderRadius: 4, backgroundColor: i === photo ? C.ink : C.line }} />)}
            </View>
          )}
        </View>
        <View style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
          <IconBtn label="Volver" bg={C.paper} border onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}><ArrowLeft size={21} color={C.ink} strokeWidth={2.2} /></IconBtn>
          <IconBtn label="Compartir" bg={C.paper} border onPress={() => shareLink(l.title, `/p/${l.id}`, toast)}><Share2 size={19} color={C.ink} /></IconBtn>
        </View>

        <View style={{ padding: PAD, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {l.kind === "service" ? <Tag label="Servicio" bg={C.fuji} /> : l.condition ? <Tag label={conditionLabel(l.condition)} /> : null}
            {l.deal !== "venta" && <Tag label={dealLabel(l.deal)} bg={C.ramune} />}
            {l.acceptsTrade && <Tag label="Acepta cambio" bg={C.matcha} icon={<Repeat2 size={12} color={C.ink} strokeWidth={2.5} />} />}
          </View>
          <T w="black" size={26} style={{ lineHeight: 30 }} accessibilityRole="header">{l.title}</T>
          <T w="black" size={32} style={{ marginTop: 6 }}>{formatPrice(l.priceCents, l.deal)}</T>
          {hasStock(l.kind, l.deal) && l.status === "active" && l.stock > 1 ? <T w="bold" style={{ marginTop: 2 }}>Quedan {l.stock} disponibles</T> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
            <T size={13.5} color={C.cocoa}>Publicado {timeAgo(l.createdAt)}</T>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Eye size={14} color={C.cocoa} /><T size={13.5} color={C.cocoa}>{l.views} {l.views === 1 ? "visita" : "visitas"}</T></View>
          </View>

          {l.isMine && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              <Btn label="Editar" kind="ink" icon={<Pencil size={16} color={C.cream} />} onPress={() => router.push(`/editar/${l.id}`)} />
              {l.status === "active"
                ? <Btn label="Marcar como vendido" kind="matcha" onPress={() => setStatus.mutate({ id: l.id, status: "sold" })} />
                : <Btn label="Volver a publicar" onPress={() => setStatus.mutate({ id: l.id, status: "active" })} />}
            </View>
          )}

          <Pressable accessibilityRole="link" accessibilityLabel={`Ver la vitrina de ${s.name}`} onPress={() => router.push(`/v/${s.handle}`)} style={({ pressed }) => [panel, { marginTop: 22 }, pressed && { opacity: 0.85 }]}>
            <Awning accent={s.accent} size={24} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingTop: 10 }}>
              <Avatar src={s.avatarUrl} name={s.name} accent={s.accent} size={54} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><T w="black" size={17} numberOfLines={1} style={{ flexShrink: 1 }}>{s.name}</T>{s.verified && <BadgeCheck size={16} color={C.ink} />}</View>
                <T size={13.5} color={C.cocoa} numberOfLines={1}>{shopKindLabel(s.kind)}{s.city ? `, ${s.city}` : ""}</T>
                {s.reviewCount > 0 || s.sales > 0
                  ? <View style={{ marginTop: 2 }}><Reputation rating={s.rating} reviewCount={s.reviewCount} sales={s.sales} size={13} /></View>
                  : <T size={13} color={C.cocoa}>Aún sin reseñas</T>}
              </View>
              <T w="bold" size={13.5} style={{ textDecorationLine: "underline" }}>Ver vitrina</T>
            </View>
          </Pressable>

          {canBuy(l.pay) && !l.isMine ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}><Wallet size={16} color={C.cocoa} style={{ marginTop: 2 }} /><T size={14} color={C.cocoa} style={{ flex: 1 }}>Acepta {payList(l.pay)}.</T></View>
          ) : null}

          <H2 style={{ marginTop: 26, marginBottom: 6 }}>Descripción</H2>
          <T size={16}>{l.description}</T>

          <View style={[soft, { padding: 18, gap: 10, marginTop: 20 }]}>
            {rows.map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", gap: 14 }}>
                <T color={C.cocoa} style={{ width: 92 }}>{k}</T>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>{k === "Ubicación" && <MapPin size={15} color={C.ink} />}<T w="bold" style={{ flex: 1 }}>{v}</T></View>
              </View>
            ))}
          </View>

          <Pressable accessibilityRole="link" onPress={() => router.push("/compra-segura")} style={{ flexDirection: "row", gap: 12, backgroundColor: "rgba(248,226,156,0.55)", borderRadius: 22, padding: 16, marginTop: 16 }}>
            <ShieldCheck size={22} color={C.ink} />
            <T size={14} style={{ flex: 1 }}>Pide fotos o video actuales antes de pagar y prefiere entregas en lugares públicos. <T size={14} w="bold" style={{ textDecorationLine: "underline" }}>Consejos de compra segura</T></T>
          </Pressable>
          {!l.isMine && (
            <Pressable accessibilityRole="button" onPress={() => (me ? setReporting(true) : login())} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, alignSelf: "flex-start" }}>
              <Flag size={14} color={C.cocoa} /><T size={13.5} color={C.cocoa} style={{ textDecorationLine: "underline" }}>Denunciar esta publicación</T>
            </Pressable>
          )}

          {l.more.length > 0 && (<><H2 style={{ marginTop: 34, marginBottom: 14 }}>Más de {s.name}</H2><Grid items={l.more} /></>)}
        </View>
      </ScrollView>

      {!l.isMine && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: C.paper, borderTopWidth: BORDER, borderTopColor: C.ink }}>
          <IconBtn label={on ? "Quitar de favoritos" : "Guardar en favoritos"} size={50} border bg={on ? C.sakura : C.paper} onPress={() => fav.toggle(l.id)}>
            <Heart size={21} color={on ? C.berry : C.ink} fill={on ? C.berry : "transparent"} strokeWidth={2.2} />
          </IconBtn>
          <IconBtn label="Escribir al vendedor" size={50} border bg={C.paper} onPress={() => (me ? setContact(true) : login())}><MessageCircle size={21} color={C.ink} strokeWidth={2.2} /></IconBtn>
          {s.whatsapp && l.status === "active" ? (
            <IconBtn label="Preguntar por WhatsApp" size={50} border bg={C.matcha} onPress={() => openExternal(whatsappLink(s.whatsapp!, `Hola, vi "${l.title}" en Cosland. ¿Sigue disponible?`))}><Phone size={20} color={C.ink} strokeWidth={2.2} /></IconBtn>
          ) : null}
          {l.myOrder
            ? <Btn label="Ver mi pedido" kind="yuzu" grow style={{ minHeight: 50 }} icon={<ShoppingBag size={18} color={C.ink} />} onPress={() => router.push("/pedidos")} />
            : canBuy(l.pay)
              ? <Btn label={l.kind === "service" ? "Pedir este servicio" : "Comprar"} kind="ink" grow disabled={l.status !== "active"} style={{ minHeight: 50 }}
                  icon={<ShoppingBag size={18} color={C.cream} />} onPress={() => (me ? setOrdering(true) : login())} />
              : <Btn label="Escribir al vendedor" kind="ink" grow disabled={l.status !== "active"} style={{ minHeight: 50 }} onPress={() => (me ? setContact(true) : login())} />}
        </View>
      )}

      <CheckoutSheet open={ordering} onClose={() => setOrdering(false)} item={l} />
      <ContactSheet open={contact} onClose={() => setContact(false)} shopId={s.id} shopName={s.name} listingId={l.id} listingTitle={l.title} withOffer={l.kind === "product"} />
      <Sheet open={reporting} onClose={() => setReporting(false)} title="Denunciar publicación">
        <View style={{ gap: 16 }}>
          <Field label="Motivo"><Select title="Motivo" value={reason} onChange={setReason} options={REPORT_REASONS.map((r) => ({ value: r, label: r }))} /></Field>
          <Field label="Cuéntanos qué pasó (opcional)"><Input multiline value={detail} onChangeText={setDetail} maxLength={1000} /></Field>
          <Btn label="Enviar denuncia" kind="ink" busy={report.isPending} onPress={() => report.mutate({ listingId: l.id, reason: reason as (typeof REPORT_REASONS)[number], detail })} />
        </View>
      </Sheet>
    </View>
  );
}
