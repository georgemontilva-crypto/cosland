import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, CONDITIONS, DEALS, SIZES } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { Empty, Field, Loading, Modal } from "@/components/ui";
import { ListingGrid } from "@/components/cards";

type Filters = Record<string, string>;
const KEYS = ["q", "kind", "category", "deal", "condition", "size", "min", "max", "city", "trade", "sort", "page"] as const;

function FilterFields({ f, set }: { f: Filters; set: (patch: Filters) => void }) {
  const cats = CATEGORIES.filter((c) => !f.kind || c.kind === f.kind);
  return (
    <div className="grid gap-4">
      <Field label="Categoría">
        <select className="input" value={f.category ?? ""} onChange={(e) => set({ category: e.target.value })}>
          <option value="">Todas</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Modalidad">
        <select className="input" value={f.deal ?? ""} onChange={(e) => set({ deal: e.target.value })}>
          <option value="">Cualquiera</option>
          {DEALS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </Field>
      {f.kind !== "service" && (
        <>
          <Field label="Condición">
            <select className="input" value={f.condition ?? ""} onChange={(e) => set({ condition: e.target.value })}>
              <option value="">Cualquiera</option>
              {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Talla">
            <select className="input" value={f.size ?? ""} onChange={(e) => set({ size: e.target.value })}>
              <option value="">Cualquiera</option>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde $"><input className="input" inputMode="decimal" placeholder="0" value={f.min ?? ""} onChange={(e) => set({ min: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
        <Field label="Hasta $"><input className="input" inputMode="decimal" placeholder="Sin tope" value={f.max ?? ""} onChange={(e) => set({ max: e.target.value.replace(/[^\d.]/g, "") })} /></Field>
      </div>
      <Field label="Ciudad"><input className="input" placeholder="Maracaibo, Bogotá…" value={f.city ?? ""} onChange={(e) => set({ city: e.target.value })} /></Field>
      <label className="flex items-center gap-3 font-bold">
        <input type="checkbox" className="w-5 h-5 accent-[#2a211c]" checked={f.trade === "1"} onChange={(e) => set({ trade: e.target.checked ? "1" : "" })} />
        Solo los que aceptan cambio
      </label>
    </div>
  );
}

export default function Explore() {
  const search = useSearch();
  const [, go] = useLocation();
  const f = useMemo(() => {
    const p = new URLSearchParams(search);
    const o: Filters = {};
    KEYS.forEach((k) => { const v = p.get(k); if (v) o[k] = v; });
    return o;
  }, [search]);
  const [q, setQ] = useState(f.q ?? "");
  const [open, setOpen] = useState(false);
  useEffect(() => setQ(f.q ?? ""), [f.q]);

  const set = (patch: Filters) => {
    const next: Filters = { ...f, ...patch };
    if (!("page" in patch)) delete next.page;
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && p.set(k, v));
    go(`/explorar${p.toString() ? `?${p}` : ""}`, { replace: true });
  };

  // Escribir en ciudad o precio no dispara una búsqueda por cada tecla
  const [debounced, setDebounced] = useState(f);
  useEffect(() => { const t = setTimeout(() => setDebounced(f), 250); return () => clearTimeout(t); }, [f]);

  const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
  const res = trpc.listing.search.useQuery({
    q: debounced.q, category: debounced.category, kind: debounced.kind as any, deal: debounced.deal as any, condition: debounced.condition as any,
    size: debounced.size, min: num(debounced.min), max: num(debounced.max), city: debounced.city, trade: debounced.trade === "1" || undefined,
    sort: (debounced.sort as any) ?? "recientes", page: num(debounced.page) ?? 1,
  }, { placeholderData: (prev) => prev });

  const active = ["category", "deal", "condition", "size", "min", "max", "city", "trade"].filter((k) => f[k]).length;
  const kindTab = (value: string, label: string) => (
    <button className="chip" aria-pressed={(f.kind ?? "") === value} onClick={() => set({ kind: value, category: "" })}>{label}</button>
  );

  return (
    <div className="wrap pt-6 md:pt-10">
      <h1 className="text-3xl md:text-5xl">{f.q ? `Resultados para "${f.q}"` : "Explorar"}</h1>
      <form className="mt-5 flex gap-2 md:hidden" onSubmit={(e) => { e.preventDefault(); set({ q }); }} role="search">
        <input className="input !rounded-full" placeholder="Busca un personaje, serie o artículo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <button className="btn btn-ink">Buscar</button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {kindTab("", "Todo")}
        {kindTab("product", "Artículos")}
        {kindTab("service", "Servicios")}
        <button className="chip lg:hidden" onClick={() => setOpen(true)}>
          <SlidersHorizontal size={16} />Filtros{active ? ` (${active})` : ""}
        </button>
        <select className="input !w-auto !min-h-10 !py-1.5 !rounded-full ml-auto !text-[0.9rem] font-bold" value={f.sort ?? "recientes"} onChange={(e) => set({ sort: e.target.value })} aria-label="Ordenar">
          <option value="recientes">Más recientes</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </select>
      </div>

      <div className="mt-7 grid lg:grid-cols-[16rem_1fr] gap-8 items-start">
        <aside className="hidden lg:block soft p-5 sticky top-24" aria-label="Filtros">
          <FilterFields f={f} set={set} />
          {active > 0 && <button className="btn btn-sm w-full mt-5" onClick={() => go(`/explorar${f.q ? `?q=${encodeURIComponent(f.q)}` : ""}`)}><X size={15} />Quitar filtros</button>}
        </aside>

        <div>
          {res.isLoading ? <Loading label="Buscando" /> : !res.data?.items.length ? (
            <Empty title="Nada por aquí todavía" action={<a href="/se-busca?nuevo=1" className="btn btn-yuzu">Publicar lo que busco</a>}>
              Prueba con menos filtros o con otra palabra. También puedes dejar un pedido en “Se busca” para que los vendedores te escriban.
            </Empty>
          ) : (
            <>
              <p className="text-cocoa mb-4">{res.data.total} {res.data.total === 1 ? "publicación" : "publicaciones"}</p>
              <ListingGrid items={res.data.items} />
              {res.data.pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  <button className="btn btn-sm" disabled={res.data.page <= 1} onClick={() => { set({ page: String(res.data!.page - 1) }); scrollTo(0, 0); }}>Anterior</button>
                  <span className="font-bold">Página {res.data.page} de {res.data.pages}</span>
                  <button className="btn btn-sm" disabled={res.data.page >= res.data.pages} onClick={() => { set({ page: String(res.data!.page + 1) }); scrollTo(0, 0); }}>Siguiente</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {open && (
        <Modal title="Filtros" onClose={() => setOpen(false)}>
          <FilterFields f={f} set={set} />
          <div className="flex gap-2 mt-6">
            <button className="btn flex-1" onClick={() => { go(`/explorar${f.q ? `?q=${encodeURIComponent(f.q)}` : ""}`); setOpen(false); }}>Quitar filtros</button>
            <button className="btn btn-ink flex-1" onClick={() => setOpen(false)}>Ver resultados</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
