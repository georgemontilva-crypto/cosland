import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Copy, HandCoins, Minus, Plus, Star, Wallet } from "lucide-react";
import { PAY_ON_DELIVERY, formatPrice, hasStock, sellerLevel } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { SinglePhoto } from "./ImageUploader";
import { Field, Modal, Stars, useToast } from "./ui";

type PayOptions = { methods: { id: number; type: string; label: string }[]; onDelivery: boolean };
type Item = { id: number; title: string; priceCents: number | null; deal: string; kind: string; stock: number; pay: PayOptions };
export const canBuy = (pay: PayOptions) => pay.methods.length > 0 || pay.onDelivery;

// Reputación de una vitrina: puntaje, reseñas, ventas concretadas y nivel
export function Reputation({ rating, reviewCount, sales, size = 14, level = true }: { rating: number; reviewCount: number; sales: number; size?: number; level?: boolean }) {
  const lv = level ? sellerLevel(sales, rating, reviewCount) : null;
  if (!reviewCount && !sales && !lv) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {reviewCount > 0 && <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Stars value={rating} size={size} />{rating.toFixed(1)} ({reviewCount})</span>}
      {sales > 0 && <span className="whitespace-nowrap font-bold text-ink">{sales} {sales === 1 ? "venta" : "ventas"}</span>}
      {lv && <span className="tag" style={{ background: lv.tone }}>{lv.label}</span>}
    </span>
  );
}

// Datos para pagar (con botón de copiar) y aviso de "ya pagué" con referencia o comprobante
export function PayForm({ orderId, label, details, total, onDone, later }: { orderId: number; label: string; details: string | null; total: string; onDone: () => void; later?: () => void }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pay = trpc.order.pay.useMutation({
    onSuccess: () => { utils.order.invalidate(); utils.auth.me.invalidate(); toast("Listo. El vendedor confirmará tu pago."); onDone(); },
    onError: (e) => setError(e.message),
  });
  const copy = async () => { try { await navigator.clipboard.writeText(details ?? ""); toast("Datos copiados"); } catch { toast("No se pudo copiar. Mantén presionado el texto para copiarlo.", true); } };
  return (
    <div>
      <p>Paga <b>{total}</b> por <b>{label}</b> a estos datos:</p>
      <div className="mt-3 rounded-[1.4rem] bg-paper border-[1.5px] border-ink p-4">
        {details ? (
          <>
            <p className="whitespace-pre-line font-bold select-all">{details}</p>
            <button type="button" className="btn btn-sm mt-3" onClick={copy}><Copy size={15} />Copiar datos</button>
          </>
        ) : <p className="text-cocoa">El vendedor cambió este método de pago. Escríbele por el chat para que te pase los datos.</p>}
      </div>
      <form className="grid gap-4 mt-5" onSubmit={(e) => { e.preventDefault(); setError(""); pay.mutate({ id: orderId, reference: reference.trim() || null, proofUrl: proof }); }}>
        <Field label="Número de referencia"><input className="input" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} inputMode="text" /></Field>
        <div><span className="field-label">Comprobante</span><SinglePhoto value={proof} onChange={setProof} label="Subir comprobante" /><p className="field-hint">Con la referencia o con la captura alcanza.</p></div>
        {error && <p role="alert" className="font-bold text-berry">{error}</p>}
        <button className="btn btn-ink" style={{ minHeight: "3.25rem" }} disabled={pay.isPending}><Check size={18} />{pay.isPending ? "Enviando…" : "Ya pagué"}</button>
      </form>
      {later && <button className="mt-3 w-full text-center underline underline-offset-4 font-bold" onClick={later}>Pagar después</button>}
    </div>
  );
}

// Comprar: cantidad, forma de pago y listo. Si eligió pagar ya, sigue con los datos del vendedor.
export default function CheckoutModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const stocked = hasStock(item.kind, item.deal);
  const max = stocked ? Math.max(1, item.stock) : 1;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [pay, setPay] = useState<number | "delivery" | null>(item.pay.methods[0]?.id ?? (item.pay.onDelivery ? "delivery" : null));
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<null | { orderId: number; conversationId: number | null }>(null);
  const mine = trpc.order.mine.useQuery(undefined, { enabled: Boolean(paying) });
  const refresh = () => { utils.order.invalidate(); utils.auth.me.invalidate(); utils.listing.byId.invalidate({ id: item.id }); utils.chat.invalidate(); };
  const toChat = (conversationId: number | null) => { onClose(); go(conversationId ? `/mensajes/${conversationId}` : "/pedidos"); };
  const create = trpc.order.create.useMutation({
    onSuccess: (r) => {
      refresh();
      if (r.toPay) { setPaying({ orderId: r.id, conversationId: r.conversationId }); return; }
      toast(r.existing ? "Ya tenías este pedido en curso" : "¡Compra hecha! Cuadra la entrega con el vendedor.");
      toChat(r.conversationId);
    },
    onError: (e) => setError(e.message),
  });
  const service = item.kind === "service";
  const total = item.priceCents != null ? formatPrice(item.priceCents * qty, item.deal) : "el monto acordado";

  if (paying) {
    const order = mine.data?.buying.find((o) => o.id === paying.orderId);
    return (
      <Modal title="Paga tu compra" onClose={() => toChat(paying.conversationId)}>
        {!order ? <p className="text-cocoa">Cargando los datos de pago…</p> : (
          <PayForm orderId={order.id} label={order.payLabel ?? ""} details={order.payDetails} total={total}
            onDone={() => toChat(paying.conversationId)} later={() => { toast("Tu compra quedó guardada. Págala desde Pedidos."); toChat(paying.conversationId); }} />
        )}
      </Modal>
    );
  }

  const option = (value: number | "delivery", label: string, hint: string, icon: React.ReactNode) => (
    <label key={String(value)} className={`flex items-center gap-3 rounded-[1.3rem] border-[1.5px] p-3.5 cursor-pointer ${pay === value ? "border-ink bg-paper" : "border-ink/25"}`}>
      <input type="radio" name="pago" className="w-5 h-5 accent-[#2a211c] shrink-0" checked={pay === value} onChange={() => setPay(value)} />
      <span className="flex-1 min-w-0"><b className="block">{label}</b><span className="text-sm text-cocoa">{hint}</span></span>
      {icon}
    </label>
  );

  return (
    <Modal title={service ? "Pedir este servicio" : "Comprar"} onClose={onClose}>
      <p className="font-extrabold leading-snug">{item.title}</p>
      <p className="text-cocoa mt-0.5">{formatPrice(item.priceCents, item.deal)}{max > 1 ? ` cada uno. Quedan ${item.stock}.` : ""}</p>

      {max > 1 && (
        <div className="mt-4">
          <span className="field-label">Cantidad</span>
          <div className="inline-flex items-center gap-3">
            <button type="button" className="btn btn-icon" aria-label="Una menos" disabled={qty <= 1} onClick={() => setQty((v) => Math.max(1, v - 1))}><Minus size={18} /></button>
            <output className="text-2xl font-extrabold w-10 text-center" aria-live="polite">{qty}</output>
            <button type="button" className="btn btn-icon" aria-label="Una más" disabled={qty >= max} onClick={() => setQty((v) => Math.min(max, v + 1))}><Plus size={18} /></button>
            {item.priceCents != null && qty > 1 && <span className="text-cocoa">Total {total}</span>}
          </div>
        </div>
      )}

      <fieldset className="mt-5">
        <legend className="field-label">¿Cómo quieres pagar?</legend>
        <div className="grid gap-2">
          {item.pay.methods.map((m) => option(m.id, m.label, "Pagas ahora y subes el comprobante", <Wallet size={20} className="shrink-0" />))}
          {item.pay.onDelivery && option("delivery", PAY_ON_DELIVERY, "Le pagas al vendedor cuando te lo entregue", <HandCoins size={20} className="shrink-0" />)}
        </div>
      </fieldset>

      <div className="mt-4">
        <Field label="Mensaje para el vendedor" hint="Opcional. Por ejemplo, tu ciudad o cómo prefieres recibirlo.">
          <textarea className="input !min-h-20" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <p className="text-sm text-cocoa mt-3">El pago va directo al vendedor y la entrega la cuadran por el chat. Cosland no cobra ni guarda dinero.</p>
      {error && <p role="alert" className="mt-3 font-bold text-berry">{error}</p>}
      <button className="btn btn-ink w-full mt-4" style={{ minHeight: "3.25rem" }} disabled={create.isPending || pay === null}
        onClick={() => { setError(""); create.mutate({ listingId: item.id, quantity: qty, note: note.trim() || null, pay: pay ?? undefined }); }}>
        {create.isPending ? "Enviando…" : "Confirmar compra"}
      </button>
    </Modal>
  );
}

// Reseña al recibir: estrellas y un comentario corto
export function ReviewModal({ shopId, shopName, onClose }: { shopId: number; shopName: string; onClose: () => void }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const save = trpc.review.save.useMutation({
    onSuccess: () => { utils.review.invalidate(); utils.shop.invalidate(); utils.order.invalidate(); toast("Reseña publicada. ¡Gracias!"); onClose(); },
    onError: (e) => toast(e.message, true),
  });
  return (
    <Modal title="¿Cómo te fue con tu compra?" onClose={onClose}>
      <p className="text-cocoa">Tu reseña ayuda a que otros compren con confianza en {shopName}.</p>
      <form className="grid gap-4 mt-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ shopId, rating, comment }); }}>
        <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
          {[1, 2, 3, 4, 5].map((i) => (
            <button type="button" key={i} role="radio" aria-checked={rating === i} aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`} onClick={() => setRating(i)} className="p-1 rounded-full">
              <Star size={36} strokeWidth={1.8} className={i <= rating ? "fill-yuzu" : "text-ink/30"} />
            </button>
          ))}
        </div>
        <Field label="Cuéntalo en pocas palabras"><textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Trato, tiempos de entrega, calidad…" /></Field>
        <button className="btn btn-ink" disabled={save.isPending}>Publicar reseña</button>
        <button type="button" className="text-center underline underline-offset-4 text-cocoa" onClick={onClose}>Ahora no</button>
      </form>
    </Modal>
  );
}
