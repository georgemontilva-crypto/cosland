import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MessageCircle, Star } from "lucide-react";
import { formatPrice, orderStatusLabel } from "@shared/catalog";
import { trpc, timeAgo, type Out } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Loading, useToast } from "@/components/ui";
import { Photo } from "@/components/cards";
import { SupportModal } from "@/components/Support";

type Order = Out["order"]["mine"]["buying"][number];
type Action = "accept" | "reject" | "cancel" | "deliver" | "receive";

const TONE: Record<string, string> = {
  pending: "#f8e29c", accepted: "#bcdfee", delivered: "#d8cbf0", completed: "#cde4be", rejected: "#f3e6cb", cancelled: "#f3e6cb",
};
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

function OrderRow({ o, role, busy, act }: { o: Order; role: "buyer" | "seller"; busy: boolean; act: (a: Action, confirmText?: string) => void }) {
  const total = o.unitPriceCents != null ? formatPrice(o.unitPriceCents * o.quantity, o.deal ?? "venta") : "A convenir";
  return (
    <li className="soft p-3.5 flex gap-3.5">
      <Link href={`/p/${o.listingId}`} className="w-20 h-20 rounded-2xl overflow-hidden border-[1.5px] border-ink bg-oat shrink-0 block"><Photo src={o.image} alt="" accent={o.shopAccent} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="tag !border-ink/40" style={{ background: TONE[o.status] }}>{orderStatusLabel(o.status)}</span>
          <span className="text-sm text-cocoa">Pedido {timeAgo(o.createdAt)}</span>
        </div>
        <Link href={`/p/${o.listingId}`} className="font-extrabold leading-snug line-clamp-2 mt-1 block">{o.title}{o.quantity > 1 ? ` (${o.quantity} unidades)` : ""}</Link>
        <p className="text-sm mt-0.5">
          <span className="font-bold">{total}</span>
          <span className="text-cocoa"> {role === "buyer" ? <>a <Link href={`/v/${o.shopHandle}`} className="underline underline-offset-2">{o.shopName}</Link></> : `para ${o.buyerName}`}</span>
        </p>
        {o.note && role === "seller" && <p className="text-sm text-cocoa mt-1 line-clamp-2">Nota: {o.note}</p>}
        <p className="text-sm mt-1.5">{NEXT[role][o.status]}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {role === "seller" && o.status === "pending" && <button className="btn btn-sm btn-ink" disabled={busy} onClick={() => act("accept")}>Aceptar</button>}
          {role === "seller" && o.status === "pending" && <button className="btn btn-sm" disabled={busy} onClick={() => act("reject", "¿Rechazar este pedido?")}>Rechazar</button>}
          {role === "seller" && o.status === "accepted" && <button className="btn btn-sm btn-matcha" disabled={busy} onClick={() => act("deliver")}>Marcar entregado</button>}
          {role === "buyer" && o.status === "delivered" && <button className="btn btn-sm btn-ink" disabled={busy} onClick={() => act("receive")}>Ya lo recibí</button>}
          {role === "buyer" && o.status === "completed" && <Link href={`/v/${o.shopHandle}`} className="btn btn-sm btn-yuzu"><Star size={15} />Dejar reseña</Link>}
          {o.conversationId && <Link href={`/mensajes/${o.conversationId}`} className="btn btn-sm"><MessageCircle size={15} />Abrir chat</Link>}
          {((role === "buyer" && (o.status === "pending" || o.status === "accepted")) || (role === "seller" && o.status === "accepted")) && (
            <button className="btn btn-sm btn-ghost !text-berry" disabled={busy} onClick={() => act("cancel", "¿Cancelar este pedido?")}>Cancelar pedido</button>
          )}
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
  // Al abrir: si vende y tiene algo por atender, empieza en ventas; si no, en compras. Luego no se mueve sola.
  useEffect(() => {
    if (tab === null && q.data) setTab(q.data.selling.some((o) => o.status === "pending" || o.status === "accepted") ? "selling" : "buying");
  }, [q.data, tab]);
  const act = trpc.order.act.useMutation({
    onSuccess: (r, v) => {
      utils.order.invalidate(); utils.auth.me.invalidate(); utils.listing.invalidate(); utils.support.invalidate();
      toast({ accept: "Pedido aceptado", reject: "Pedido rechazado", cancel: "Pedido cancelado", deliver: "Marcado como entregado", receive: "¡Listo! Gracias por confirmar" }[v.action]);
      const sold = q.data?.selling.find((o) => o.id === v.id);
      if (r.contributionId) setOwed({ id: r.contributionId, title: sold?.title ?? "", amountCents: 100 * (sold?.quantity ?? 1) });
    },
    onError: (e) => { toast(e.message, true); utils.order.invalidate(); },
  });

  if (loading) return <Loading />;
  if (!me) return <div className="wrap py-14"><Empty title="Entra para ver tus pedidos" action={<Link href="/entrar?volver=/pedidos" className="btn btn-ink">Entrar a mi cuenta</Link>} /></div>;
  const data = q.data;
  const current = tab ?? "buying";
  const list = data ? data[current] : [];
  const toAnswer = data?.selling.filter((o) => o.status === "pending").length ?? 0;
  const toConfirm = data?.buying.filter((o) => o.status === "delivered").length ?? 0;

  return (
    <div className="wrap pt-6 md:pt-10 max-w-3xl">
      <h1 className="text-3xl md:text-4xl">Pedidos</h1>
      <p className="text-cocoa mt-2">Cada pedido deja registrada la venta. El pago y la entrega se acuerdan en el chat, directo entre las dos personas.</p>
      {data?.hasShop && (
        <div className="scroll-row mt-5">
          <button className="chip" aria-pressed={current === "buying"} onClick={() => setTab("buying")}>Mis compras{toConfirm ? ` (${toConfirm})` : ""}</button>
          <button className="chip" aria-pressed={current === "selling"} onClick={() => setTab("selling")}>Mis ventas{toAnswer ? ` (${toAnswer})` : ""}</button>
        </div>
      )}
      <div className="mt-5">
        {q.isLoading || tab === null ? <Loading /> : !list.length ? (
          current === "selling"
            ? <Empty title="Aún no tienes ventas">Cuando alguien toque "Lo quiero" en una de tus publicaciones, el pedido aparece aquí.</Empty>
            : <Empty title="Aún no has pedido nada" action={<Link href="/explorar" className="btn btn-sakura">Explorar</Link>}>Toca "Lo quiero" en una publicación para pedirla.</Empty>
        ) : (
          <ul className="grid gap-3">
            {list.map((o) => (
              <OrderRow key={o.id} o={o} role={current === "selling" ? "seller" : "buyer"} busy={act.isPending}
                act={(action, confirmText) => { if (!confirmText || confirm(confirmText)) act.mutate({ id: o.id, action }); }} />
            ))}
          </ul>
        )}
      </div>
      {owed && <SupportModal id={owed.id} title={owed.title} amountCents={owed.amountCents} onClose={() => setOwed(null)} />}
    </div>
  );
}
