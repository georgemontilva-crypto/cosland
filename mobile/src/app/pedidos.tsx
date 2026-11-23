import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle, Star } from "lucide-react-native";
import { formatPrice, orderStatusLabel } from "@shared/catalog";
import { errText, trpc, timeAgo, type Out } from "@/lib/api";
import { requireLogin, useSession } from "@/lib/session";
import { BORDER, C } from "@/lib/theme";
import { Btn, Chip, Empty, Loading, Photo, Screen, Sheet, T, Tag, soft, useToast } from "@/ui/core";

type Order = Out["order"]["mine"]["buying"][number];
type Action = "accept" | "reject" | "cancel" | "deliver" | "receive";

const TONE: Record<string, string> = { pending: C.yuzu, accepted: C.ramune, delivered: C.fuji, completed: C.matcha, rejected: C.oat, cancelled: C.oat };
// Qué sigue, dicho para quien lo lee
const NEXT: Record<"buyer" | "seller", Record<string, string>> = {
  buyer: {
    pending: "Esperando que el vendedor lo acepte.", accepted: "Aceptado. Acuerda el pago y la entrega en el chat.",
    delivered: "El vendedor lo marcó como entregado. Confirma cuando lo tengas.", completed: "Recibido. Puedes dejarle una reseña a la vitrina.",
    rejected: "El vendedor no pudo atenderlo.", cancelled: "Pedido cancelado.",
  },
  seller: {
    pending: "Acéptalo si lo tienes disponible.", accepted: "Acuerda el pago y la entrega en el chat. Márcalo cuando lo entregues.",
    delivered: "Entregado. Falta que el comprador confirme que lo recibió.", completed: "Venta cerrada: el comprador confirmó que lo recibió.",
    rejected: "Lo rechazaste.", cancelled: "Pedido cancelado.",
  },
};

function Row({ o, role, busy, act }: { o: Order; role: "buyer" | "seller"; busy: boolean; act: (a: Action) => void }) {
  const total = o.unitPriceCents != null ? formatPrice(o.unitPriceCents * o.quantity, o.deal ?? "venta") : "A convenir";
  const canCancel = (role === "buyer" && (o.status === "pending" || o.status === "accepted")) || (role === "seller" && o.status === "accepted");
  return (
    <View style={[soft, { padding: 12, flexDirection: "row", gap: 12 }]}>
      <Pressable accessibilityRole="link" accessibilityLabel={o.title} onPress={() => router.push(`/p/${o.listingId}`)} style={{ width: 74, height: 74, borderRadius: 18, overflow: "hidden", borderWidth: BORDER, borderColor: C.ink }}>
        <Photo src={o.image} accent={o.shopAccent} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Tag label={orderStatusLabel(o.status)} bg={TONE[o.status]} />
          <T size={13} color={C.cocoa}>Pedido {timeAgo(o.createdAt)}</T>
        </View>
        <T w="black" numberOfLines={2}>{o.title}{o.quantity > 1 ? ` (${o.quantity} unidades)` : ""}</T>
        <T size={14}><T w="bold" size={14}>{total}</T><T size={14} color={C.cocoa}> {role === "buyer" ? `a ${o.shopName}` : `para ${o.buyerName}`}</T></T>
        {o.note && role === "seller" ? <T size={13.5} color={C.cocoa} numberOfLines={2}>Nota: {o.note}</T> : null}
        <T size={14}>{NEXT[role][o.status]}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {role === "seller" && o.status === "pending" && <Btn small kind="ink" label="Aceptar" disabled={busy} onPress={() => act("accept")} />}
          {role === "seller" && o.status === "pending" && <Btn small label="Rechazar" disabled={busy} onPress={() => act("reject")} />}
          {role === "seller" && o.status === "accepted" && <Btn small kind="matcha" label="Marcar entregado" disabled={busy} onPress={() => act("deliver")} />}
          {role === "buyer" && o.status === "delivered" && <Btn small kind="ink" label="Ya lo recibí" disabled={busy} onPress={() => act("receive")} />}
          {role === "buyer" && o.status === "completed" && <Btn small kind="yuzu" label="Dejar reseña" icon={<Star size={14} color={C.ink} />} onPress={() => router.push(`/v/${o.shopHandle}`)} />}
          {o.conversationId ? <Btn small label="Abrir chat" icon={<MessageCircle size={14} color={C.ink} />} onPress={() => router.push(`/mensajes/${o.conversationId}`)} /> : null}
          {canCancel && <Btn small kind="ghost" label="Cancelar pedido" disabled={busy} onPress={() => act("cancel")} />}
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
  // Al abrir: si vende y tiene algo por atender, empieza en ventas; si no, en compras. Luego no se mueve sola.
  useEffect(() => {
    if (tab === null && q.data) setTab(q.data.selling.some((o) => o.status === "pending" || o.status === "accepted") ? "selling" : "buying");
  }, [q.data, tab]);
  const act = trpc.order.act.useMutation({
    onSuccess: (_r, v) => {
      utils.order.invalidate(); utils.auth.me.invalidate(); utils.listing.invalidate(); setAsking(null);
      toast({ accept: "Pedido aceptado", reject: "Pedido rechazado", cancel: "Pedido cancelado", deliver: "Marcado como entregado", receive: "¡Listo! Gracias por confirmar" }[v.action]);
    },
    onError: (e) => { toast(errText(e), true); utils.order.invalidate(); setAsking(null); },
  });

  if (loading) return <Screen title="Pedidos"><Loading /></Screen>;
  if (!me) return <Screen title="Pedidos"><Empty title="Entra para ver tus pedidos" action={<Btn label="Entrar a mi cuenta" kind="ink" onPress={() => requireLogin("/pedidos")} />} /></Screen>;
  const data = q.data, current = tab ?? "buying";
  const list = data ? data[current] : [];
  const toAnswer = data?.selling.filter((o) => o.status === "pending").length ?? 0;
  const toConfirm = data?.buying.filter((o) => o.status === "delivered").length ?? 0;
  // Rechazar y cancelar piden confirmación; lo demás va directo
  const run = (o: Order, action: Action) => (action === "reject" || action === "cancel" ? setAsking({ id: o.id, action, title: o.title }) : act.mutate({ id: o.id, action }));

  return (
    <Screen title="Pedidos">
      <T color={C.cocoa}>Cada pedido deja registrada la venta. El pago y la entrega se acuerdan en el chat, directo entre las dos personas.</T>
      {data?.hasShop ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          <Chip label={`Mis compras${toConfirm ? ` (${toConfirm})` : ""}`} on={current === "buying"} onPress={() => setTab("buying")} />
          <Chip label={`Mis ventas${toAnswer ? ` (${toAnswer})` : ""}`} on={current === "selling"} onPress={() => setTab("selling")} />
        </ScrollView>
      ) : <View style={{ height: 14 }} />}
      {q.isLoading || tab === null ? <Loading /> : !list.length ? (
        current === "selling"
          ? <Empty title="Aún no tienes ventas" text={'Cuando alguien toque "Lo quiero" en una de tus publicaciones, el pedido aparece aquí.'} />
          : <Empty title="Aún no has pedido nada" text={'Toca "Lo quiero" en una publicación para pedirla.'} action={<Btn label="Explorar" kind="sakura" onPress={() => router.push("/explorar")} />} />
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((o) => <Row key={o.id} o={o} role={current === "selling" ? "seller" : "buyer"} busy={act.isPending} act={(a) => run(o, a)} />)}
        </View>
      )}
      <Sheet open={Boolean(asking)} onClose={() => setAsking(null)} title={asking?.action === "reject" ? "¿Rechazar este pedido?" : "¿Cancelar este pedido?"}>
        <View style={{ gap: 14 }}>
          <T>{asking?.title}</T>
          <Btn label={asking?.action === "reject" ? "Sí, rechazar" : "Sí, cancelar"} kind="danger" busy={act.isPending} onPress={() => asking && act.mutate({ id: asking.id, action: asking.action })} />
          <Btn label="Volver" onPress={() => setAsking(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}
