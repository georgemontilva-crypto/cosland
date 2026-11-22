import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { formatPrice } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { Field, Modal, useToast } from "./ui";
import { SinglePhoto } from "./ImageUploader";

export const useSupport = () => trpc.support.info.useQuery(undefined, { staleTime: 60_000 }).data;

// Cuánto ha aportado la comunidad este mes frente a lo que cuesta mantener Cosland
export function SupportMeter({ className = "" }: { className?: string }) {
  const s = useSupport();
  if (!s?.enabled || !s.goalCents) return null;
  const pct = Math.min(100, Math.round((s.monthCents / s.goalCents) * 100));
  return (
    <div className={`rounded-[1.75rem] border-[1.5px] border-ink bg-paper p-5 ${className}`}>
      <p className="font-extrabold text-lg flex items-center gap-2"><HeartHandshake size={21} />Cosland la mantiene su comunidad</p>
      <p className="mt-1.5">
        Este mes los vendedores han aportado <strong>{formatPrice(s.monthCents)}</strong> de los <strong>{formatPrice(s.goalCents)}</strong> que cuesta mantenerla.
      </p>
      <div className="mt-3 h-4 rounded-full border-[1.5px] border-ink bg-cream overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Meta del mes">
        <div className="h-full bg-matcha border-r-[1.5px] border-ink" style={{ width: `${pct}%`, borderRightWidth: pct > 0 && pct < 100 ? 1.5 : 0 }} />
      </div>
      <p className="text-sm text-cocoa mt-2">Cada vendedor puede sumar {formatPrice(s.amountCents)} al precio de lo que publica y enviarlo cuando vende.</p>
    </div>
  );
}

export function SupporterBadge() {
  return <span className="tag" style={{ background: "#cde4be" }}><HeartHandshake size={13} strokeWidth={2.3} />Apoya a Cosland</span>;
}

// Después de vender: a dónde enviar el dólar y cómo avisar que ya se envió
export function SupportModal({ id, title, onClose }: { id: number; title?: string | null; onClose: () => void }) {
  const s = useSupport();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const done = () => { utils.support.invalidate(); onClose(); };
  const report = trpc.support.report.useMutation({ onSuccess: () => { toast("Gracias por apoyar a Cosland"); done(); }, onError: (e) => toast(e.message, true) });
  const skip = trpc.support.skip.useMutation({ onSuccess: done });
  return (
    <Modal title="Envía tu dólar a Cosland" onClose={onClose}>
      <p>{title ? <>Vendiste “{title}”. </> : null}Con {formatPrice(s?.amountCents ?? 100)} por venta ayudas a que Cosland siga funcionando para toda la comunidad.</p>
      <div className="mt-4 rounded-[1.4rem] bg-paper border-[1.5px] border-ink p-4">
        <p className="text-sm font-bold text-cocoa">Datos para enviarlo</p>
        <p className="mt-1 whitespace-pre-line font-bold break-words">{s?.account || "El equipo de Cosland aún no ha publicado la cuenta."}</p>
      </div>
      <form className="grid gap-4 mt-5" onSubmit={(e) => { e.preventDefault(); report.mutate({ id, reference, proofUrl: proof }); }}>
        <Field label="Número de referencia (opcional)"><input className="input" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <div><span className="field-label">Comprobante (opcional)</span><SinglePhoto value={proof} onChange={setProof} label="Subir comprobante" /></div>
        <button className="btn btn-ink" disabled={report.isPending}>Ya lo envié</button>
      </form>
      <div className="flex flex-wrap justify-between gap-3 mt-4 text-sm">
        <button className="underline underline-offset-4 font-bold" onClick={onClose}>Lo envío después</button>
        <button className="underline underline-offset-4 text-cocoa" onClick={() => skip.mutate({ id })}>Esta vez no voy a aportar</button>
      </div>
    </Modal>
  );
}
