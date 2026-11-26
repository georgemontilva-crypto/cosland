import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BadgeCheck, Eye, Flag, Heart, MapPin, MessageCircle, Pencil, Repeat2, Share2, ShieldCheck, ShoppingBag } from "lucide-react";
import { REPORT_REASONS, categoryOf, conditionLabel, dealLabel, deliveryLabel, formatPrice, shopKindLabel, hasStock } from "@shared/catalog";
import { trpc, timeAgo, whatsappLink } from "@/lib/trpc";
import { useFavorites, useMe } from "@/lib/hooks";
import { Awning, Avatar, Empty, Field, Loading, Modal, Stars, useToast } from "@/components/ui";
import { ListingGrid, Photo } from "@/components/cards";
import ContactModal from "@/components/ContactModal";
import { SupportModal, useSupport } from "@/components/Support";
import CheckoutModal, { Reputation, canBuy } from "@/components/Checkout";

export async function share(title: string, toast: (t: string) => void) {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); toast("Enlace copiado"); }
  } catch { /* la persona canceló */ }
}

export default function ListingPage({ id }: { id: number }) {
  const { me } = useMe();
  const [, go] = useLocation();
  const toast = useToast();
  const fav = useFavorites();
  const utils = trpc.useUtils();
  const q = trpc.listing.byId.useQuery({ id }, { retry: false });
  const [photo, setPhoto] = useState(0);
  const [modal, setModal] = useState<null | "contact" | "report" | "order">(null);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [owed, setOwed] = useState<number | null>(null);
  const setStatus = trpc.listing.setStatus.useMutation({
    onSuccess: (r) => { utils.listing.invalidate(); utils.support.invalidate(); toast("Publicación actualizada"); if (r.contributionId) setOwed(r.contributionId); },
  });
  const support = useSupport();
  const sellOne = trpc.listing.sellOne.useMutation({
    onSuccess: (r) => { utils.listing.invalidate(); utils.support.invalidate(); toast(r.stays ? "Venta anotada. Tu publicación sigue activa." : r.sold ? "Marcada como vendida" : `Anotado. Te quedan ${r.stock}.`); if (r.contributionId) setOwed(r.contributionId); },
  });
  const report = trpc.report.create.useMutation({ onSuccess: () => { setModal(null); toast("Denuncia enviada. La revisaremos."); }, onError: (e) => toast(e.message, true) });

  if (q.isLoading) return <Loading />;
  if (!q.data) return <div className="wrap py-14"><Empty title="Esta publicación ya no está" action={<Link href="/explorar" className="btn btn-ink">Seguir explorando</Link>}>{q.error?.message}</Empty></div>;
  const l = q.data;
  const s = l.shop;
  const cat = categoryOf(l.category);
  const stocked = hasStock(l.kind, l.deal);
  const needLogin = () => { toast("Entra a tu cuenta para continuar"); go(`/entrar?volver=/p/${id}`); };
  const rows = [
    ["Categoría", cat?.label], ["Modalidad", dealLabel(l.deal)], ["Condición", conditionLabel(l.condition)], ["Talla", l.size],
    ["Medidas", l.measurements], ["Serie", l.series], ["Personaje", l.characterName], ["Entrega", deliveryLabel(l.delivery)],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="wrap pt-5 md:pt-10">
      <nav className="text-sm text-cocoa mb-4 flex flex-wrap gap-x-2" aria-label="Ruta">
        <Link href="/explorar" className="underline underline-offset-2">Explorar</Link><span>/</span>
        <Link href={`/explorar?category=${l.category}`} className="underline underline-offset-2">{cat?.label}</Link>
      </nav>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-7 lg:gap-12 items-start">
        {/* min-w-0: sin esto, una fila larga de miniaturas ensancha toda la página en teléfono */}
        <div className="min-w-0">
          <div className="relative aspect-square rounded-[2rem] overflow-hidden border-[1.5px] border-ink bg-oat">
            <Photo src={l.images[photo]} alt={l.title} accent={s.accent} full eager />
            {l.status !== "active" && (
              <div className="absolute inset-0 bg-cream/75 grid place-items-center">
                <span className="tag !text-lg !px-5 !py-1.5 -rotate-6">{l.status === "sold" ? "Vendido" : l.status === "paused" ? "En pausa" : "Retirado"}</span>
              </div>
            )}
          </div>
          {l.images.length > 1 && (
            <div className="scroll-row mt-3">
              {l.images.map((src, i) => (
                <button key={src} onClick={() => setPhoto(i)} aria-label={`Foto ${i + 1}`} aria-pressed={photo === i}
                  className={`w-[4.5rem] h-[4.5rem] rounded-2xl overflow-hidden bg-oat border-[1.5px] ${photo === i ? "border-ink ring-[3px] ring-yuzu" : "border-ink/30"}`}>
                  <Photo src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {l.kind === "service" ? <span className="tag" style={{ background: "#d8cbf0" }}>Servicio</span> : l.condition && <span className="tag">{conditionLabel(l.condition)}</span>}
            {l.deal !== "venta" && <span className="tag" style={{ background: "#bcdfee" }}>{dealLabel(l.deal)}</span>}
            {l.acceptsTrade && <span className="tag" style={{ background: "#cde4be" }}><Repeat2 size={12} strokeWidth={2.5} />Acepta cambio</span>}
          </div>
          <h1 className="text-[1.75rem] md:text-4xl">{l.title}</h1>
          <p className="text-3xl md:text-4xl font-extrabold mt-3">{formatPrice(l.priceCents, l.deal)}</p>
          {l.supportsApp && <p className="text-sm text-cocoa mt-1">Incluye $1 que el vendedor aporta para mantener Cosland.</p>}
          {stocked && l.status === "active" && l.stock > 1 && <p className="mt-2 font-bold">Quedan {l.stock} disponibles</p>}
          <p className="text-sm text-cocoa mt-2 flex items-center gap-3">
            <span>Publicado {timeAgo(l.createdAt)}</span>
            <span className="inline-flex items-center gap-1"><Eye size={14} />{l.views} {l.views === 1 ? "visita" : "visitas"}</span>
          </p>

          {l.isMine ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/editar/${l.id}`} className="btn btn-ink"><Pencil size={17} />Editar</Link>
              {l.status === "active" && (stocked
                ? <button className="btn btn-matcha" disabled={sellOne.isPending} onClick={() => sellOne.mutate({ id: l.id })}>{l.stock > 1 ? "Vendí una" : "Marcar como vendido"}</button>
                : support?.enabled && <button className="btn btn-matcha" disabled={sellOne.isPending} onClick={() => sellOne.mutate({ id: l.id })}>Anotar una venta</button>)}
              {l.status !== "active" && <button className="btn" onClick={() => setStatus.mutate({ id: l.id, status: "active" })}>Volver a publicar</button>}
              <button className="btn" onClick={() => share(l.title, toast)}><Share2 size={17} />Compartir</button>
            </div>
          ) : (
            <div className="mt-6 grid gap-2.5">
              {l.myOrder ? (
                <div className="panel p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="flex-1 basis-48"><b>Ya lo compraste.</b> Sigue tu pedido en Pedidos.</p>
                  <Link href="/pedidos" className="btn btn-sm btn-ink">Ver mi pedido</Link>
                </div>
              ) : canBuy(l.pay) ? (
                <>
                  <button className="btn btn-ink !min-h-13 text-base" style={{ minHeight: "3.25rem" }} disabled={l.status !== "active"} onClick={() => (me ? setModal("order") : needLogin())}>
                    <ShoppingBag size={19} />{l.kind === "service" ? "Pedir este servicio" : "Comprar"}
                  </button>
                  <p className="text-sm text-cocoa -mt-1">Acepta {[...new Set(l.pay.methods.map((m) => m.label)), ...(l.pay.onDelivery ? ["pago al recibir"] : [])].join(", ")}.</p>
                </>
              ) : null}
              <button className="btn" disabled={l.status !== "active"} onClick={() => (me ? setModal("contact") : needLogin())}>
                <MessageCircle size={18} />Escribir al vendedor
              </button>
              {s.whatsapp && l.status === "active" && (
                <a className="btn btn-matcha" target="_blank" rel="noopener noreferrer"
                  href={whatsappLink(s.whatsapp, `Hola, vi "${l.title}" en Cosland (${location.origin}/p/${l.id}). ¿Sigue disponible?`)}>
                  Preguntar por WhatsApp
                </a>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <button className={`btn ${fav.has(l.id) ? "btn-sakura" : ""}`} aria-pressed={fav.has(l.id)} onClick={() => fav.toggle(l.id)}>
                  <Heart size={17} className={fav.has(l.id) ? "fill-berry text-berry" : ""} />{fav.has(l.id) ? "Guardado" : "Guardar"}
                </button>
                <button className="btn" onClick={() => share(l.title, toast)}><Share2 size={17} />Compartir</button>
              </div>
            </div>
          )}

          <Link href={`/v/${s.handle}`} className="block panel overflow-hidden mt-7 transition-transform hover:-translate-y-0.5">
            <Awning accent={s.accent} size={26} />
            <div className="p-4 flex items-center gap-3.5">
              <Avatar src={s.avatarUrl} name={s.name} accent={s.accent} size={56} />
              <div className="min-w-0">
                <p className="font-extrabold text-lg flex items-center gap-1"><span className="truncate">{s.name}</span>{s.verified && <BadgeCheck size={17} aria-label="Vitrina verificada" />}</p>
                <p className="text-sm text-cocoa">{shopKindLabel(s.kind)}{s.city ? `, ${s.city}` : ""}</p>
                <p className="text-sm mt-0.5 text-cocoa">
                  {s.reviewCount > 0 || s.sales > 0 ? <Reputation rating={s.rating} reviewCount={s.reviewCount} sales={s.sales} size={13} /> : "Aún sin reseñas"}
                </p>
              </div>
              <span className="ml-auto font-bold underline underline-offset-4 shrink-0 text-sm">Ver vitrina</span>
            </div>
          </Link>

          <h2 className="text-xl mt-8 mb-2">Descripción</h2>
          <p className="whitespace-pre-line max-w-prose">{l.description}</p>

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 soft p-5">
            {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-cocoa">{k}</dt><dd className="font-bold">{v}</dd></div>))}
            {s.city && <div className="contents"><dt className="text-cocoa">Ubicación</dt><dd className="font-bold flex items-center gap-1"><MapPin size={15} />{s.city}{s.country ? `, ${s.country}` : ""}</dd></div>}
          </dl>

          <div className="mt-5 rounded-[1.5rem] bg-yuzu/50 p-4 flex gap-3 text-sm">
            <ShieldCheck size={22} className="shrink-0 mt-0.5" />
            <p>Pide fotos o video actuales antes de pagar y prefiere entregas en lugares públicos. <Link href="/compra-segura" className="font-bold underline">Consejos de compra segura</Link></p>
          </div>
          {!l.isMine && (
            <button className="mt-4 text-sm text-cocoa underline underline-offset-2 inline-flex items-center gap-1.5" onClick={() => (me ? setModal("report") : needLogin())}>
              <Flag size={14} />Denunciar esta publicación
            </button>
          )}
        </div>
      </div>

      {l.more.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl md:text-3xl mb-5">Más de {s.name}</h2>
          <ListingGrid items={l.more} />
        </section>
      )}

      {owed && <SupportModal id={owed} title={l.title} onClose={() => setOwed(null)} />}
      {modal === "order" && <CheckoutModal item={l} onClose={() => setModal(null)} />}
      {modal === "contact" && <ContactModal shopId={s.id} shopName={s.name} listingId={l.id} listingTitle={l.title} withOffer={l.kind === "product"} onClose={() => setModal(null)} />}
      {modal === "report" && (
        <Modal title="Denunciar publicación" onClose={() => setModal(null)}>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); report.mutate({ listingId: l.id, reason: reason as any, detail }); }}>
            <Field label="Motivo">
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="Cuéntanos qué pasó (opcional)"><textarea className="input" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} /></Field>
            <button className="btn btn-ink" disabled={report.isPending}>Enviar denuncia</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
