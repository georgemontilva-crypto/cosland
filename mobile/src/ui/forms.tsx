import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ACCENTS, CATEGORIES, CONDITIONS, COUNTRIES, DEALS, DELIVERY, SHOP_KINDS, SIZES, categoryOf, formatPrice, slugify, hasStock } from "@shared/catalog";
import { errText, trpc } from "@/lib/api";
import { useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Awning, Avatar, Btn, Check2, Empty, Field, Input, Loading, Select, T, panel, soft, useToast } from "./core";
import { PhotosInput, SinglePhoto } from "./photos";
import { useSupport } from "./Support";

const Err = ({ text }: { text: string }) => text ? <View style={{ backgroundColor: "rgba(246,195,207,0.7)", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }} accessibilityRole="alert"><T w="bold" size={14}>{text}</T></View> : null;

/* ── Vitrina ── */
const shopBlank = {
  handle: "", name: "", kind: "cosplayer", bio: "", avatarUrl: null as string | null, bannerUrl: null as string | null, accent: "sakura",
  city: "", country: "Venezuela", whatsapp: "", instagram: "", tiktok: "", hasStore: false, address: "", hours: "",
};

export function ShopForm({ onDone }: { onDone?: () => void }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const mine = trpc.shop.mine.useQuery();
  const [f, setF] = useState(shopBlank);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const isNew = !mine.data;

  // Se rellena al abrir; después, un refresco en vivo no pisa lo que se está escribiendo
  const settled = useRef(false);
  const filledWith = useRef<unknown>(null);
  useEffect(() => {
    const s = mine.data;
    if (!s || settled.current) return;
    if (!mine.isFetching) settled.current = true;
    if (filledWith.current === s) return;
    filledWith.current = s;
    setF({
      handle: s.handle, name: s.name, kind: s.kind, bio: s.bio ?? "", avatarUrl: s.avatarUrl, bannerUrl: s.bannerUrl, accent: s.accent,
      city: s.city ?? "", country: s.country ?? "Venezuela", whatsapp: s.whatsapp ?? "", instagram: s.instagram ?? "", tiktok: s.tiktok ?? "",
      hasStore: s.hasStore, address: s.address ?? "", hours: s.hours ?? "",
    });
    setTouched(true);
  }, [mine.data, mine.isFetching]);

  const save = trpc.shop.save.useMutation({
    onSuccess: async () => { await utils.invalidate(); toast(isNew ? "Tu vitrina ya está abierta" : "Vitrina guardada"); onDone?.(); },
    onError: (e) => setError(errText(e)),
  });
  if (mine.isLoading) return <Loading />;
  const up = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <View style={{ gap: 18 }}>
      <View style={panel}>
        <Awning accent={f.accent} size={30} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
          <Avatar src={f.avatarUrl} name={f.name || "?"} accent={f.accent} size={58} />
          <View style={{ flex: 1 }}>
            <T w="black" size={18} numberOfLines={1}>{f.name || "El nombre de tu vitrina"}</T>
            <T size={13.5} color={C.cocoa} numberOfLines={1}>cosland/v/{f.handle || "tu-enlace"}</T>
          </View>
        </View>
      </View>

      <Field label="Nombre de la vitrina"><Input value={f.name} maxLength={80} placeholder="El Taller de Sakura" accessibilityLabel="Nombre de la vitrina"
        onChangeText={(name) => setF((p) => ({ ...p, name, handle: touched ? p.handle : slugify(name) }))} /></Field>
      <Field label="Enlace de tu vitrina" hint="Letras, números y guiones. Es el enlace que vas a compartir.">
        <Input value={f.handle} autoCapitalize="none" autoCorrect={false} maxLength={40} accessibilityLabel="Enlace de tu vitrina"
          onChangeText={(v) => { setTouched(true); up("handle")(v.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} />
      </Field>
      <Field label="¿Qué tipo de vitrina es?"><Select title="Tipo de vitrina" value={f.kind} onChange={up("kind")} options={SHOP_KINDS.map((k) => ({ value: k.id, label: k.label }))} /></Field>

      <Field label="Color de tu toldo">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ACCENTS.map((a) => (
            <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ checked: f.accent === a.id }} accessibilityLabel={a.label} onPress={() => up("accent")(a.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 6, paddingRight: 13, paddingVertical: 6, borderRadius: 999, borderWidth: BORDER, borderColor: f.accent === a.id ? C.ink : C.line, backgroundColor: f.accent === a.id ? C.paper : "transparent" }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: BORDER, borderColor: C.ink, backgroundColor: a.hex }} />
              <T w="bold" size={13.5}>{a.label}</T>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Foto de perfil"><SinglePhoto value={f.avatarUrl} onChange={up("avatarUrl")} label="Subir foto" round /></Field>
      <Field label="Portada"><SinglePhoto value={f.bannerUrl} onChange={up("bannerUrl")} label="Subir portada" /></Field>
      <Field label="Cuéntale a la comunidad quién eres"><Input multiline value={f.bio} onChangeText={up("bio")} maxLength={1000} placeholder="Qué haces, desde cuándo, qué tipo de trabajos tomas…" accessibilityLabel="Descripción de la vitrina" /></Field>
      <Field label="Ciudad"><Input value={f.city} onChangeText={up("city")} maxLength={80} placeholder="Maracaibo" accessibilityLabel="Ciudad" /></Field>
      <Field label="País"><Select title="País" value={f.country} onChange={up("country")} options={COUNTRIES.map((c) => ({ value: c, label: c }))} /></Field>
      <Field label="WhatsApp" hint="Con código de país. Ej. +58 412…"><Input value={f.whatsapp} onChangeText={up("whatsapp")} keyboardType="phone-pad" maxLength={30} accessibilityLabel="WhatsApp" /></Field>
      <Field label="Instagram"><Input value={f.instagram} onChangeText={up("instagram")} autoCapitalize="none" maxLength={60} placeholder="tu_usuario" /></Field>
      <Field label="TikTok"><Input value={f.tiktok} onChangeText={up("tiktok")} autoCapitalize="none" maxLength={60} placeholder="tu_usuario" /></Field>

      <View style={[soft, { padding: 18, gap: 16 }]}>
        <Check2 value={f.hasStore} onChange={up("hasStore")} label="Tengo tienda física" />
        {f.hasStore && (
          <>
            <Field label="Dirección"><Input value={f.address} onChangeText={up("address")} maxLength={255} placeholder="C.C. Galerías, local 12" /></Field>
            <Field label="Horario"><Input value={f.hours} onChangeText={up("hours")} maxLength={255} placeholder="Lunes a sábado, 10 am a 7 pm" /></Field>
          </>
        )}
      </View>

      <Err text={error} />
      <Btn label={isNew ? "Abrir mi vitrina" : "Guardar cambios"} kind="ink" busy={save.isPending} disabled={f.name.trim().length < 2 || f.handle.length < 3}
        onPress={() => { setError(""); save.mutate({ ...f, kind: f.kind as never, accent: f.accent as never }); }} />
    </View>
  );
}

/* ── Publicación ── */
const WEARABLE = ["cosplay", "pelucas", "accesorios", "merch"];
const FANDOM = ["cosplay", "pelucas", "props", "accesorios", "figuras", "manga", "cartas", "merch", "arte", "videojuegos"];
const listingBlank = {
  category: "cosplay", deal: "venta", title: "", description: "", price: "", acceptsTrade: false, condition: "usado",
  size: "", measurements: "", series: "", characterName: "", delivery: "ambos", images: [] as string[], stock: "1", supportsApp: true,
};

export function ListingForm({ id }: { id?: number }) {
  const { me, loading } = useSession();
  const toast = useToast();
  const utils = trpc.useUtils();
  const existing = trpc.listing.byId.useQuery({ id: id! }, { enabled: Boolean(id) });
  const support = useSupport();
  const [f, setF] = useState(listingBlank);
  const [error, setError] = useState("");

  const settled = useRef(false);
  const filledWith = useRef<unknown>(null);
  useEffect(() => {
    const l = existing.data;
    if (!l || settled.current) return;
    if (!existing.isFetching) settled.current = true;
    if (filledWith.current === l) return;
    filledWith.current = l;
    setF({
      category: l.category, deal: l.deal, title: l.title, description: l.description, price: l.priceCents != null ? String((l.priceCents - (l.supportsApp ? 100 : 0)) / 100) : "",
      acceptsTrade: l.acceptsTrade, condition: l.condition ?? "usado", size: l.size ?? "", measurements: l.measurements ?? "",
      series: l.series ?? "", characterName: l.characterName ?? "", delivery: l.delivery, images: l.images, stock: String(Math.max(1, l.stock)), supportsApp: l.supportsApp,
    });
  }, [existing.data, existing.isFetching]);

  const save = trpc.listing.save.useMutation({
    onSuccess: (r) => { utils.listing.invalidate(); utils.shop.invalidate(); toast(id ? "Cambios guardados" : "Publicado"); router.replace(`/p/${r.id}`); },
    onError: (e) => setError(errText(e)),
  });

  if (loading || (id && existing.isLoading)) return <Loading />;
  if (!me) return <Empty title="Entra para publicar" text="Publicar es gratis y toma un par de minutos." action={<Btn label="Crear mi cuenta" kind="ink" onPress={() => router.replace({ pathname: "/registro", params: { volver: "/publicar" } })} />} />;
  if (!me.shop) return <Empty title="Primero abre tu vitrina" text="Tus publicaciones viven en tu vitrina. Crearla toma un minuto." action={<Btn label="Abrir mi vitrina" kind="ink" onPress={() => router.replace("/vitrina-editar")} />} />;
  if (id && existing.data && !existing.data.isMine) return <Empty title="Esta publicación no es tuya" />;

  const isService = categoryOf(f.category)?.kind === "service";
  const up = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const group = (kind: string) => CATEGORIES.filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: c.label }));

  const stocked = hasStock(isService ? "service" : "product", f.deal);
  const submit = () => {
    setError("");
    if (!isService && f.images.length === 0) { setError("Agrega al menos una foto del artículo."); return; }
    save.mutate({
      id, category: f.category as never, deal: (isService ? "encargo" : f.deal) as never, title: f.title, description: f.description,
      price: f.price ? Number(f.price) : null, acceptsTrade: !isService && f.acceptsTrade, condition: isService ? null : (f.condition as never),
      size: WEARABLE.includes(f.category) ? f.size : "", measurements: WEARABLE.includes(f.category) ? f.measurements : "",
      series: FANDOM.includes(f.category) ? f.series : "", characterName: FANDOM.includes(f.category) ? f.characterName : "",
      delivery: f.delivery as never, images: f.images,
      supportsApp: Boolean(support?.enabled) && f.supportsApp,
      stock: stocked ? Math.max(1, Number(f.stock) || 1) : undefined,
    });
  };

  return (
    <View style={{ gap: 18 }}>
      <Field label="¿Qué vas a publicar?"><Select title="¿Qué vas a publicar?" value={f.category} onChange={up("category")} options={[...group("product"), ...group("service")]} /></Field>
      {!isService && (
        <Field label="Modalidad" hint={f.deal === "alquiler" ? "El precio es por evento." : f.deal === "encargo" ? "Lo haces a pedido; el precio es desde." : undefined}>
          <Select title="Modalidad" value={f.deal} onChange={up("deal")} options={DEALS.map((d) => ({ value: d.id, label: d.label }))} />
        </Field>
      )}
      <Field label={isService ? "Fotos de trabajos anteriores" : "Fotos"}><PhotosInput value={f.images} onChange={up("images")} /></Field>
      <Field label="Título"><Input value={f.title} onChangeText={up("title")} maxLength={120} accessibilityLabel="Título" placeholder={isService ? "Confección de cosplay a medida" : "Cosplay de Nezuko completo con peluca"} /></Field>
      <Field label="Descripción" hint={isService ? "Qué incluye, tiempos de entrega y cómo trabajas." : "Qué incluye, cuántas veces se usó y cualquier detalle o desgaste."}>
        <Input multiline value={f.description} onChangeText={up("description")} maxLength={5000} accessibilityLabel="Descripción" />
      </Field>
      <Field label={isService || f.deal === "encargo" ? "Precio desde, en dólares" : f.deal === "alquiler" ? "Precio por evento, en dólares" : "Precio en dólares"} hint="Déjalo vacío si es a convenir.">
        <Input value={f.price} onChangeText={(v) => up("price")(v.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" placeholder="45" accessibilityLabel="Precio en dólares" />
      </Field>
      {stocked && (
        <Field label="Cantidad disponible" hint="Si tienes varias iguales, pon cuántas. Se descuentan solas con cada venta.">
          <Input value={f.stock} onChangeText={(v) => up("stock")(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" accessibilityLabel="Cantidad disponible" />
        </Field>
      )}
      {!isService && <Field label="Condición"><Select title="Condición" value={f.condition} onChange={up("condition")} options={CONDITIONS.map((c) => ({ value: c.id, label: c.label }))} /></Field>}
      {WEARABLE.includes(f.category) && (
        <>
          <Field label="Talla"><Select title="Talla" value={f.size} onChange={up("size")} placeholder="Sin talla" options={[{ value: "", label: "Sin talla" }, ...SIZES.map((s) => ({ value: s, label: s }))]} /></Field>
          <Field label="Medidas" hint="Busto, cintura, cadera, largo. Ayuda mucho a decidir."><Input value={f.measurements} onChangeText={up("measurements")} maxLength={255} placeholder="Busto 88, cintura 70, largo 95 cm" /></Field>
        </>
      )}
      {FANDOM.includes(f.category) && (
        <>
          <Field label="Serie, anime o juego"><Input value={f.series} onChangeText={up("series")} maxLength={100} placeholder="Kimetsu no Yaiba" accessibilityLabel="Serie, anime o juego" /></Field>
          <Field label="Personaje"><Input value={f.characterName} onChangeText={up("characterName")} maxLength={100} placeholder="Nezuko Kamado" accessibilityLabel="Personaje" /></Field>
        </>
      )}
      <Field label="Entrega"><Select title="Entrega" value={f.delivery} onChange={up("delivery")} options={DELIVERY.map((d) => ({ value: d.id, label: d.label }))} /></Field>
      {!isService && <View style={[soft, { padding: 16 }]}><Check2 value={f.acceptsTrade} onChange={up("acceptsTrade")} label="Acepto cambiarlo por otro artículo" /></View>}
      {support?.enabled ? (
        <View style={{ backgroundColor: "rgba(205,228,190,0.55)", borderWidth: BORDER, borderColor: C.ink, borderRadius: 24, padding: 16, gap: 8 }}>
          <Check2 value={f.supportsApp} onChange={up("supportsApp")} label={`Sumar ${formatPrice(support.amountCents)} al precio para mantener viva Cosland`} />
          <T size={13.5} style={{ marginLeft: 36 }}>
            {f.supportsApp
              ? f.price && !Number.isNaN(Number(f.price))
                ? `Tu publicación saldrá en ${formatPrice(Math.round(Number(f.price) * 100) + support.amountCents)}. Cuando vendas, envías ese dólar a Cosland. Es voluntario.`
                : `Cuando vendas, envías ${formatPrice(support.amountCents)} a Cosland. Es voluntario.`
              : "Publicar sigue siendo gratis. Puedes activarlo cuando quieras."}
          </T>
        </View>
      ) : null}
      <Err text={error} />
      <Btn label={id ? "Guardar cambios" : "Publicar"} kind="ink" busy={save.isPending} disabled={f.title.trim().length < 4 || f.description.trim().length < 10} onPress={submit} />
    </View>
  );
}
