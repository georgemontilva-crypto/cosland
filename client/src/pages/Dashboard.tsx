import { Link } from "wouter";
import { Eye, Pencil, Plus, Share2 } from "lucide-react";
import { formatPrice } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Awning, Avatar, Empty, Loading, useToast } from "@/components/ui";
import { Photo } from "@/components/cards";
import ShopForm from "./ShopForm";
import FollowersModal from "@/components/FollowersModal";
import { SupportMeter, SupportModal, useSupport } from "@/components/Support";
import { useState } from "react";

const STATUS: Record<string, { label: string; bg: string }> = {
  active: { label: "Publicado", bg: "#cde4be" }, paused: { label: "En pausa", bg: "#f8e29c" }, sold: { label: "Vendido", bg: "#d8cbf0" },
};

export default function Dashboard() {
  const { me, loading } = useMe();
  const toast = useToast();
  const utils = trpc.useUtils();
  const mine = trpc.listing.mine.useQuery(undefined, { enabled: Boolean(me?.shop) });
  const support = useSupport();
  const dues = trpc.support.mine.useQuery(undefined, { enabled: Boolean(me?.shop) && Boolean(support?.enabled) });
  const [owed, setOwed] = useState<null | { id: number; title?: string | null }>(null);
  const setStatus = trpc.listing.setStatus.useMutation({
    onSuccess: (r, v) => {
      utils.listing.invalidate(); utils.support.invalidate(); toast("Publicación actualizada");
      if (r.contributionId) setOwed({ id: r.contributionId, title: mine.data?.find((l) => l.id === v.id)?.title });
    },
  });

  const [followers, setFollowers] = useState(false);
  if (loading) return <Loading />;
  if (!me || !me.shop) return <ShopForm />;
  const shop = me.shop;
  const items = mine.data ?? [];
  const views = items.reduce((a, l) => a + l.views, 0);
  const url = `${location.origin}/v/${shop.handle}`;
  const copy = async () => {
    try { if (navigator.share) await navigator.share({ title: shop.name, url }); else { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } } catch { /* cancelado */ }
  };

  return (
    <div className="wrap pt-6 md:pt-10">
      <div className="panel overflow-hidden">
        <Awning accent={shop.accent} size={36} />
        <div className="p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Avatar src={shop.avatarUrl} name={shop.name} accent={shop.accent} size={72} />
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl truncate">{shop.name}</h1>
              <Link href={`/v/${shop.handle}`} className="text-cocoa underline underline-offset-2 text-sm break-all">Ver mi vitrina como la ve el público</Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/publicar" className="btn btn-ink"><Plus size={18} strokeWidth={2.6} />Publicar</Link>
            <button className="btn" onClick={copy}><Share2 size={17} />Compartir vitrina</button>
            <Link href="/mi-vitrina/editar" className="btn"><Pencil size={17} />Editar</Link>
          </div>
        </div>
        <dl className="grid grid-cols-4 border-t-[1.5px] border-ink text-center">
          {[["Publicadas", items.filter((l) => l.status === "active").length], ["Vendidas", items.filter((l) => l.status === "sold").length], ["Visitas", views]].map(([k, v]) => (
            <div key={k} className="py-4 border-r-[1.5px] border-ink"><dd className="text-2xl md:text-3xl font-extrabold">{v}</dd><dt className="text-sm text-cocoa">{k}</dt></div>
          ))}
          <button className="py-4 hover:bg-oat" onClick={() => setFollowers(true)} aria-label={`${shop.followers} seguidores, ver quiénes son`}>
            <dd className="text-2xl md:text-3xl font-extrabold">{shop.followers}</dd><dt className="text-sm text-cocoa underline underline-offset-4">Seguidores</dt>
          </button>
        </dl>
      </div>

      {support?.enabled && (
        <section className="mt-8 grid gap-4 lg:grid-cols-2 items-start" aria-label="Aportes a Cosland">
          <SupportMeter />
          {(dues.data?.length ?? 0) > 0 && (
            <div className="soft p-5">
              <h2 className="text-xl">Tus aportes</h2>
              <ul className="grid gap-2.5 mt-3">
                {dues.data!.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="min-w-0 flex-1 basis-40 truncate font-bold">{c.listingTitle ?? "Aporte"}</span>
                    {c.status === "pending" && <button className="btn btn-sm btn-matcha" onClick={() => setOwed({ id: c.id, title: c.listingTitle })}>Enviar {formatPrice(c.amountCents)}</button>}
                    {c.status === "reported" && <span className="tag" style={{ background: "#f8e29c" }}>Por confirmar</span>}
                    {c.status === "confirmed" && <span className="tag" style={{ background: "#cde4be" }}>Recibido, gracias</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <h2 className="text-2xl mt-10 mb-4">Mis publicaciones</h2>
      {mine.isLoading ? <Loading /> : !items.length ? (
        <Empty title="Tu vitrina está lista para su primer artículo" action={<Link href="/publicar" className="btn btn-sakura">Publicar ahora</Link>}>
          Un cosplay que ya no usas, una peluca, una figura o el servicio que ofreces.
        </Empty>
      ) : (
        <ul className="grid gap-3">
          {items.map((l) => (
            <li key={l.id} className="soft p-3 flex gap-3.5 items-center">
              <Link href={`/p/${l.id}`} className="w-20 h-20 rounded-2xl overflow-hidden border-[1.5px] border-ink shrink-0 block"><Photo src={l.images[0]} alt="" accent={shop.accent} /></Link>
              <div className="min-w-0 flex-1">
                <Link href={`/p/${l.id}`} className="font-extrabold leading-snug line-clamp-1">{l.title}</Link>
                <p className="text-sm mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold">{formatPrice(l.priceCents, l.deal)}</span>
                  <span className="tag !border-ink/40" style={{ background: STATUS[l.status]?.bg }}>{STATUS[l.status]?.label}</span>
                  <span className="text-cocoa inline-flex items-center gap-1"><Eye size={13} />{l.views}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link href={`/editar/${l.id}`} className="btn btn-sm">Editar</Link>
                  {l.status === "active" && <button className="btn btn-sm btn-matcha" onClick={() => setStatus.mutate({ id: l.id, status: "sold" })}>Vendido</button>}
                  {l.status === "active" && <button className="btn btn-sm" onClick={() => setStatus.mutate({ id: l.id, status: "paused" })}>Pausar</button>}
                  {l.status !== "active" && <button className="btn btn-sm" onClick={() => setStatus.mutate({ id: l.id, status: "active" })}>Volver a publicar</button>}
                  <button className="btn btn-sm btn-ghost !text-berry" onClick={() => { if (confirm(`¿Eliminar "${l.title}"? No se puede deshacer.`)) setStatus.mutate({ id: l.id, status: "removed" }); }}>Eliminar</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {followers && <FollowersModal shopId={shop.id} mine onClose={() => setFollowers(false)} />}
      {owed && <SupportModal id={owed.id} title={owed.title} onClose={() => setOwed(null)} />}
    </div>
  );
}
