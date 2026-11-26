import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MessageCircle, Star, HeartHandshake } from "lucide-react";
import { formatPrice, orderStatusLabel } from "@shared/catalog";
import { trpc, timeAgo, type Out } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Loading, Modal, useToast } from "@/components/ui";
import { Photo } from "@/components/cards";
import { SupportModal } from "@/components/Support";
import PushCard from "@/components/PushCard";
import { PayForm, ReviewModal } from "@/components/Checkout";

type Order = Out["order"]["mine"]["buying"][number];
type Action = "accept" | "reject" | "cancel" | "confirmPay" | "deliver" | "receive";
type Role = "buyer" | "seller";

// Estado en una etiqueta: junta en qué va el pedido y en qué va el pago
export function orderState(o: Pick<Order, "status" | "payStatus">): { label: string; tone: string } {
  if (o.status === "accepted") {
    if (o.payStatus === "unpaid") return { label: "Por pagar", tone: "#f8e29c" };
    if (o.payStatus === "reported") return { label: "Pago por confirmar", tone: "#fad0b5" };
    if (o.payStatus === "confirmed") return { label: "Pagado, por entregar", tone: "#bcdfee" };
    return { label: "Por entregar", tone: "#bcdfee" };
  }
  const tone: Record<string, string> = { pending: "#f8e29c", delivered: "#d8cbf0", completed: "#cde4be", rejected: "#f3e6cb", cancelled: "#f3e6cb" };
  return { label: orderStatusLabel(o.status), tone: tone[o.status] ?? "#f3e6cb" };
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

function OrderRow({ o, role, busy, act, onPay, onReview, onDue }: { o: Order; role: Role; busy: boolean; act: (a: Action, confirmText?: string) => void; onPay: () => void; onReview: () => void; onDue: () => void }) {
  const total = o.unitPriceCents != null ? formatPrice(o.unitPriceCents * o.quantity, o.deal ?? "venta") : "A convenir";
  const st = orderState(o);
  const seller = role === "seller", open = o.status === "accepted";
  const canCancel = (open && seller) || (open && !seller && (o.payStatus === "unpaid" || o.payStatus === "on_delivery")) || (o.status === "pending" && !seller);
  return (
    <li className="soft p-3.5 flex gap-3.5">
      <Link href={`/p/${o.listingId}`} className="w-20 h-20 rounded-2xl overflow-hidden border-[1.5px] border-ink bg-oat shrink-0 block"><Photo src={o.image} alt="" accent={o.shopAccent} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="tag !border-ink/40" style={{ background: st.tone }}>{st.label}</span>
          <span className="text-sm text-cocoa">{timeAgo(o.createdAt)}</span>
        </div>
        <Link href={`/p/${o.listingId}`} className="font-extrabold leading-snug line-clamp-2 mt-1">{o.title}{o.quantity > 1 ? ` (${o.quantity} unidades)` : ""}</Link>
        <p className="text-sm mt-0.5">
          <span className="font-bold">{total}</span>
          <span className="text-cocoa"> {seller ? `para ${o.buyerName}` : <>a <Link href={`/v/${o.shopHandle}`} className="underline underline-offset-2">{o.shopName}</Link></>}</span>
        </p>
        {o.payLabel && <p className="text-sm text-cocoa">Pago: {o.payLabel}{o.payReference ? `. Referencia: ${o.payReference}` : ""}{o.payProofUrl ? <>. <a href={o.payProofUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-bold text-ink">Ver comprobante</a></> : null}</p>}
        {o.note && seller && <p className="text-sm text-cocoa mt-1 line-clamp-2">Nota: {o.note}</p>}
        <p className="text-sm mt-1.5">{next(o, role)}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {!seller && open && o.payStatus === "unpaid" && <button className="btn btn-sm btn-ink" onClick={onPay}>Pagar ahora</button>}
          {seller && open && (o.payStatus === "reported" || o.payStatus === "unpaid") && <button className={`btn btn-sm ${o.payStatus === "reported" ? "btn-ink" : ""}`} disabled={busy} onClick={() => act("confirmPay")}>Confirmar pago</button>}
          {seller && open && o.payStatus !== "unpaid" && <button className={`btn btn-sm ${o.payStatus === "reported" ? "" : "btn-matcha"}`} disabled={busy} onClick={() => act("deliver")}>Marcar entregado</button>}
          {seller && o.status === "pending" && <button className="btn btn-sm btn-ink" disabled={busy} onClick={() => act("accept")}>Aceptar</button>}
          {seller && o.status === "pending" && <button className="btn btn-sm" disabled={busy} onClick={() => act("reject", "¿Rechazar este pedido?")}>Rechazar</button>}
          {!seller && o.status === "delivered" && <button className="btn btn-sm btn-ink" disabled={busy} onClick={() => act("receive")}>Ya lo recibí</button>}
          {!seller && o.status === "completed" && !o.reviewed && <button className="btn btn-sm btn-yuzu" onClick={onReview}><Star size={15} />Dejar reseña</button>}
          {seller && o.due && <button className="btn btn-sm btn-matcha" onClick={onDue}><HeartHandshake size={15} />Enviar {formatPrice(o.due.amountCents)} a Cosland</button>}
          {o.conversationId && <Link href={`/mensajes/${o.conversationId}`} className="btn btn-sm"><MessageCircle size={15} />Chat</Link>}
          {canCancel && <button className="btn btn-sm btn-ghost !text-berry" disabled={busy} onClick={() => act("cancel", "¿Cancelar este pedido?")}>Cancelar</button>}
        </div>
      </div>
    </li>
  );
}

export default function Orders() {
  const { me, loading } = useMe();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.order.mine.useQuery(undefined, { enabled: Boolean(me) });
  const [tab, setTab] = useState<"buying" | "selling" | null>(null);
  const [owed, setOwed] = useState<null | { id: number; title: string; amountCents: number }>(null);
  const [paying, setPaying] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<null | { shopId: number; shopName: string }>(null);
  // Al abrir: si vende y tiene algo por atender, empieza en ventas; si no, en compras. Luego no se mueve sola.
  useEffect(() => {
    if (tab === null && q.data) setTab(q.data.selling.some((o) => o.status === "pending" || o.status === "accepted") ? "selling" : "buying");
  }, [q.data, tab]);
  const act = trpc.order.act.useMutation({
    onSuccess: (r, v) => {
      utils.order.invalidate(); utils.auth.me.invalidate(); utils.listing.invalidate(); utils.support.invalidate(); utils.shop.invalidate();
      const said: Record<Action, string> = { accept: "Pedido aceptado", reject: "Pedido rechazado", cancel: "Pedido cancelado", confirmPay: "Pago confirmado", deliver: "Marcado como entregado", receive: "¡Listo! Gracias por confirmar" };
      toast(said[v.action]);
      const sold = q.data?.selling.find((o) => o.id === v.id);
      if (r.contributionId) setOwed({ id: r.contributionId, title: sold?.title ?? "", amountCents: r.contributionCents ?? 100 });
      // Al confirmar que llegó, se pide la reseña de una vez
      const got = q.data?.buying.find((o) => o.id === v.id);
      if (v.action === "receive" && got && !got.reviewed) setReviewing({ shopId: got.shopId, shopName: got.shopName });
    },
    onError: (e) => { toast(e.message, true); utils.order.invalidate(); },
  });

  if (loading) return <Loading />;
  if (!me) return <div className="wrap py-14"><Empty title="Entra para ver tus pedidos" action={<Link href="/entrar?volver=/pedidos" className="btn btn-ink">Entrar a mi cuenta</Link>} /></div>;
  const data = q.data;
  const current = tab ?? "buying";
  const list = data ? data[current] : [];
  const toDo = (xs: Order[], seller: boolean) => xs.filter((o) => (seller ? o.status === "pending" || (o.status === "accepted" && o.payStatus !== "unpaid") : o.status === "delivered" || (o.status === "accepted" && o.payStatus === "unpaid"))).length;
  const sellN = data ? toDo(data.selling, true) : 0, buyN = data ? toDo(data.buying, false) : 0;
  const payOrder = paying ? data?.buying.find((o) => o.id === paying) : null;

  return (
    <div className="wrap pt-6 md:pt-10 max-w-3xl">
      <h1 className="text-3xl md:text-4xl">Pedidos</h1>
      <p className="text-cocoa mt-2">Tus compras y tus ventas. El pago va directo al vendedor y la entrega se cuadra por el chat.</p>
      <PushCard className="mt-5" />
      {data?.hasShop && (
        <div className="scroll-row mt-5">
          <button className="chip" aria-pressed={current === "buying"} onClick={() => setTab("buying")}>Mis compras{buyN ? ` (${buyN})` : ""}</button>
          <button className="chip" aria-pressed={current === "selling"} onClick={() => setTab("selling")}>Mis ventas{sellN ? ` (${sellN})` : ""}</button>
        </div>
      )}
      <div className="mt-5">
        {q.isLoading || tab === null ? <Loading /> : !list.length ? (
          current === "selling"
            ? <Empty title="Aún no tienes ventas">Cuando alguien compre una de tus publicaciones, el pedido aparece aquí.</Empty>
            : <Empty title="Aún no has comprado nada" action={<Link href="/explorar" className="btn btn-sakura">Explorar</Link>}>Toca "Comprar" en una publicación y aparece aquí.</Empty>
        ) : (
          <ul className="grid gap-3">
            {list.map((o) => (
              <OrderRow key={o.id} o={o} role={current === "selling" ? "seller" : "buyer"} busy={act.isPending}
                onPay={() => setPaying(o.id)} onDue={() => o.due && setOwed({ id: o.due.id, title: o.title, amountCents: o.due.amountCents })} onReview={() => setReviewing({ shopId: o.shopId, shopName: o.shopName })}
                act={(action, confirmText) => { if (!confirmText || confirm(confirmText)) act.mutate({ id: o.id, action }); }} />
            ))}
          </ul>
        )}
      </div>
      {owed && <SupportModal id={owed.id} title={owed.title} amountCents={owed.amountCents} onClose={() => setOwed(null)} />}
      {payOrder && (
        <Modal title="Paga tu compra" onClose={() => setPaying(null)}>
          <PayForm orderId={payOrder.id} label={payOrder.payLabel ?? ""} details={payOrder.payDetails}
            total={payOrder.unitPriceCents != null ? formatPrice(payOrder.unitPriceCents * payOrder.quantity, payOrder.deal ?? "venta") : "el monto acordado"}
            onDone={() => setPaying(null)} />
        </Modal>
      )}
      {reviewing && <ReviewModal shopId={reviewing.shopId} shopName={reviewing.shopName} onClose={() => setReviewing(null)} />}
    </div>
  );
}
