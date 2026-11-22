import { useState } from "react";
import { Link } from "wouter";
import { formatPrice, shopKindLabel } from "@shared/catalog";
import { trpc, timeAgo } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Loading, useToast } from "@/components/ui";

type Tab = "resumen" | "publicaciones" | "vitrinas" | "usuarios" | "denuncias";

export default function Admin() {
  const { me, loading } = useMe();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("resumen");
  const [q, setQ] = useState("");
  const isAdmin = me?.role === "admin";
  const overview = trpc.admin.overview.useQuery(undefined, { enabled: isAdmin });
  const listings = trpc.admin.listings.useQuery({ q }, { enabled: isAdmin && tab === "publicaciones" });
  const shops = trpc.admin.shops.useQuery(undefined, { enabled: isAdmin && tab === "vitrinas" });
  const users = trpc.admin.users.useQuery(undefined, { enabled: isAdmin && tab === "usuarios" });
  const reports = trpc.admin.reports.useQuery(undefined, { enabled: isAdmin && tab === "denuncias" });
  const done = () => { utils.admin.invalidate(); toast("Listo"); };
  const setListing = trpc.admin.setListing.useMutation({ onSuccess: done });
  const setVerified = trpc.admin.setVerified.useMutation({ onSuccess: done });
  const setBanned = trpc.admin.setBanned.useMutation({ onSuccess: done, onError: (e) => toast(e.message, true) });
  const resolve = trpc.admin.resolveReport.useMutation({ onSuccess: done });

  if (loading) return <Loading />;
  if (!isAdmin) return <div className="wrap py-14"><Empty title="Solo para administradores" action={<Link href="/" className="btn btn-ink">Volver al inicio</Link>} /></div>;
  const o = overview.data;
  const tabs: [Tab, string][] = [["resumen", "Resumen"], ["publicaciones", "Publicaciones"], ["vitrinas", "Vitrinas"], ["usuarios", "Usuarios"], ["denuncias", `Denuncias${o?.openReports ? ` (${o.openReports})` : ""}`]];

  return (
    <div className="wrap pt-6 md:pt-10">
      <h1 className="text-3xl md:text-4xl">Administración</h1>
      <div className="scroll-row mt-5 mb-7">{tabs.map(([id, label]) => <button key={id} className="chip" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>

      {tab === "resumen" && (o ? (
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[["Usuarios", o.users, "#bcdfee"], ["Vitrinas", o.shops, "#f6c3cf"], ["Publicaciones activas", o.listings, "#cde4be"], ["Pedidos abiertos", o.wanted, "#f8e29c"], ["Denuncias por revisar", o.openReports, "#d8cbf0"]].map(([k, v, bg]) => (
            <div key={k as string} className="rounded-[1.75rem] border-[1.5px] border-ink p-5" style={{ background: bg as string }}>
              <dd className="text-4xl font-extrabold">{v}</dd><dt className="font-bold mt-1 text-sm">{k}</dt>
            </div>
          ))}
        </dl>
      ) : <Loading />)}

      {tab === "publicaciones" && (
        <>
          <input className="input !rounded-full max-w-md mb-5" placeholder="Busca por título o vitrina" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar publicaciones" />
          {listings.isLoading ? <Loading /> : (
            <ul className="grid gap-2.5">
              {listings.data?.map((l) => (
                <li key={l.id} className="soft p-3.5 flex flex-wrap items-center gap-3">
                  {l.images[0] && <img src={l.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover border-[1.5px] border-ink" />}
                  <div className="min-w-0 flex-1 basis-56">
                    <Link href={`/p/${l.id}`} className="font-extrabold underline underline-offset-2 line-clamp-1">{l.title}</Link>
                    <p className="text-sm text-cocoa">{formatPrice(l.priceCents, l.deal)}, de {l.shopName}. Estado: {l.status}{l.featured ? ", destacada" : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button className={`btn btn-sm ${l.featured ? "btn-yuzu" : ""}`} onClick={() => setListing.mutate({ id: l.id, featured: !l.featured })}>{l.featured ? "Quitar destacado" : "Destacar"}</button>
                    {l.status === "removed"
                      ? <button className="btn btn-sm" onClick={() => setListing.mutate({ id: l.id, status: "active" })}>Restaurar</button>
                      : <button className="btn btn-sm !text-berry" onClick={() => setListing.mutate({ id: l.id, status: "removed" })}>Retirar</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "vitrinas" && (shops.isLoading ? <Loading /> : (
        <ul className="grid gap-2.5">
          {shops.data?.map((s) => (
            <li key={s.id} className="soft p-3.5 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-56">
                <Link href={`/v/${s.handle}`} className="font-extrabold underline underline-offset-2">{s.name}</Link>
                <p className="text-sm text-cocoa break-all">{shopKindLabel(s.kind)}{s.city ? `, ${s.city}` : ""}. {s.listingCount} publicaciones. {s.email}</p>
              </div>
              <button className={`btn btn-sm ${s.verified ? "btn-matcha" : ""}`} onClick={() => setVerified.mutate({ shopId: s.id, verified: !s.verified })}>{s.verified ? "Verificada" : "Verificar"}</button>
            </li>
          ))}
        </ul>
      ))}

      {tab === "usuarios" && (users.isLoading ? <Loading /> : (
        <ul className="grid gap-2.5">
          {users.data?.map((u) => (
            <li key={u.id} className="soft p-3.5 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-extrabold">{u.name}{u.role === "admin" ? " (admin)" : ""}</p>
                <p className="text-sm text-cocoa break-all">{u.email}. Se unió {timeAgo(u.createdAt)}</p>
              </div>
              {u.role !== "admin" && (
                <button className={`btn btn-sm ${u.banned ? "btn-sakura" : ""}`} onClick={() => { if (u.banned || confirm(`¿Suspender a ${u.name}? Sus publicaciones saldrán de la tienda.`)) setBanned.mutate({ userId: u.id, banned: !u.banned }); }}>
                  {u.banned ? "Quitar suspensión" : "Suspender"}
                </button>
              )}
            </li>
          ))}
        </ul>
      ))}

      {tab === "denuncias" && (reports.isLoading ? <Loading /> : !reports.data?.length ? <Empty title="Sin denuncias" /> : (
        <ul className="grid gap-2.5">
          {reports.data.map((r) => (
            <li key={r.id} className={`soft p-4 flex flex-wrap items-center gap-3 ${r.status === "resolved" ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-extrabold">{r.reason}</p>
                <p className="text-sm">Sobre <Link href={`/p/${r.listingId}`} className="underline font-bold">{r.listingTitle}</Link> ({r.listingStatus}). La envió {r.reporter}, {timeAgo(r.createdAt)}.</p>
                {r.detail && <p className="text-sm text-cocoa mt-1">“{r.detail}”</p>}
              </div>
              {r.status === "open" && (
                <div className="flex gap-1.5">
                  <button className="btn btn-sm !text-berry" onClick={() => { setListing.mutate({ id: r.listingId, status: "removed" }); resolve.mutate({ id: r.id }); }}>Retirar publicación</button>
                  <button className="btn btn-sm" onClick={() => resolve.mutate({ id: r.id })}>Descartar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
