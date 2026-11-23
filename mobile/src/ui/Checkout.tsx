import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, HandCoins, Minus, Plus, Star, Wallet } from "lucide-react-native";
import { PAY_ON_DELIVERY, formatPrice, hasStock, sellerLevel } from "@shared/catalog";
import { errText, trpc } from "@/lib/api";
import { BORDER, C } from "@/lib/theme";
import { Btn, Field, IconBtn, Input, Loading, Sheet, Stars, T, Tag, useToast } from "./core";
import { SinglePhoto } from "./photos";

type PayOptions = { methods: { id: number; type: string; label: string }[]; onDelivery: boolean };
type Item = { id: number; title: string; priceCents: number | null; deal: string; kind: string; stock: number; pay: PayOptions };
export const canBuy = (pay: PayOptions) => pay.methods.length > 0 || pay.onDelivery;
export const payList = (pay: PayOptions) => [...new Set(pay.methods.map((m) => m.label)), ...(pay.onDelivery ? ["pago al recibir"] : [])].join(", ");

// Reputación de una vitrina: puntaje, reseñas, ventas concretadas y nivel
export function Reputation({ rating, reviewCount, sales, size = 14, level = true }: { rating: number; reviewCount: number; sales: number; size?: number; level?: boolean }) {
  const lv = level ? sellerLevel(sales, rating, reviewCount) : null;
  if (!reviewCount && !sales && !lv) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 4 }}>
      {reviewCount > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Stars value={rating} size={size} /><T size={size} color={C.cocoa}>{rating.toFixed(1)} ({reviewCount})</T></View>}
      {sales > 0 && <T w="bold" size={size}>{sales} {sales === 1 ? "venta" : "ventas"}</T>}
      {lv && <Tag label={lv.label} bg={lv.tone} />}
    </View>
  );
}

// Datos para pagar (con botón de copiar) y aviso de "ya pagué" con referencia o comprobante
export function PayForm({ orderId, label, details, total, onDone, later }: { orderId: number; label: string; details: string | null; total: string; onDone: () => void; later?: () => void }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const pay = trpc.order.pay.useMutation({
    onSuccess: () => { utils.order.invalidate(); utils.auth.me.invalidate(); toast("Listo. El vendedor confirmará tu pago."); onDone(); },
    onError: (e) => toast(errText(e), true),
  });
  const copy = async () => { try { await Clipboard.setStringAsync(details ?? ""); toast("Datos copiados"); } catch { toast("No se pudo copiar. Mantén presionado el texto para copiarlo.", true); } };
  return (
    <View style={{ gap: 14 }}>
      <T>Paga <T w="black">{total}</T> por <T w="black">{label}</T> a estos datos:</T>
      <View style={{ backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.ink, borderRadius: 22, padding: 16, gap: 12 }}>
        {details ? (
          <>
            <T w="bold" selectable>{details}</T>
            <Btn small label="Copiar datos" icon={<Copy size={15} color={C.ink} />} style={{ alignSelf: "flex-start" }} onPress={copy} />
          </>
        ) : <T color={C.cocoa}>El vendedor cambió este método de pago. Escríbele por el chat para que te pase los datos.</T>}
      </View>
      <Field label="Número de referencia"><Input value={reference} onChangeText={setReference} maxLength={120} autoCapitalize="characters" accessibilityLabel="Número de referencia" /></Field>
      <Field label="Comprobante" hint="Con la referencia o con la captura alcanza."><SinglePhoto value={proof} onChange={setProof} label="Subir comprobante" /></Field>
      <Btn label="Ya pagué" kind="ink" icon={<Check size={18} color={C.cream} />} busy={pay.isPending} onPress={() => pay.mutate({ id: orderId, reference: reference.trim() || null, proofUrl: proof })} />
      {later ? <Btn label="Pagar después" kind="ghost" onPress={later} /> : null}
    </View>
  );
}

// Comprar: cantidad, forma de pago y listo. Si eligió pagar ya, sigue con los datos del vendedor.
export default function CheckoutSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item: Item }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const max = hasStock(item.kind, item.deal) ? Math.max(1, item.stock) : 1;
  const first = (): number | "delivery" | null => item.pay.methods[0]?.id ?? (item.pay.onDelivery ? "delivery" : null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [pay, setPay] = useState<number | "delivery" | null>(first);
  const [paying, setPaying] = useState<null | { orderId: number; conversationId: number | null }>(null);
  useEffect(() => { if (open) { setQty(1); setNote(""); setPay(first()); setPaying(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = trpc.order.mine.useQuery(undefined, { enabled: Boolean(paying) });
  const toChat = (conversationId: number | null) => { onClose(); router.push(conversationId ? `/mensajes/${conversationId}` : "/pedidos"); };
  const create = trpc.order.create.useMutation({
    onSuccess: (r) => {
      utils.order.invalidate(); utils.auth.me.invalidate(); utils.listing.byId.invalidate({ id: item.id }); utils.chat.invalidate();
      if (r.toPay) { setPaying({ orderId: r.id, conversationId: r.conversationId }); return; }
      toast(r.existing ? "Ya tenías este pedido en curso" : "¡Compra hecha! Cuadra la entrega con el vendedor.");
      toChat(r.conversationId);
    },
    onError: (e) => toast(errText(e), true),
  });
  const total = item.priceCents != null ? formatPrice(item.priceCents * qty, item.deal) : "el monto acordado";

  if (paying) {
    const order = mine.data?.buying.find((o) => o.id === paying.orderId);
    return (
      <Sheet open={open} onClose={() => toChat(paying.conversationId)} title="Paga tu compra">
        {!order ? <Loading label="Cargando los datos de pago" /> : (
          <PayForm orderId={order.id} label={order.payLabel ?? ""} details={order.payDetails} total={total}
            onDone={() => toChat(paying.conversationId)} later={() => { toast("Tu compra quedó guardada. Págala desde Pedidos."); toChat(paying.conversationId); }} />
        )}
      </Sheet>
    );
  }

  const option = (value: number | "delivery", label: string, hint: string, Icon: typeof Wallet) => (
    <Pressable key={String(value)} accessibilityRole="radio" accessibilityState={{ checked: pay === value }} accessibilityLabel={`${label}. ${hint}`} onPress={() => setPay(value)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: BORDER, borderColor: pay === value ? C.ink : C.line, backgroundColor: pay === value ? C.paper : "transparent", borderRadius: 20, padding: 13 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: BORDER, borderColor: C.ink, alignItems: "center", justifyContent: "center" }}>
        {pay === value && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: C.ink }} />}
      </View>
      <View style={{ flex: 1 }}><T w="bold">{label}</T><T size={13.5} color={C.cocoa}>{hint}</T></View>
      <Icon size={20} color={C.ink} />
    </Pressable>
  );

  return (
    <Sheet open={open} onClose={onClose} title={item.kind === "service" ? "Pedir este servicio" : "Comprar"}>
      <View style={{ gap: 16 }}>
        <View>
          <T w="black" size={16}>{item.title}</T>
          <T color={C.cocoa} style={{ marginTop: 2 }}>{formatPrice(item.priceCents, item.deal)}{max > 1 ? ` cada uno. Quedan ${item.stock}.` : ""}</T>
        </View>
        {max > 1 && (
          <Field label="Cantidad">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <IconBtn label="Una menos" size={46} border bg={C.paper} onPress={() => setQty((v) => Math.max(1, v - 1))}><Minus size={18} color={C.ink} /></IconBtn>
              <T w="black" size={24} style={{ minWidth: 30, textAlign: "center" }} accessibilityLabel={`Cantidad: ${qty}`}>{qty}</T>
              <IconBtn label="Una más" size={46} border bg={C.paper} onPress={() => setQty((v) => Math.min(max, v + 1))}><Plus size={18} color={C.ink} /></IconBtn>
              {item.priceCents != null && qty > 1 ? <T color={C.cocoa}>Total {total}</T> : null}
            </View>
          </Field>
        )}
        <Field label="¿Cómo quieres pagar?">
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            {item.pay.methods.map((m) => option(m.id, m.label, "Pagas ahora y subes el comprobante", Wallet))}
            {item.pay.onDelivery && option("delivery", PAY_ON_DELIVERY, "Le pagas al vendedor cuando te lo entregue", HandCoins)}
          </View>
        </Field>
        <Field label="Mensaje para el vendedor" hint="Opcional. Por ejemplo, tu ciudad o cómo prefieres recibirlo.">
          <Input multiline value={note} onChangeText={setNote} maxLength={500} accessibilityLabel="Mensaje para el vendedor" />
        </Field>
        <T size={13.5} color={C.cocoa}>El pago va directo al vendedor y la entrega la cuadran por el chat. Cosland no cobra ni guarda dinero.</T>
        <Btn label="Confirmar compra" kind="ink" busy={create.isPending} disabled={pay === null} onPress={() => create.mutate({ listingId: item.id, quantity: qty, note: note.trim() || null, pay: pay ?? undefined })} />
      </View>
    </Sheet>
  );
}

// Reseña al recibir: estrellas y un comentario corto
export function ReviewSheet({ target, onClose }: { target: null | { shopId: number; shopName: string }; onClose: () => void }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  useEffect(() => { if (target) { setRating(5); setComment(""); } }, [target]);
  const save = trpc.review.save.useMutation({
    onSuccess: () => { utils.review.invalidate(); utils.shop.invalidate(); utils.order.invalidate(); toast("Reseña publicada. ¡Gracias!"); onClose(); },
    onError: (e) => toast(errText(e), true),
  });
  return (
    <Sheet open={Boolean(target)} onClose={onClose} title="¿Cómo te fue con tu compra?">
      <View style={{ gap: 14 }}>
        <T color={C.cocoa}>Tu reseña ayuda a que otros compren con confianza en {target?.shopName}.</T>
        <View style={{ flexDirection: "row", gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel="Calificación">
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} accessibilityRole="radio" accessibilityState={{ checked: rating === i }} accessibilityLabel={`${i} ${i === 1 ? "estrella" : "estrellas"}`} onPress={() => setRating(i)} hitSlop={4}>
              <Star size={38} strokeWidth={1.8} color={i <= rating ? C.ink : C.line} fill={i <= rating ? C.yuzu : "transparent"} />
            </Pressable>
          ))}
        </View>
        <Field label="Cuéntalo en pocas palabras"><Input multiline value={comment} onChangeText={setComment} maxLength={1000} placeholder="Trato, tiempos de entrega, calidad…" accessibilityLabel="Cuéntalo en pocas palabras" /></Field>
        <Btn label="Publicar reseña" kind="ink" busy={save.isPending} onPress={() => target && save.mutate({ shopId: target.shopId, rating, comment })} />
        <Btn label="Ahora no" kind="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}
