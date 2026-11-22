import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CATEGORIES, CONDITIONS, DEALS, DELIVERY, SIZES, categoryOf } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Empty, Field, Loading, useToast } from "@/components/ui";
import { PhotosInput } from "@/components/ImageUploader";
import { useSupport } from "@/components/Support";
import { formatPrice } from "@shared/catalog";

const WEARABLE = ["cosplay", "pelucas", "accesorios", "merch"];
const FANDOM = ["cosplay", "pelucas", "props", "accesorios", "figuras", "manga", "cartas", "merch", "arte", "videojuegos"];

const blank = {
  category: "cosplay", deal: "venta", title: "", description: "", price: "", acceptsTrade: false, condition: "usado",
  size: "", measurements: "", series: "", characterName: "", delivery: "ambos", images: [] as string[], supportsApp: true,
};

export default function ListingForm({ id }: { id?: number }) {
  const { me, loading } = useMe();
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const existing = trpc.listing.byId.useQuery({ id: id! }, { enabled: Boolean(id) });
  const [f, setF] = useState(blank);
  const [error, setError] = useState("");
  const support = useSupport();

  useEffect(() => {
    const l = existing.data;
    if (l) setF({
      category: l.category, deal: l.deal, title: l.title, description: l.description,
      // El precio guardado ya incluye el dólar para Cosland; aquí se muestra el del vendedor
      price: l.priceCents != null ? String((l.priceCents - (l.supportsApp ? 100 : 0)) / 100) : "", supportsApp: l.supportsApp,
      acceptsTrade: l.acceptsTrade, condition: l.condition ?? "usado", size: l.size ?? "", measurements: l.measurements ?? "",
      series: l.series ?? "", characterName: l.characterName ?? "", delivery: l.delivery, images: l.images,
    });
  }, [existing.data]);

  const save = trpc.listing.save.useMutation({
    onSuccess: (r) => { utils.listing.invalidate(); toast(id ? "Cambios guardados" : "Publicado"); go(`/p/${r.id}`); },
    onError: (e) => { let m = e.message; try { m = JSON.parse(e.message)[0].message; } catch { /* mensaje normal */ } setError(m); },
  });

  if (loading || (id && existing.isLoading)) return <Loading />;
  if (!me) return <div className="wrap py-14"><Empty title="Entra para publicar" action={<Link href="/registro?volver=/publicar" className="btn btn-ink">Crear mi cuenta</Link>}>Publicar es gratis y toma un par de minutos.</Empty></div>;
  if (!me.shop) return <div className="wrap py-14"><Empty title="Primero abre tu vitrina" action={<Link href="/mi-vitrina" className="btn btn-ink">Abrir mi vitrina</Link>}>Tus publicaciones viven en tu vitrina. Crearla toma un minuto.</Empty></div>;
  if (id && existing.data && !existing.data.isMine) return <div className="wrap py-14"><Empty title="Esta publicación no es tuya" /></div>;

  const isService = categoryOf(f.category)?.kind === "service";
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const deals = isService ? DEALS.filter((d) => d.id === "encargo") : DEALS;

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!isService && f.images.length === 0) { setError("Agrega al menos una foto del artículo."); return; }
    save.mutate({
      id, category: f.category as any, deal: (isService ? "encargo" : f.deal) as any, title: f.title, description: f.description,
      price: f.price ? Number(f.price) : null, acceptsTrade: !isService && f.acceptsTrade, condition: isService ? null : (f.condition as any),
      size: WEARABLE.includes(f.category) ? f.size : "", measurements: WEARABLE.includes(f.category) ? f.measurements : "",
      series: FANDOM.includes(f.category) ? f.series : "", characterName: FANDOM.includes(f.category) ? f.characterName : "",
      delivery: f.delivery as any, images: f.images,
      supportsApp: Boolean(support?.enabled) && f.supportsApp,
    });
  };

  return (
    <div className="wrap pt-6 md:pt-10 max-w-3xl">
      <h1 className="text-3xl md:text-5xl">{id ? "Editar publicación" : "Publicar"}</h1>
      <form className="grid gap-5 mt-7" onSubmit={submit}>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="¿Qué vas a publicar?">
            <select className="input" value={f.category} onChange={up("category")}>
              <optgroup label="Artículos">{CATEGORIES.filter((c) => c.kind === "product").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
              <optgroup label="Servicios">{CATEGORIES.filter((c) => c.kind === "service").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
            </select>
          </Field>
          {!isService && (
            <Field label="Modalidad" hint={f.deal === "alquiler" ? "El precio es por evento." : f.deal === "encargo" ? "Lo haces a pedido; el precio es desde." : undefined}>
              <select className="input" value={f.deal} onChange={up("deal")}>{deals.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
            </Field>
          )}
        </div>

        <div><span className="field-label">Fotos{isService ? " de trabajos anteriores" : ""}</span><PhotosInput value={f.images} onChange={(images) => setF((p) => ({ ...p, images }))} /></div>

        <Field label="Título"><input className="input" required minLength={4} maxLength={120} value={f.title} onChange={up("title")} placeholder={isService ? "Confección de cosplay a medida" : "Cosplay de Nezuko completo con peluca"} /></Field>
        <Field label="Descripción" hint={isService ? "Qué incluye, tiempos de entrega y cómo trabajas." : "Qué incluye, cuántas veces se usó y cualquier detalle o desgaste."}>
          <textarea className="input" rows={6} required minLength={10} maxLength={5000} value={f.description} onChange={up("description")} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label={isService || f.deal === "encargo" ? "Precio desde, en dólares" : f.deal === "alquiler" ? "Precio por evento, en dólares" : "Precio en dólares"} hint="Déjalo vacío si es a convenir.">
            <input className="input" inputMode="decimal" value={f.price} onChange={(e) => setF((p) => ({ ...p, price: e.target.value.replace(/[^\d.]/g, "") }))} placeholder="45" />
          </Field>
          {!isService && (
            <Field label="Condición">
              <select className="input" value={f.condition} onChange={up("condition")}>{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            </Field>
          )}
        </div>

        {WEARABLE.includes(f.category) && (
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Talla"><select className="input" value={f.size} onChange={up("size")}><option value="">Sin talla</option>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Medidas" hint="Busto, cintura, cadera, largo. Ayuda mucho a decidir."><input className="input" maxLength={255} value={f.measurements} onChange={up("measurements")} placeholder="Busto 88, cintura 70, largo 95 cm" /></Field>
          </div>
        )}

        {FANDOM.includes(f.category) && (
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Serie, anime o juego"><input className="input" maxLength={100} value={f.series} onChange={up("series")} placeholder="Kimetsu no Yaiba" /></Field>
            <Field label="Personaje"><input className="input" maxLength={100} value={f.characterName} onChange={up("characterName")} placeholder="Nezuko Kamado" /></Field>
          </div>
        )}

        <Field label="Entrega">
          <select className="input" value={f.delivery} onChange={up("delivery")}>{DELIVERY.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
        </Field>

        {!isService && (
          <label className="flex items-center gap-3 font-bold soft p-4">
            <input type="checkbox" className="w-5 h-5 accent-[#2a211c]" checked={f.acceptsTrade} onChange={(e) => setF((p) => ({ ...p, acceptsTrade: e.target.checked }))} />
            Acepto cambiarlo por otro artículo
          </label>
        )}

        {support?.enabled && (
          <div className="rounded-[1.5rem] border-[1.5px] border-ink bg-matcha/50 p-4">
            <label className="flex items-start gap-3 font-bold">
              <input type="checkbox" className="w-5 h-5 mt-0.5 accent-[#2a211c]" checked={f.supportsApp} onChange={(e) => setF((p) => ({ ...p, supportsApp: e.target.checked }))} />
              <span>Sumar {formatPrice(support.amountCents)} al precio para mantener viva Cosland</span>
            </label>
            <p className="text-sm mt-2 ml-8">
              {f.supportsApp
                ? f.price && !Number.isNaN(Number(f.price))
                  ? <>Tu publicación saldrá en <strong>{formatPrice(Math.round(Number(f.price) * 100) + support.amountCents)}</strong>. Cuando vendas, envías ese dólar a Cosland. Es voluntario.</>
                  : <>Cuando vendas, envías {formatPrice(support.amountCents)} a Cosland. Es voluntario.</>
                : "Publicar sigue siendo gratis. Puedes activarlo cuando quieras."}
            </p>
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl bg-sakura/60 px-4 py-2.5 font-bold text-sm">{error}</p>}
        <div className="flex gap-2.5">
          <button className="btn btn-ink flex-1 sm:flex-none" disabled={save.isPending}>{save.isPending ? "Guardando…" : id ? "Guardar cambios" : "Publicar"}</button>
          <Link href="/mi-vitrina" className="btn">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
