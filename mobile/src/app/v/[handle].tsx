import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { BadgeCheck, Camera, Clock, MapPin, MessageCircle, Music2, Pencil, Phone, Plus, Share2, Star, Store } from "lucide-react-native";
import { shopKindLabel } from "@shared/catalog";
import { errText, img, timeAgo, trpc, whatsappLink } from "@/lib/api";
import { openExternal, shareLink } from "@/lib/actions";
import { requireLogin, useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Awning, Avatar, Btn, Chip, Empty, Field, IconBtn, Input, Loading, Screen, Stars, T, panel, soft, useToast } from "@/ui/core";
import { Grid, PAD } from "@/ui/cards";
import ContactSheet from "@/ui/ContactSheet";
import FollowersSheet from "@/ui/FollowersSheet";

function Reviews({ shopId, shopName, handle }: { shopId: number; shopName: string; handle: string }) {
  const { me } = useSession();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.review.list.useQuery({ shopId });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const save = trpc.review.save.useMutation({
    onSuccess: () => { utils.review.invalidate(); utils.shop.invalidate(); setComment(""); toast("Reseña publicada"); },
    onError: (e) => toast(errText(e), true),
  });
  if (q.isLoading) return <Loading />;
  return (
    <View style={{ gap: 12 }}>
      <View style={[panel, { padding: 18, gap: 12 }]}>
        <T w="black" size={18}>Deja tu reseña</T>
        {!me ? <Btn label="Entrar para opinar" onPress={() => requireLogin(`/v/${handle}`)} />
          : !q.data?.canReview ? <T color={C.cocoa}>Podrás opinar después de escribirle a esta vitrina por una compra o servicio.</T>
          : (
            <>
              <View style={{ flexDirection: "row", gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel="Calificación">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Pressable key={i} accessibilityRole="radio" accessibilityState={{ checked: rating === i }} accessibilityLabel={`${i} ${i === 1 ? "estrella" : "estrellas"}`} onPress={() => setRating(i)} hitSlop={4}>
                    <Star size={34} strokeWidth={1.8} color={i <= rating ? C.ink : C.line} fill={i <= rating ? C.yuzu : "transparent"} />
                  </Pressable>
                ))}
              </View>
              <Field label="¿Cómo te fue?"><Input multiline value={comment} onChangeText={setComment} maxLength={1000} placeholder="Trato, tiempos de entrega, calidad…" accessibilityLabel="¿Cómo te fue?" /></Field>
              <Btn label="Publicar reseña" kind="ink" busy={save.isPending} onPress={() => save.mutate({ shopId, rating, comment })} />
            </>
          )}
      </View>
      {q.data?.items.length ? q.data.items.map((r) => (
        <View key={r.id} style={[soft, { padding: 18 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}><T w="black" style={{ flex: 1 }}>{r.author}</T><Stars value={r.rating} /></View>
          {r.comment ? <T style={{ marginTop: 6 }}>{r.comment}</T> : null}
          <T size={13} color={C.cocoa} style={{ marginTop: 6 }}>{timeAgo(r.createdAt)}</T>
        </View>
      )) : <Empty title="Aún sin reseñas" text={`Las dejan quienes ya le escribieron a ${shopName} por una compra.`} />}
    </View>
  );
}

export default function ShopScreen() {
  const handle = String(useLocalSearchParams<{ handle: string }>().handle);
  const { me } = useSession();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.shop.byHandle.useQuery({ handle }, { retry: false });
  const [tab, setTab] = useState<"all" | "product" | "service" | "reviews">("all");
  const [contact, setContact] = useState(false);
  const [followers, setFollowers] = useState(false);
  const items = trpc.listing.search.useQuery({ shopId: q.data?.id, kind: tab === "product" || tab === "service" ? tab : undefined }, { enabled: Boolean(q.data) && tab !== "reviews" });
  const follow = trpc.shop.toggleFollow.useMutation({
    onSuccess: (r) => { utils.shop.invalidate(); toast(r.following ? "Ahora sigues esta vitrina" : "Dejaste de seguir esta vitrina"); },
  });

  if (q.isLoading) return <Screen title=""><Loading /></Screen>;
  if (!q.data) return <Screen title=""><Empty title="No encontramos esa vitrina" action={<Btn label="Ver vitrinas" kind="ink" onPress={() => router.replace("/vitrinas")} />} /></Screen>;
  const s = q.data;
  const login = () => { toast("Entra a tu cuenta para continuar"); requireLogin(`/v/${handle}`); };
  const banner = img(s.bannerUrl);

  return (
    <Screen title={s.name} pad={false} right={<IconBtn label="Compartir vitrina" onPress={() => shareLink(`${s.name} en Cosland`, `/v/${s.handle}`, toast)}><Share2 size={20} color={C.ink} /></IconBtn>}>
      <Awning accent={s.accent} size={38} />
      <View style={{ padding: PAD }}>
        {banner && <View style={{ aspectRatio: 5 / 2, borderRadius: 24, overflow: "hidden", borderWidth: BORDER, borderColor: C.ink, marginBottom: -44 }}><Image source={{ uri: banner }} style={{ width: "100%", height: "100%" }} contentFit="cover" /></View>}
        {/* La foto y los enlaces comparten fila; los dos botones principales van debajo del nombre */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: banner ? 8 : 0 }}>
          <View style={{ borderRadius: 50, padding: 4, margin: -4, backgroundColor: C.cream }}><Avatar src={s.avatarUrl} name={s.name} accent={s.accent} size={88} /></View>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {!s.isMine && s.whatsapp ? <IconBtn label="Escribir por WhatsApp" size={44} border bg={C.matcha} onPress={() => openExternal(whatsappLink(s.whatsapp!, `Hola, vi tu vitrina "${s.name}" en Cosland.`))}><Phone size={19} color={C.ink} /></IconBtn> : null}
            {s.instagram ? <IconBtn label="Instagram de la vitrina" size={44} border bg={C.paper} onPress={() => openExternal(`https://instagram.com/${s.instagram}`)}><Camera size={19} color={C.ink} /></IconBtn> : null}
            {s.tiktok ? <IconBtn label="TikTok de la vitrina" size={44} border bg={C.paper} onPress={() => openExternal(`https://tiktok.com/@${s.tiktok}`)}><Music2 size={19} color={C.ink} /></IconBtn> : null}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <T w="black" size={28} style={{ lineHeight: 32, flexShrink: 1 }} accessibilityRole="header">{s.name}</T>
          {s.verified && <BadgeCheck size={24} color={C.ink} />}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 3, marginTop: 6 }}>
          <T color={C.cocoa}>{shopKindLabel(s.kind)}</T>
          {s.city ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><MapPin size={15} color={C.cocoa} /><T color={C.cocoa}>{s.city}{s.country ? `, ${s.country}` : ""}</T></View> : null}
          {s.reviewCount > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Stars value={s.rating} size={14} /><T color={C.cocoa}>{s.rating.toFixed(1)} ({s.reviewCount})</T></View>}
          <Pressable accessibilityRole="button" accessibilityLabel={`${s.followers} ${s.followers === 1 ? "seguidor" : "seguidores"}, ver quiénes son`} onPress={() => setFollowers(true)} hitSlop={8}>
            <T w="bold" style={{ textDecorationLine: "underline" }}>{s.followers} {s.followers === 1 ? "seguidor" : "seguidores"}</T>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {s.isMine ? (
            <>
              <Btn grow label="Editar vitrina" kind="ink" icon={<Pencil size={16} color={C.cream} />} onPress={() => router.push("/vitrina-editar")} />
              <Btn grow label="Publicar" kind="sakura" icon={<Plus size={17} color={C.ink} />} onPress={() => router.push("/publicar")} />
            </>
          ) : (
            <>
              <Btn grow label={s.isFollowing ? "Siguiendo" : "Seguir"} kind={s.isFollowing ? "paper" : "ink"} onPress={() => (me ? follow.mutate({ shopId: s.id }) : login())} />
              <Btn grow label="Escribir" icon={<MessageCircle size={17} color={C.ink} />} onPress={() => (me ? setContact(true) : login())} />
            </>
          )}
        </View>

        {s.bio ? <T size={16} style={{ marginTop: 16 }}>{s.bio}</T> : null}
        {s.hasStore && (s.address || s.hours) ? (
          <View style={[panel, { padding: 18, marginTop: 18, gap: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Store size={19} color={C.ink} /><T w="black" size={17}>Tienda física</T></View>
            {s.address ? (
              <Pressable accessibilityRole="link" accessibilityLabel={`Abrir ${s.address} en el mapa`} style={{ flexDirection: "row", gap: 8 }}
                onPress={() => openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.address} ${s.city ?? ""}`)}`)}>
                <MapPin size={17} color={C.ink} style={{ marginTop: 3 }} /><T style={{ flex: 1, textDecorationLine: "underline" }}>{s.address}</T>
              </Pressable>
            ) : null}
            {s.hours ? <View style={{ flexDirection: "row", gap: 8 }}><Clock size={17} color={C.ink} style={{ marginTop: 3 }} /><T style={{ flex: 1 }}>{s.hours}</T></View> : null}
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, gap: 8, paddingBottom: 18 }}>
        <Chip label={`Todo (${s.listingCount})`} on={tab === "all"} onPress={() => setTab("all")} />
        <Chip label="Artículos" on={tab === "product"} onPress={() => setTab("product")} />
        <Chip label="Servicios" on={tab === "service"} onPress={() => setTab("service")} />
        <Chip label={`Reseñas (${s.reviewCount})`} on={tab === "reviews"} onPress={() => setTab("reviews")} />
      </ScrollView>

      <View style={{ paddingHorizontal: PAD }}>
        {tab === "reviews" ? <Reviews shopId={s.id} shopName={s.name} handle={handle} />
          : items.isLoading ? <Loading />
          : items.data?.items.length ? <Grid items={items.data.items} />
          : <Empty title="Esta vitrina aún está vacía" text={s.isMine ? "Sube tu primera publicación para que te encuentren." : "Síguela para enterarte cuando publique algo."}
              action={s.isMine ? <Btn label="Publicar mi primer artículo" kind="sakura" onPress={() => router.push("/publicar")} /> : undefined} />}
      </View>
      <ContactSheet open={contact} onClose={() => setContact(false)} shopId={s.id} shopName={s.name} />
      <FollowersSheet open={followers} onClose={() => setFollowers(false)} shopId={s.id} mine={s.isMine} />
    </Screen>
  );
}
