import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle, Star, HeartHandshake } from "lucide-react-native";
import { formatPrice, orderStatusLabel } from "@shared/catalog";
import { errText, img, trpc, timeAgo, type Out } from "@/lib/api";
import { openExternal } from "@/lib/actions";
import { requireLogin, useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Btn, Chip, Empty, Loading, Photo, Screen, Sheet, T, Tag, soft, useToast } from "@/ui/core";
import { PayForm, ReviewSheet } from "@/ui/Checkout";
import { SupportSheet, type Owed } from "@/ui/Support";

type Order = Out["order"]["mine"]["buying"][number];
type Action = "accept" | "reject" | "cancel" | "confirmPay" | "deliver" | "receive";
type Role = "buyer" | "seller";

// Estado en una etiqueta: junta en qué va el pedido y en qué va el pago
function orderState(o: Pick<Order, "status" | "payStatus">): { label: string; tone: string } {
  if (o.status === "accepted") {
    if (o.payStatus === "unpaid") return { label: "Por pagar", tone: C.yuzu };
    if (o.payStatus === "reported") return { label: "Pago por confirmar", tone: C.momo };
    if (o.payStatus === "confirmed") return { label: "Pagado, por entregar", tone: C.ramune };
    return { label: "Por entregar", tone: C.ramune };
  }
  const tone: Record<string, string> = { pending: C.yuzu, delivered: C.fuji, completed: C.matcha, rejected: C.oat, cancelled: C.oat };
  return { label: orderStatusLabel(o.status), tone: tone[o.status] ?? C.oat };
}

// Qué sigue, dicho para quien lo lee
function next(o: Order, role: Role): string {
  const buyer = role === "buyer";
  if (o.status === "accepted") {
    if (o.payStatus === "unpaid") return buyer ? "Paga y avisa con la referencia o el comprobante." : "Esperando que el comprador pague.";
    if (o.payStatus === "reported") return buyer ? "El vendedor está revisando tu pago." : "Revisa que el pago te llegó y confírmalo.";
    if (o.payStatus === "confirmed") return buyer ? "Pago confirmado. Cuadra la entrega por el chat." : "Pago confirmado. Cuadra la entrega por el chat y márcalo al entregar.";
    return buyer ? "Pagas al recibir. Cuadra la entrega por el chat." : "Te paga al recibir. Cuadra la entrega por el chat y márcalo al entregar.";
  }
  if (o.status === "delivered") return buyer ? "El vendedor lo marcó como entregado. Confirma cuando lo tengas." : "Entregado. Falta que el comprador confirme que lo recibió.";
  if (o.status === "completed") return buyer ? (o.reviewed ? "Recibido. Gracias por tu compra." : "Recibido. Déjale una reseña a la vitrina.") : "Venta cerrada: el comprador confirmó que lo recibió.";
  if (o.status === "pending") return buyer ? "Esperando que el vendedor lo acepte." : "Acéptalo si lo tienes disponible.";
  if (o.status === "rejected") return buyer ? "El vendedor no pudo atenderlo." : "Lo rechazaste.";
  return "Pedido cancelado.";
}

function Row({ o, role, busy, act, onPay, onReview, onDue }: { o: Order; role: Role; busy: boolean; act: (a: Action) => void; onPay: () => void; onReview: () => void; onDue: () => void }) {
  const total = o.unitPriceCents != null ? formatPrice(o.unitPriceCents * o.quantity, o.deal ?? "venta") : "A convenir";
  const st = orderState(o);
  const seller = role === "seller", open = o.status === "accepted";
  const canCancel = (open && seller) || (open && !seller && (o.payStatus === "unpaid" || o.payStatus === "on_delivery")) || (o.status === "pending" && !seller);
  const proof = img(o.payProofUrl);
  return (
    <View style={[soft, { padding: 12, flexDirection: "row", gap: 12 }]}>
      <Pressable accessibilityRole="link" accessibilityLabel={o.title} onPress={() => router.push(`/p/${o.listingId}`)} style={{ width: 74, height: 74, borderRadius: 18, overflow: "hidden", borderWidth: BORDER, borderColor: C.ink }}>
        <Photo src={o.image} accent={o.shopAccent} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Tag label={st.label} bg={st.tone} />
          <T size={13} color={C.cocoa}>{timeAgo(o.createdAt)}</T>
        </View>
        <T w="black" numberOfLines={2}>{o.title}{o.quantity > 1 ? ` (${o.quantity} unidades)` : ""}</T>
        <T size={14}><T w="bold" size={14}>{total}</T><T size={14} color={C.cocoa}> {seller ? `para ${o.buyerName}` : `a ${o.shopName}`}</T></T>
        {o.payLabel ? <T size={13.5} color={C.cocoa}>Pago: {o.payLabel}{o.payReference ? `. Referencia: ${o.payReference}` : ""}</T> : null}
        {proof ? <Pressable accessibilityRole="link" onPress={() => openExternal(proof)} hitSlop={6}><T size={13.5} w="bold" style={{ textDecorationLine: "underline" }}>Ver comprobante</T></Pressable> : null}
        {o.note && seller ? <T size={13.5} color={C.cocoa} numberOfLines={2}>Nota: {o.note}</T> : null}
        <T size={14}>{next(o, role)}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {!seller && open && o.payStatus === "unpaid" && <Btn small kind="ink" label="Pagar ahora" onPress={onPay} />}
          {seller && open && (o.payStatus === "reported" || o.payStatus === "unpaid") && <Btn small kind={o.payStatus === "reported" ? "ink" : "paper"} label="Confirmar pago" disabled={busy} onPress={() => act("confirmPay")} />}
          {seller && open && o.payStatus !== "unpaid" && <Btn small kind={o.payStatus === "reported" ? "paper" : "matcha"} label="Marcar entregado" disabled={busy} onPress={() => act("deliver")} />}
          {seller && o.status === "pending" && <Btn small kind="ink" label="Aceptar" disabled={busy} onPress={() => act("accept")} />}
          {seller && o.status === "pending" && <Btn small label="Rechazar" disabled={busy} onPress={() => act("reject")} />}
          {!seller && o.status === "delivered" && <Btn small kind="ink" label="Ya lo recibí" disabled={busy} onPress={() => act("receive")} />}
          {!seller && o.status === "completed" && !o.reviewed && <Btn small kind="yuzu" label="Dejar reseña" icon={<Star size={14} color={C.ink} />} onPress={onReview} />}
          {seller && o.due ? <Btn small kind="matcha" label={`Enviar ${formatPrice(o.due.amountCents)} a Cosland`} icon={<HeartHandshake size={14} color={C.ink} />} onPress={onDue} /> : null}
          {o.conversationId ? <Btn small label="Chat" icon={<MessageCircle size={14} color={C.ink} />} onPress={() => router.push(`/mensajes/${o.conversationId}`)} /> : null}
          {canCancel && <Btn small kind="ghost" label="Cancelar" disabled={busy} onPress={() => act("cancel")} />}
        </View>
      </View>
    </View>
  );
}

export default function Orders() {
  const { me, loading } = useSession();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.order.mine.useQuery(undefined, { enabled: Boolean(me) });
  const [tab, setTab] = useState<"buying" | "selling" | null>(null);
  const [asking, setAsking] = useState<null | { id: number; action: Action; title: string }>(null);
  const [paying, setPaying] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<null | { shopId: number; shopName: string }>(null);
  const [owed, setOwed] = useState<Owed | null>(null);
  // Al abrir: si vende y tiene algo por atender, empieza en ventas; si no, en compras. Luego no se mueve sola.
  useEffect(() => {
    if (tab === null && q.data) setTab(q.data.selling.some((o) => o.status === "pending" || o.status === "accepted") ? "selling" : "buying");
  }, [q.data, tab]);
  const act = trpc.order.act.useMutation({
    onSuccess: (r, v) => {
      utils.order.invalidate(); utils.auth.me.invalidate(); utils.listing.invalidate(); utils.shop.invalidate(); utils.support.invalidate(); setAsking(null);
      const said: Record<Action, string> = { accept: "Pedido aceptado", reject: "Pedido rechazado", cancel: "Pedido cancelado", confirmPay: "Pago confirmado", deliver: "Marcado como entregado", receive: "¡Listo! Gracias por confirmar" };
      toast(said[v.action]);
      // Con el pago en mano, el vendedor ve a dónde enviar el dólar de Cosland
      const sold = q.data?.selling.find((o) => o.id === v.id);
      if (r.contributionId) setOwed({ id: r.contributionId, title: sold?.title, amountCents: 100 * (sold?.quantity ?? 1) });
      // Al confirmar que llegó, se pide la reseña de una vez
      const got = q.data?.buying.find((o) => o.id === v.id);
      if (v.action === "receive" && got && !got.reviewed) setReviewing({ shopId: got.shopId, shopName: got.shopName });
    },
    onError: (e) => { toast(errText(e), true); utils.order.invalidate(); setAsking(null); },
  });

  if (loading) return <Screen title="Pedidos"><Loading /></Screen>;
  if (!me) return <Screen title="Pedidos"><Empty title="Entra para ver tus pedidos" action={<Btn label="Entrar a mi cuenta" kind="ink" onPress={() => requireLogin("/pedidos")} />} /></Screen>;
  const data = q.data, current = tab ?? "buying";
  const list = data ? data[current] : [];
  const toDo = (xs: Order[], seller: boolean) => xs.filter((o) => (seller ? o.status === "pending" || (o.status === "accepted" && o.payStatus !== "unpaid") : o.status === "delivered" || (o.status === "accepted" && o.payStatus === "unpaid"))).length;
  const sellN = data ? toDo(data.selling, true) : 0, buyN = data ? toDo(data.buying, false) : 0;
  // Rechazar y cancelar piden confirmación; lo demás va directo
  const run = (o: Order, action: Action) => (action === "reject" || action === "cancel" ? setAsking({ id: o.id, action, title: o.title }) : act.mutate({ id: o.id, action }));
  const payOrder = paying ? data?.buying.find((o) => o.id === paying) : null;

  return (
    <Screen title="Pedidos">
      <T color={C.cocoa}>Tus compras y tus ventas. El pago va directo al vendedor y la entrega se cuadra por el chat.</T>
      {data?.hasShop ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          <Chip label={`Mis compras${buyN ? ` (${buyN})` : ""}`} on={current === "buying"} onPress={() => setTab("buying")} />
          <Chip label={`Mis ventas${sellN ? ` (${sellN})` : ""}`} on={current === "selling"} onPress={() => setTab("selling")} />
        </ScrollView>
      ) : <View style={{ height: 14 }} />}
      {q.isLoading || tab === null ? <Loading /> : !list.length ? (
        current === "selling"
          ? <Empty title="Aún no tienes ventas" text="Cuando alguien compre una de tus publicaciones, el pedido aparece aquí." />
          : <Empty title="Aún no has comprado nada" text={'Toca "Comprar" en una publicación y aparece aquí.'} action={<Btn label="Explorar" kind="sakura" onPress={() => router.push("/explorar")} />} />
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((o) => <Row key={o.id} o={o} role={current === "selling" ? "seller" : "buyer"} busy={act.isPending} act={(a) => run(o, a)}
            onPay={() => setPaying(o.id)} onDue={() => o.due && setOwed({ id: o.due.id, title: o.title, amountCents: o.due.amountCents })} onReview={() => setReviewing({ shopId: o.shopId, shopName: o.shopName })} />)}
        </View>
      )}
      <Sheet open={Boolean(asking)} onClose={() => setAsking(null)} title={asking?.action === "reject" ? "¿Rechazar este pedido?" : "¿Cancelar este pedido?"}>
        <View style={{ gap: 14 }}>
          <T>{asking?.title}</T>
          <Btn label={asking?.action === "reject" ? "Sí, rechazar" : "Sí, cancelar"} kind="danger" busy={act.isPending} onPress={() => asking && act.mutate({ id: asking.id, action: asking.action })} />
          <Btn label="Volver" onPress={() => setAsking(null)} />
        </View>
      </Sheet>
      <Sheet open={Boolean(payOrder)} onClose={() => setPaying(null)} title="Paga tu compra">
        {payOrder ? (
          <PayForm orderId={payOrder.id} label={payOrder.payLabel ?? ""} details={payOrder.payDetails}
            total={payOrder.unitPriceCents != null ? formatPrice(payOrder.unitPriceCents * payOrder.quantity, payOrder.deal ?? "venta") : "el monto acordado"}
            onDone={() => setPaying(null)} />
        ) : null}
      </Sheet>
      <ReviewSheet target={reviewing} onClose={() => setReviewing(null)} />
      <SupportSheet owed={owed} onClose={() => setOwed(null)} />
    </Screen>
  );
}
