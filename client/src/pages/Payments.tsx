import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Trash2 } from "lucide-react";
import { PAY_TYPES } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Field, Loading, useToast } from "@/components/ui";

type Method = { id?: number; type: string; details: string };

// Cómo te pagan: el vendedor lo configura una vez y el comprador lo ve al comprar
export default function Payments() {
  const { me, loading } = useMe();
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.shop.payments.useQuery(undefined, { enabled: Boolean(me?.shop) });
  const [methods, setMethods] = useState<Method[]>([]);
  const [onDelivery, setOnDelivery] = useState(true);
  const [error, setError] = useState("");
  const [filled, setFilled] = useState(false);
  useEffect(() => { if (q.data && !filled) { setMethods(q.data.methods); setOnDelivery(q.data.payOnDelivery); setFilled(true); } }, [q.data, filled]);
  const save = trpc.shop.savePayments.useMutation({
    onSuccess: () => { utils.shop.invalidate(); utils.listing.invalidate(); toast("Formas de pago guardadas"); go("/mi-vitrina"); },
    onError: (e) => { let m = e.message; try { m = JSON.parse(e.message)[0].message; } catch { /* mensaje normal */ } setError(m); },
  });

  if (loading || (me?.shop && q.isLoading)) return <Loading />;
  if (!me?.shop) return <div className="wrap py-14"><Empty title="Primero abre tu vitrina" action={<Link href="/mi-vitrina" className="btn btn-ink">Abrir mi vitrina</Link>} /></div>;
  const set = (i: number, patch: Partial<Method>) => setMethods((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const nothing = methods.length === 0 && !onDelivery;

  return (
    <div className="wrap pt-6 md:pt-10 max-w-2xl">
      <h1 className="text-3xl md:text-4xl">Cómo te pagan</h1>
      <p className="text-cocoa mt-2">Agrega tus formas de pago una sola vez. Quien te compre las elige al comprar y ve tus datos solo después de hacer el pedido.</p>

      <form className="grid gap-4 mt-6" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate({ payOnDelivery: onDelivery, methods: methods.map((m) => ({ ...m, type: m.type as never, details: m.details.trim() })) }); }}>
        {methods.map((m, i) => {
          const type = PAY_TYPES.find((t) => t.id === m.type);
          return (
            <div key={m.id ?? `n${i}`} className="soft p-4 grid gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1"><Field label="Forma de pago"><select className="input" value={m.type} onChange={(e) => set(i, { type: e.target.value })}>{PAY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field></div>
                <button type="button" className="btn btn-icon" aria-label="Quitar esta forma de pago" onClick={() => setMethods((ms) => ms.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
              </div>
              <Field label="Tus datos para recibir el pago" hint={type?.hint}>
                <textarea className="input !min-h-24" rows={3} maxLength={600} required minLength={4} value={m.details} onChange={(e) => set(i, { details: e.target.value })} />
              </Field>
            </div>
          );
        })}
        {methods.length < 8 && (
          <button type="button" className="btn" onClick={() => setMethods((ms) => [...ms, { type: PAY_TYPES.find((t) => !ms.some((m) => m.type === t.id))?.id ?? "otro", details: "" }])}>
            <Plus size={18} />Agregar forma de pago
          </button>
        )}

        <label className="soft p-4 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 mt-0.5 accent-[#2a211c]" checked={onDelivery} onChange={(e) => setOnDelivery(e.target.checked)} />
          <span><b className="block">Acepto pago al recibir</b><span className="text-sm text-cocoa">El comprador te paga cuando le entregas, en efectivo o como acuerden.</span></span>
        </label>

        {nothing && <p className="font-bold text-berry">Sin ninguna forma de pago, tus publicaciones no tendrán el botón de comprar. Solo podrán escribirte.</p>}
        {error && <p role="alert" className="font-bold text-berry">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ink" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Guardar"}</button>
          <Link href="/mi-vitrina" className="btn">Volver</Link>
        </div>
      </form>
    </div>
  );
}
