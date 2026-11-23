import { useState } from "react";
import { useLocation } from "wouter";
import { Minus, Plus } from "lucide-react";
import { formatPrice, hasStock } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { Field, Modal, useToast } from "./ui";

type Item = { id: number; title: string; priceCents: number | null; deal: string; kind: string; stock: number };

// "Lo quiero": deja el pedido registrado y abre el chat con el vendedor para acordar pago y entrega
export default function OrderModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const stocked = hasStock(item.kind, item.deal);
  const max = stocked ? Math.max(1, item.stock) : 1;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const create = trpc.order.create.useMutation({
    onSuccess: (r) => {
      utils.order.invalidate(); utils.listing.byId.invalidate({ id: item.id }); utils.chat.invalidate();
      toast(r.existing ? "Ya tenías este pedido en curso" : "Pedido enviado. Acuerda aquí el pago y la entrega.");
      onClose();
      go(r.conversationId ? `/mensajes/${r.conversationId}` : "/pedidos");
    },
    onError: (e) => setError(e.message),
  });
  const service = item.kind === "service";

  return (
    <Modal title={service ? "Pedir este servicio" : "Lo quiero"} onClose={onClose}>
      <p className="font-extrabold leading-snug">{item.title}</p>
      <p className="text-cocoa mt-0.5">{formatPrice(item.priceCents, item.deal)}{max > 1 ? ` cada uno. Quedan ${item.stock}.` : ""}</p>

      {max > 1 && (
        <div className="mt-4">
          <span className="field-label">Cantidad</span>
          <div className="inline-flex items-center gap-3">
            <button type="button" className="btn btn-icon" aria-label="Una menos" disabled={qty <= 1} onClick={() => setQty((v) => Math.max(1, v - 1))}><Minus size={18} /></button>
            <output className="text-2xl font-extrabold w-10 text-center" aria-live="polite">{qty}</output>
            <button type="button" className="btn btn-icon" aria-label="Una más" disabled={qty >= max} onClick={() => setQty((v) => Math.min(max, v + 1))}><Plus size={18} /></button>
            {item.priceCents != null && qty > 1 && <span className="text-cocoa">Total {formatPrice(item.priceCents * qty, item.deal)}</span>}
          </div>
        </div>
      )}

      <div className="mt-4">
        <Field label="Mensaje para el vendedor" hint="Opcional. Por ejemplo, tu ciudad o cómo prefieres recibirlo.">
          <textarea className="input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <p className="text-sm text-cocoa mt-3">El pago y la entrega los acuerdas directo con el vendedor en el chat. Cosland no cobra ni guarda dinero.</p>
      {error && <p role="alert" className="mt-3 font-bold text-berry">{error}</p>}
      <button className="btn btn-ink w-full mt-4" style={{ minHeight: "3.25rem" }} disabled={create.isPending}
        onClick={() => { setError(""); create.mutate({ listingId: item.id, quantity: qty, note: note.trim() || null }); }}>
        {create.isPending ? "Enviando…" : "Enviar pedido"}
      </button>
    </Modal>
  );
}
