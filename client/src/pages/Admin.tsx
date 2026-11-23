import { useEffect, useState } from "react";
import { Link } from "wouter";
import { formatPrice, shopKindLabel } from "@shared/catalog";
import { orderState } from "./Orders";
import { trpc, timeAgo } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Loading, useToast } from "@/components/ui";

type Tab = "resumen" | "publicaciones" | "vitrinas" | "usuarios" | "ventas" | "denuncias" | "aportes";

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
  const sales = trpc.admin.orders.useQuery(undefined, { enabled: isAdmin && tab === "ventas" });
  const reports = trpc.admin.reports.useQuery(undefined, { enabled: isAdmin && tab === "denuncias" });
  const cfg = trpc.admin.supportSettings.useQuery(undefined, { enabled: isAdmin && tab === "aportes" });
  const contribs = trpc.admin.contributions.useQuery(undefined, { enabled: isAdmin && tab === "aportes" });
  const [form, setForm] = useState({ enabled: false, account: "", goal: "" });
  useEffect(() => { if (cfg.data) setForm({ enabled: cfg.data.enabled, account: cfg.data.account, goal: cfg.data.goalCents ? String(cfg.data.goalCents / 100) : "" }); }, [cfg.data]);
  const done = () => { utils.admin.invalidate(); utils.support.invalidate(); toast("Listo"); };
  const saveCfg = trpc.admin.saveSupportSettings.useMutation({ onSuccess: done, onError: (e) => toast(e.message, true) });
  const setContribution = trpc.admin.setContribution.useMutation({ onSuccess: done });
  const setListing = trpc.admin.setListing.useMutation({ onSuccess: done });
  const setVerified = trpc.admin.setVerified.useMutation({ onSuccess: done });
  const setBadge = trpc.admin.setSupportBadge.useMutation({ onSuccess: done });
  const setBanned = trpc.admin.setBanned.useMutation({ onSuccess: done, onError: (e) => toast(e.message, true) });
  const resolve = trpc.admin.resolveReport.useMutation({ onSuccess: done });

  if (loading) return <Loading />;
  if (!isAdmin) return (
    <div className="wrap py-14">
      <Empty title="Solo para administradores" action={me ? <Link href="/" className="btn btn-ink">Volver al inicio</Link> : <Link href="/entrar?volver=/admin" className="btn btn-ink">Entrar a mi cuenta</Link>}>
        {me
          ? <>Entraste como <b className="break-all">{me.email}</b>, y esa cuenta no es de administración. La cuenta de administración es la del correo configurado para Cosland.</>
          : "Entra con la cuenta de administración para ver este panel."}
      </Empty>
    </div>
  );
  const o = overview.data;
  const tabs: [Tab, string][] = [["resumen", "Resumen"], ["publicaciones", "Publicaciones"], ["vitrinas", "Vitrinas"], ["usuarios", "Usuarios"], ["ventas", `Ventas${o?.openOrders ? ` (${o.openOrders})` : ""}`], ["denuncias", `Denuncias${o?.openReports ? ` (${o.openReports})` : ""}`], ["aportes", `Aportes${o?.contributionsToVerify ? ` (${o.contributionsToVerify})` : ""}`]];

  return (
    <div className="wrap pt-6 md:pt-10">
      <h1 className="text-3xl md:text-4xl">Administración</h1>
      <div className="scroll-row mt-5 mb-7">{tabs.map(([id, label]) => <button key={id} className="chip" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>

      {tab === "resumen" && (o ? (
        <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[["Usuarios", o.users, "#bcdfee"], ["Vitrinas", o.shops, "#f6c3cf"], ["Publicaciones activas", o.listings, "#cde4be"], ["Ventas cerradas", o.sales, "#fad0b5"], ["Se busca abiertos", o.wanted, "#f8e29c"], ["Denuncias por revisar", o.openReports, "#d8cbf0"]].map(([k, v, bg]) => (
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
              <button className={`btn btn-sm ${s.supportBadge ? "btn-matcha" : ""}`} aria-pressed={s.supportBadge} onClick={() => setBadge.mutate({ shopId: s.id, on: !s.supportBadge })}>{s.supportBadge ? "Con insignia de apoyo" : "Dar insignia de apoyo"}</button>
              <button className={`btn btn-sm ${s.verified ? "btn-matcha" : ""}`} onClick={() => setVerified.mutate({ shopId: s.id, verified: !s.verified })}>{s.verified ? "Verificada" : "Verificar"}</button>
            </li>
          ))}
        </ul>
      ))}

      {tab === "ventas" && (sales.isLoading ? <Loading /> : !sales.data?.length ? <Empty title="Aún no hay pedidos">Aparecen aquí cuando alguien compra una publicación.</Empty> : (
        <ul className="grid gap-2.5">
          {sales.data.map((v) => (
            <li key={v.id} className="soft p-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="min-w-0 flex-1 basis-64">
                <Link href={`/p/${v.listingId}`} className="font-extrabold leading-snug line-clamp-1">{v.title}{v.quantity > 1 ? ` (${v.quantity} unidades)` : ""}</Link>
                <p className="text-sm text-cocoa break-words">
                  <Link href={`/v/${v.shopHandle}`} className="underline underline-offset-2">{v.shopName}</Link> le vende a {v.buyerName} ({v.buyerEmail}). Pedido {timeAgo(v.createdAt)}
                </p>
              </div>
              <span className="font-bold">{v.unitPriceCents != null ? formatPrice(v.unitPriceCents * v.quantity, "venta") : "A convenir"}</span>
              {v.payLabel && <span className="text-sm text-cocoa">{v.payLabel}</span>}
              <span className="tag !border-ink/40" style={{ background: orderState(v).tone }}>{orderState(v).label}</span>
              {v.contribution && <span className="tag !border-ink/40" style={{ background: v.contribution === "confirmed" ? "#cde4be" : "#f8e29c" }}>Aporte {({ pending: "pendiente", reported: "por verificar", confirmed: "recibido", dismissed: "omitido" } as Record<string, string>)[v.contribution]}</span>}
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

      {tab === "aportes" && (
        <div className="grid gap-8 lg:grid-cols-[22rem_1fr] items-start">
          <form className="panel p-5 grid gap-4" onSubmit={(e) => { e.preventDefault(); saveCfg.mutate({ enabled: form.enabled, account: form.account, goal: form.goal ? Number(form.goal) : 0 }); }}>
            <h2 className="text-xl">Ajustes de aportes</h2>
            <label className="flex items-center gap-3 font-bold">
              <input type="checkbox" className="w-5 h-5 accent-[#2a211c]" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Pedir $1 por venta a los vendedores
            </label>
            <label className="block">
              <span className="field-label">Datos de la cuenta para recibir aportes</span>
              <textarea className="input" rows={5} maxLength={1000} value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} placeholder={"Pago Móvil: banco, teléfono, cédula\nBinance: correo o ID"} />
              <span className="field-hint block">Lo ven los vendedores con sesión iniciada al marcar una venta.</span>
            </label>
            <label className="block">
              <span className="field-label">Meta del mes en dólares</span>
              <input className="input" inputMode="decimal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value.replace(/[^\d.]/g, "") })} placeholder="25" />
              <span className="field-hint block">Lo que cuesta mantener Cosland. Con una meta se muestra el medidor en el Inicio.</span>
            </label>
            <button className="btn btn-ink" disabled={saveCfg.isPending}>Guardar ajustes</button>
          </form>

          <div>
            <h2 className="text-xl mb-3">Aportes de los vendedores</h2>
            {contribs.isLoading ? <Loading /> : !contribs.data?.length ? <Empty title="Aún no hay aportes">Aparecen aquí cuando un vendedor marca vendida una publicación que lleva el dólar para Cosland.</Empty> : (
              <ul className="grid gap-2.5">
                {contribs.data.map((c) => (
                  <li key={c.id} className={`soft p-4 flex flex-wrap items-center gap-3 ${c.status === "confirmed" ? "opacity-70" : ""}`}>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-extrabold">{formatPrice(c.amountCents)} de {c.shopName ?? "una vitrina eliminada"}</p>
                      <p className="text-sm text-cocoa">
                        {c.listingTitle ? `Por “${c.listingTitle}”. ` : ""}
                        {c.status === "pending" ? "Aún no lo envía." : c.status === "reported" ? `Dice que lo envió ${timeAgo(c.reportedAt ?? c.createdAt)}.` : `Confirmado ${timeAgo(c.confirmedAt ?? c.createdAt)}.`}
                        {c.reference ? ` Referencia: ${c.reference}.` : ""}
                      </p>
                      {c.proofUrl && <a href={c.proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold underline">Ver comprobante</a>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.status !== "confirmed" && <button className="btn btn-sm btn-matcha" onClick={() => setContribution.mutate({ id: c.id, status: "confirmed" })}>Confirmar recibido</button>}
                      {c.status === "reported" && <button className="btn btn-sm" onClick={() => setContribution.mutate({ id: c.id, status: "dismissed" })}>No llegó</button>}
                      {c.status === "confirmed" && <button className="btn btn-sm" onClick={() => setContribution.mutate({ id: c.id, status: "reported" })}>Deshacer</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
