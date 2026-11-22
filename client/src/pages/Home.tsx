import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Camera, Gem, Palette, Scissors, Search, Shirt, Store } from "lucide-react";
import { CATEGORIES, accentOf, categoryOf, formatPrice } from "@shared/catalog";
import { trpc, timeAgo } from "@/lib/trpc";
import { Awning, Loading } from "@/components/ui";
import { CategoryBubble, ListingGrid, ShopCard } from "@/components/cards";

const STREET = [
  { kind: "cosplayer", title: "Cosplayers", text: "Cosplays, pelucas y props", accent: "sakura", Icon: Shirt },
  { kind: "taller", title: "Talleres", text: "Costura y props por encargo", accent: "matcha", Icon: Scissors },
  { kind: "tienda", title: "Tiendas", text: "Figuras, manga y merch", accent: "ramune", Icon: Store },
  { kind: "artista", title: "Artistas", text: "Prints, stickers y fanart", accent: "fuji", Icon: Palette },
  { kind: "fotografo", title: "Fotógrafos", text: "Sesiones y video", accent: "yuzu", Icon: Camera },
  { kind: "coleccionista", title: "Coleccionistas", text: "Piezas raras y cartas", accent: "momo", Icon: Gem },
] as const;

function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <h2 className="text-[1.6rem] md:text-3xl">{title}</h2>
      {href && <Link href={href} className="font-bold underline underline-offset-4 decoration-2 shrink-0">{link}</Link>}
    </div>
  );
}

export default function Home() {
  const [, go] = useLocation();
  const [q, setQ] = useState("");
  const home = trpc.listing.home.useQuery();
  const submit = (e: FormEvent) => { e.preventDefault(); go(`/explorar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); };

  return (
    <>
      <section className="wrap pt-8 md:pt-14 relative">
        <div aria-hidden className="hidden lg:block absolute right-8 top-16 w-[19rem]">
          <div className="absolute inset-x-2 top-6 bottom-0 rounded-[45%_55%_52%_48%/55%_48%_52%_45%] bg-sakura" />
          <img src="/gato-ink.png" alt="" className="relative w-full rotate-[5deg]" />
        </div>
        <h1 className="text-[2.5rem] leading-[1.04] md:text-7xl max-w-4xl lg:max-w-[52rem]">
          Vende el cosplay que ya no usas. Encuentra el que te falta.
        </h1>
        <p className="mt-4 md:mt-6 text-lg md:text-xl text-cocoa max-w-2xl">
          Un mercado hecho por la comunidad: cosplays, pelucas, figuras, manga y quien te cose el próximo traje. Cada vendedor tiene su propia vitrina.
        </p>
        <form onSubmit={submit} role="search" className="mt-6 md:mt-8 flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-cocoa pointer-events-none" />
            <input
              className="input !rounded-full !pl-12 !min-h-14 !text-[1.05rem] !border-ink" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Nezuko talla M, peluca rubia, figura de Gojo" aria-label="¿Qué buscas?"
            />
          </div>
          <button className="btn btn-ink !min-h-14 !px-6">Buscar</button>
        </form>
      </section>

      {/* La calle: una fachada por cada tipo de vitrina */}
      <section aria-label="Tipos de vitrina" className="mt-9 md:mt-14">
        <div className="wrap !pr-0 md:!pr-8">
          <div className="scroll-row !gap-3 md:!gap-5 items-start pr-5 md:pr-0 md:grid md:grid-cols-6">
            {STREET.map(({ kind, title, text, accent, Icon }, i) => (
              <Link key={kind} href={`/vitrinas?kind=${kind}`} className="group block w-[9.75rem] md:w-auto">
                <div className="bg-paper border-[1.5px] border-b-0 border-ink rounded-t-[1.75rem] overflow-hidden">
                  <div className="unroll" style={{ animationDelay: `${120 + i * 90}ms` }}><Awning accent={accent} size={30} /></div>
                  <div className="px-3 pt-3">
                    <div
                      className="mx-auto w-full aspect-[5/6] rounded-t-full border-[1.5px] border-b-0 border-ink grid place-items-center transition-transform group-hover:-translate-y-1"
                      style={{ background: accentOf(accent).hex }}
                    >
                      <Icon size={38} strokeWidth={1.7} />
                    </div>
                  </div>
                </div>
                <div className="border-t-[1.5px] border-ink pt-2.5 px-1">
                  <h3 className="text-base">{title}</h3>
                  <p className="text-sm text-cocoa leading-snug">{text}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap mt-12" aria-label="Categorías">
        <div className="scroll-row -mx-[1.125rem] px-[1.125rem] md:mx-0 md:px-0 md:flex-wrap">
          {CATEGORIES.map((c) => <CategoryBubble key={c.id} id={c.id} />)}
        </div>
      </section>

      {home.isLoading ? <Loading /> : home.data && (
        <>
          <section className="wrap mt-14">
            <SectionHead title="Recién publicado" href="/explorar?kind=product" link="Ver todo" />
            {home.data.recent.length ? <ListingGrid items={home.data.recent} /> : (
              <div className="soft px-6 py-10 text-center">
                <p className="text-lg font-bold">Las vitrinas están por abrir.</p>
                <p className="text-cocoa mt-1">Sé de las primeras personas en publicar.</p>
                <Link href="/publicar" className="btn btn-sakura mt-5">Publicar un artículo</Link>
              </div>
            )}
          </section>

          {home.data.services.length > 0 && (
            <section className="mt-16 bg-oat/70 py-12 rounded-[2.5rem] md:rounded-[4rem] mx-2 md:mx-6">
              <div className="wrap">
                <SectionHead title="Manos que cosen, peinan y fotografían" href="/explorar?kind=service" link="Ver servicios" />
                <ListingGrid items={home.data.services} />
              </div>
            </section>
          )}

          <section className="wrap mt-16">
            <SectionHead title="Se busca" href="/se-busca" link="Ver pedidos" />
            <p className="text-cocoa -mt-3 mb-5 max-w-2xl">¿No encuentras algo? Publica lo que buscas y deja que los vendedores te escriban.</p>
            <div className="grid gap-4 md:grid-cols-3">
              {home.data.wanted.map((w, i) => (
                <Link key={w.id} href="/se-busca" className="block rounded-[1.75rem] border-[1.5px] border-ink p-5 transition-transform hover:-translate-y-1" style={{ background: ["#f8e29c", "#bcdfee", "#f6c3cf"][i % 3] }}>
                  <p className="text-sm font-bold">{categoryOf(w.category)?.short}, {timeAgo(w.createdAt)}</p>
                  <h3 className="text-lg mt-1.5">{w.title}</h3>
                  <p className="mt-2 text-sm font-bold">{w.budgetCents != null ? `Presupuesto: ${formatPrice(w.budgetCents)}` : "Presupuesto abierto"}{w.city ? `, en ${w.city}` : ""}</p>
                </Link>
              ))}
              <Link href="/se-busca?nuevo=1" className="rounded-[1.75rem] border-[1.5px] border-dashed border-ink p-5 grid place-items-center text-center font-bold min-h-32 hover:bg-paper">
                Publicar lo que busco
              </Link>
            </div>
          </section>

          {home.data.shops.length > 0 && (
            <section className="wrap mt-16">
              <SectionHead title="Vitrinas para visitar" href="/vitrinas" link="Ver todas" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {home.data.shops.map((s) => <ShopCard key={s.id} shop={s} />)}
              </div>
            </section>
          )}
        </>
      )}

      <section className="wrap mt-16">
        <div className="panel overflow-hidden">
          <Awning accent="sakura" size={36} />
          <div className="p-6 md:p-10 grid gap-8 md:grid-cols-[1fr_1.4fr] md:items-center">
            <div>
              <h2 className="text-3xl md:text-4xl">Abre tu vitrina en tres pasos</h2>
              <p className="text-cocoa mt-3">Publicar es gratis. Tú pones el precio y acuerdas la entrega con quien compra.</p>
              <Link href="/mi-vitrina" className="btn btn-ink mt-6">Abrir mi vitrina</Link>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {[
                ["Crea tu vitrina", "Elige nombre, foto y el color de tu toldo."],
                ["Publica con fotos", "Talla, medidas, personaje y precio."],
                ["Acuerda la venta", "Te escriben por el chat o por WhatsApp."],
              ].map(([t, d], i) => (
                <li key={t} className="rounded-[1.5rem] bg-cream p-4">
                  <span className="grid place-items-center w-9 h-9 rounded-full border-[1.5px] border-ink font-extrabold" style={{ background: ["#cde4be", "#bcdfee", "#d8cbf0"][i] }}>{i + 1}</span>
                  <h3 className="text-base mt-3">{t}</h3>
                  <p className="text-sm text-cocoa mt-1">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
