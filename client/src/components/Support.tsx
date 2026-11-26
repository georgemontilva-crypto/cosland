import { useState } from "react";
import { HeartHandshake, Sparkles } from "lucide-react";
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
      <p className="text-sm text-cocoa mt-2">Cada vendedor puede sumar {formatPrice(s.amountCents)} al precio de lo que publica y enviarlo cuando vende. Cada dólar destaca su vitrina {s.featureDays} días.</p>
    </div>
  );
}

export function SupporterBadge() {
  return <span className="tag" style={{ background: "#cde4be" }}><HeartHandshake size={13} strokeWidth={2.3} />Apoya a Cosland</span>;
}

const longDay = (d: Date | string) => new Date(d).toLocaleDateString("es", { day: "numeric", month: "long" });

// Panel del vendedor: destacar la vitrina con un dólar, o cuánto le queda destacada
export function FeatureCard({ until, waiting, onBoost, busy, className = "" }: { until: Date | string | null | undefined; waiting: boolean; onBoost: () => void; busy?: boolean; className?: string }) {
  const s = useSupport();
  if (!s?.enabled) return null;
  const price = formatPrice(s.amountCents);
  return (
    <div className={`rounded-[1.75rem] border-[1.5px] border-ink p-5 ${until ? "bg-yuzu" : "bg-paper"} ${className}`}>
      <p className="font-extrabold text-lg flex items-start gap-2"><Sparkles size={20} className="mt-1 shrink-0" />{until ? `Tu vitrina está destacada hasta el ${longDay(until)}` : "Destaca tu vitrina"}</p>
      <p className="mt-1.5">
        {until
          ? `Sale primero en las búsquedas, en la portada y en Vitrinas. Cada ${price} que aportas a Cosland suma ${s.featureDays} días más.`
          : `Envía ${price} a Cosland y tu vitrina sale primero en las búsquedas, en la portada y en Vitrinas durante ${s.featureDays} días. Cada aporte suma ${s.featureDays} días más.`}
      </p>
      {waiting
        ? <p className="mt-3 font-bold">Tu aporte está por confirmar. Los días se suman cuando el equipo lo revise.</p>
        : <button className="btn btn-ink mt-3" disabled={busy} onClick={onBoost}><Sparkles size={17} />{until ? `Sumar ${s.featureDays} días por ${price}` : `Destacar por ${price}`}</button>}
      <p className="text-sm text-cocoa mt-2.5">Las vitrinas destacadas llevan la etiqueta “Destacada” para que quien compra sepa por qué salen arriba.</p>
    </div>
  );
}

// Después de vender (o al destacar la vitrina): a dónde enviar el dólar y cómo avisar que ya se envió
export function SupportModal({ id, title, amountCents, boost, onClose }: { id: number; title?: string | null; amountCents?: number; boost?: boolean; onClose: () => void }) {
  const s = useSupport();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const done = () => { utils.support.invalidate(); utils.order.invalidate(); onClose(); };
  const report = trpc.support.report.useMutation({ onSuccess: () => { toast("Gracias por apoyar a Cosland"); done(); }, onError: (e) => toast(e.message, true) });
  const skip = trpc.support.skip.useMutation({ onSuccess: done });
  return (
    <Modal title={boost ? "Destaca tu vitrina" : "¿Aportas a Cosland?"} onClose={onClose}>
      {boost ? (
        <p>Envía {formatPrice(s?.amountCents ?? 100)} a Cosland y avísanos aquí. Cuando el equipo lo confirme, tu vitrina sale primero en las búsquedas durante {s?.featureDays ?? 15} días.</p>
      ) : (
        <p>
          {title ? <>Vendiste “{title}”. </> : null}Con {formatPrice(amountCents ?? s?.amountCents ?? 100)} ayudas a que Cosland siga funcionando para toda la comunidad,
          y tu vitrina sale destacada {(s?.featureDays ?? 15) * Math.max(1, Math.floor((amountCents ?? 100) / 100))} días cuando el equipo lo confirme. Es voluntario.
        </p>
      )}
      <div className="mt-4 rounded-[1.4rem] bg-paper border-[1.5px] border-ink p-4">
        <p className="text-sm font-bold text-cocoa">Datos para enviarlo</p>
        <p className="mt-1 whitespace-pre-line font-bold break-words">{s?.account || "El equipo de Cosland aún no ha publicado la cuenta."}</p>
      </div>
      <form className="grid gap-4 mt-5" onSubmit={(e) => {
        e.preventDefault();
        if (!proof && !reference.trim()) return toast("Sube la captura del pago o escribe la referencia, para que el equipo pueda verificarlo.", true);
        report.mutate({ id, reference, proofUrl: proof });
      }}>
        <div>
          <span className="field-label">Captura del pago</span>
          <span className="field-hint block mb-2">Súbela para que el equipo la vea y confirme tu aporte.</span>
          <SinglePhoto value={proof} onChange={setProof} label="Subir comprobante" />
        </div>
        <Field label={proof ? "Número de referencia (opcional)" : "Número de referencia (si no tienes captura)"}><input className="input" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <button className="btn btn-ink" disabled={report.isPending}>Ya lo envié</button>
      </form>
      <div className="flex flex-wrap justify-between gap-3 mt-4 text-sm">
        <button className="underline underline-offset-4 font-bold" onClick={onClose}>Lo envío después</button>
        <button className="underline underline-offset-4 text-cocoa" onClick={() => skip.mutate({ id })}>{boost ? "Ya no quiero destacarla" : "Esta vez no voy a aportar"}</button>
      </div>
    </Modal>
  );
}
