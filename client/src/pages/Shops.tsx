import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Store } from "lucide-react";
import { SHOP_KINDS } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { Empty, Loading } from "@/components/ui";
import { ShopCard } from "@/components/cards";

export default function Shops() {
  const params = new URLSearchParams(useSearch());
  const [, go] = useLocation();
  const kind = params.get("kind") ?? "";
  const store = params.get("tienda") === "1";
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const res = trpc.shop.list.useQuery({ q: dq || undefined, kind: (kind || undefined) as any, store: store || undefined });
  const nav = (k: string, st = store) => {
    const p = new URLSearchParams();
    if (k) p.set("kind", k);
    if (st) p.set("tienda", "1");
    go(`/vitrinas${p.toString() ? `?${p}` : ""}`, { replace: true });
  };
  return (
    <div className="wrap pt-6 md:pt-10">
      <h1 className="text-3xl md:text-5xl">Vitrinas</h1>
      <p className="text-cocoa mt-2 max-w-2xl">Cosplayers, talleres, tiendas y artistas de la comunidad. Entra a su vitrina y mira todo lo que ofrecen.</p>
      <input className="input !rounded-full mt-5 max-w-md" placeholder="Busca por nombre o ciudad" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar vitrinas" />
      <div className="scroll-row mt-4 -mx-[1.125rem] px-[1.125rem] md:mx-0 md:px-0 md:flex-wrap">
        <button className="chip" aria-pressed={!kind} onClick={() => nav("")}>Todas</button>
        {SHOP_KINDS.map((k) => <button key={k.id} className="chip" aria-pressed={kind === k.id} onClick={() => nav(k.id)}>{k.plural}</button>)}
        <button className="chip" aria-pressed={store} onClick={() => nav(kind, !store)}><Store size={15} />Con tienda física</button>
      </div>
      <div className="mt-7">
        {res.isLoading ? <Loading /> : res.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{res.data.map((s) => <ShopCard key={s.id} shop={s} />)}</div>
        ) : (
          <Empty title="Aún no hay vitrinas aquí" action={<a href="/mi-vitrina" className="btn btn-ink">Abrir mi vitrina</a>}>Abre la primera de este tipo.</Empty>
        )}
      </div>
    </div>
  );
}
