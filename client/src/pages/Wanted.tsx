import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { MapPin, Plus } from "lucide-react";
import { CATEGORIES, SIZES, categoryOf, formatPrice } from "@shared/catalog";
import { trpc, timeAgo } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Field, Loading, Modal, useToast } from "@/components/ui";

const NOTE = ["#f8e29c", "#bcdfee", "#f6c3cf", "#cde4be", "#d8cbf0", "#fad0b5"];

export default function Wanted() {
  const { me } = useMe();
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const startOpen = new URLSearchParams(useSearch()).get("nuevo") === "1";
  const [creating, setCreating] = useState(startOpen);
  const [answer, setAnswer] = useState<null | { id: number; title: string }>(null);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ title: "", description: "", category: "cosplay", budget: "", size: "", city: "" });
  const list = trpc.wanted.list.useQuery();
  const create = trpc.wanted.create.useMutation({
    onSuccess: () => { utils.wanted.invalidate(); utils.listing.home.invalidate(); setCreating(false); setForm({ ...form, title: "", description: "", budget: "" }); toast("Pedido publicado"); },
    onError: (e) => toast(e.message, true),
  });
  const close = trpc.wanted.close.useMutation({ onSuccess: () => { utils.wanted.invalidate(); toast("Pedido cerrado"); } });
  const send = trpc.chat.answerWanted.useMutation({
    onSuccess: (r) => { toast("Mensaje enviado"); go(`/mensajes/${r.id}`); },
    onError: (e) => toast(e.message, true),
  });
  const needLogin = () => { toast("Entra a tu cuenta para continuar"); go("/entrar?volver=/se-busca"); };
  const up = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="wrap pt-6 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl">Se busca</h1>
          <p className="text-cocoa mt-2 max-w-2xl">El tablero de pedidos de la comunidad. Di qué necesitas y los vendedores que lo tengan te escriben.</p>
        </div>
        <button className="btn btn-ink" onClick={() => (me ? setCreating(true) : needLogin())}><Plus size={18} strokeWidth={2.6} />Publicar lo que busco</button>
      </div>

      <div className="mt-8">
        {list.isLoading ? <Loading /> : !list.data?.length ? (
          <Empty title="El tablero está vacío">Publica el primer pedido: un cosplay en tu talla, una figura que no consigues o alguien que te cosa un traje.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.map((w, i) => (
              <article key={w.id} className="rounded-[1.75rem] border-[1.5px] border-ink p-5 flex flex-col" style={{ background: NOTE[i % NOTE.length] }}>
                <p className="text-sm font-bold">{categoryOf(w.category)?.short}, {timeAgo(w.createdAt)}</p>
                <h2 className="text-xl mt-1.5">{w.title}</h2>
                {w.description && <p className="mt-2 whitespace-pre-line">{w.description}</p>}
                <p className="mt-3 font-bold text-sm flex flex-wrap gap-x-3 gap-y-1">
                  <span>{w.budgetCents != null ? `Presupuesto: ${formatPrice(w.budgetCents)}` : "Presupuesto abierto"}</span>
                  {w.size && <span>Talla {w.size}</span>}
                  {w.city && <span className="inline-flex items-center gap-1"><MapPin size={14} />{w.city}</span>}
                </p>
                <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                  <span className="text-sm">Lo pide {w.author}</span>
                  {w.isMine
                    ? <button className="btn btn-sm" onClick={() => close.mutate({ id: w.id })}>Ya lo conseguí</button>
                    : <button className="btn btn-sm btn-ink" onClick={() => (!me ? needLogin() : !me.shop ? (toast("Crea tu vitrina para responder pedidos"), go("/mi-vitrina")) : (setReply(""), setAnswer({ id: w.id, title: w.title })))}>Yo lo tengo</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <Modal title="¿Qué estás buscando?" onClose={() => setCreating(false)}>
          <form className="grid gap-4" onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ title: form.title, description: form.description, category: form.category as any, budget: form.budget ? Number(form.budget) : undefined, size: form.size, city: form.city });
          }}>
            <Field label="Lo que busco"><input className="input" required minLength={4} maxLength={120} placeholder="Cosplay de Frieren talla S" value={form.title} onChange={up("title")} autoFocus /></Field>
            <Field label="Categoría">
              <select className="input" value={form.category} onChange={up("category")}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            </Field>
            <Field label="Detalles (opcional)"><textarea className="input" rows={3} maxLength={2000} placeholder="Para cuándo lo necesitas, si aceptas usado, medidas…" value={form.description} onChange={up("description")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Presupuesto en $"><input className="input" inputMode="decimal" placeholder="Abierto" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
              <Field label="Talla">
                <select className="input" value={form.size} onChange={up("size")}><option value="">No aplica</option>{SIZES.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
            </div>
            <Field label="Ciudad (opcional)"><input className="input" maxLength={80} value={form.city} onChange={up("city")} /></Field>
            <button className="btn btn-ink" disabled={create.isPending}>Publicar pedido</button>
          </form>
        </Modal>
      )}

      {answer && (
        <Modal title="Responder al pedido" onClose={() => setAnswer(null)}>
          <p className="text-cocoa -mt-2 mb-4">“{answer.title}”</p>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); send.mutate({ wantedId: answer.id, body: reply }); }}>
            <Field label="Tu mensaje" hint="Llega al chat de quien hizo el pedido, a nombre de tu vitrina.">
              <textarea className="input" rows={4} required maxLength={1800} placeholder="Tengo justo eso. Te cuento precio y te paso fotos…" value={reply} onChange={(e) => setReply(e.target.value)} autoFocus />
            </Field>
            <button className="btn btn-ink" disabled={send.isPending}>Enviar mensaje</button>
          </form>
          <p className="text-sm text-cocoa mt-3">¿Ya lo tienes publicado? <Link href="/mi-vitrina" className="underline font-bold">Copia el enlace desde tu vitrina</Link> y pégalo en el mensaje.</p>
        </Modal>
      )}
    </div>
  );
}
