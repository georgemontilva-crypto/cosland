import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Field, Modal, useToast } from "./ui";

// Escribirle a una vitrina, con oferta opcional cuando es sobre una publicación
export default function ContactModal({ shopId, shopName, listingId, listingTitle, withOffer, onClose }: {
  shopId: number; shopName: string; listingId?: number; listingTitle?: string; withOffer?: boolean; onClose: () => void;
}) {
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [body, setBody] = useState(listingTitle ? `Hola, me interesa "${listingTitle}". ¿Sigue disponible?` : "Hola, ");
  const [offer, setOffer] = useState("");
  const start = trpc.chat.start.useMutation({
    onSuccess: (r) => { utils.auth.me.invalidate(); toast("Mensaje enviado"); go(`/mensajes/${r.id}`); },
    onError: (e) => toast(e.message, true),
  });
  return (
    <Modal title={`Escribirle a ${shopName}`} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(e) => { e.preventDefault(); start.mutate({ shopId, listingId, body, offer: withOffer && offer ? Number(offer) : undefined }); }}
      >
        <Field label="Tu mensaje">
          <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={2000} autoFocus />
        </Field>
        {withOffer && (
          <Field label="Tu oferta en dólares (opcional)" hint="El vendedor decide si la acepta.">
            <input className="input" inputMode="decimal" placeholder="Ej. 35" value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
        )}
        <button className="btn btn-ink" disabled={start.isPending}>{start.isPending ? "Enviando…" : "Enviar mensaje"}</button>
      </form>
    </Modal>
  );
}
