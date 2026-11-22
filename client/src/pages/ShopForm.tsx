import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ACCENTS, COUNTRIES, SHOP_KINDS, slugify } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Awning, Avatar, Empty, Field, Loading, useToast } from "@/components/ui";
import { SinglePhoto } from "@/components/ImageUploader";

const blank = {
  handle: "", name: "", kind: "cosplayer", bio: "", avatarUrl: null as string | null, bannerUrl: null as string | null, accent: "sakura",
  city: "", country: "Venezuela", whatsapp: "", instagram: "", tiktok: "", hasStore: false, address: "", hours: "",
};

export default function ShopForm() {
  const { me, loading } = useMe();
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const mine = trpc.shop.mine.useQuery(undefined, { enabled: Boolean(me) });
  const [f, setF] = useState(blank);
  const [touchedHandle, setTouchedHandle] = useState(false);
  const [error, setError] = useState("");
  const isNew = !mine.data;

  useEffect(() => {
    if (mine.data) {
      const s = mine.data;
      setF({
        handle: s.handle, name: s.name, kind: s.kind, bio: s.bio ?? "", avatarUrl: s.avatarUrl, bannerUrl: s.bannerUrl, accent: s.accent,
        city: s.city ?? "", country: s.country ?? "Venezuela", whatsapp: s.whatsapp ?? "", instagram: s.instagram ?? "", tiktok: s.tiktok ?? "",
        hasStore: s.hasStore, address: s.address ?? "", hours: s.hours ?? "",
      });
      setTouchedHandle(true);
    }
  }, [mine.data]);

  const save = trpc.shop.save.useMutation({
    onSuccess: () => { utils.invalidate(); toast(isNew ? "Tu vitrina ya está abierta" : "Vitrina guardada"); go("/mi-vitrina"); },
    onError: (e) => { let m = e.message; try { m = JSON.parse(e.message)[0].message; } catch { /* mensaje normal */ } setError(m); },
  });

  if (loading || (me && mine.isLoading)) return <Loading />;
  if (!me) return <div className="wrap py-14"><Empty title="Entra para abrir tu vitrina" action={<Link href="/registro?volver=/mi-vitrina" className="btn btn-ink">Crear mi cuenta</Link>}>Solo necesitas un correo y una contraseña.</Empty></div>;

  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setName = (name: string) => setF((p) => ({ ...p, name, handle: touchedHandle ? p.handle : slugify(name) }));

  return (
    <div className="wrap pt-6 md:pt-10 max-w-3xl">
      <h1 className="text-3xl md:text-5xl">{isNew ? "Abre tu vitrina" : "Editar vitrina"}</h1>
      <p className="text-cocoa mt-2">Así te verá la comunidad. Puedes cambiar todo después.</p>

      {/* Vista previa en vivo */}
      <div className="panel overflow-hidden mt-6">
        <Awning accent={f.accent} size={34} />
        <div className="p-4 flex items-center gap-3.5">
          <Avatar src={f.avatarUrl} name={f.name || "?"} accent={f.accent} size={60} />
          <div className="min-w-0">
            <p className="font-extrabold text-xl truncate">{f.name || "El nombre de tu vitrina"}</p>
            <p className="text-cocoa text-sm truncate">cosland/v/{f.handle || "tu-enlace"}</p>
          </div>
        </div>
      </div>

      <form className="grid gap-5 mt-7" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate({ ...f, kind: f.kind as any, accent: f.accent as any }); }}>
        <Field label="Nombre de la vitrina"><input className="input" required minLength={2} maxLength={80} value={f.name} onChange={(e) => setName(e.target.value)} placeholder="El Taller de Sakura" /></Field>
        <Field label="Enlace de tu vitrina" hint="Letras, números y guiones. Es el enlace que vas a compartir.">
          <input className="input" required pattern="[a-z0-9\-]{3,40}" value={f.handle} onChange={(e) => { setTouchedHandle(true); setF((p) => ({ ...p, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })); }} />
        </Field>
        <Field label="¿Qué tipo de vitrina es?">
          <select className="input" value={f.kind} onChange={up("kind")}>{SHOP_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
        </Field>

        <fieldset>
          <legend className="field-label">Color de tu toldo</legend>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button type="button" key={a.id} onClick={() => setF((p) => ({ ...p, accent: a.id }))} aria-pressed={f.accent === a.id}
                className={`flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full border-[1.5px] font-bold text-sm ${f.accent === a.id ? "border-ink bg-paper" : "border-ink/25"}`}>
                <span className="w-7 h-7 rounded-full border-[1.5px] border-ink" style={{ background: a.hex }} />{a.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid sm:grid-cols-2 gap-5">
          <div><span className="field-label">Foto de perfil</span><SinglePhoto value={f.avatarUrl} onChange={(v) => setF((p) => ({ ...p, avatarUrl: v }))} label="Subir foto" shape="round" /></div>
          <div><span className="field-label">Portada</span><SinglePhoto value={f.bannerUrl} onChange={(v) => setF((p) => ({ ...p, bannerUrl: v }))} label="Subir portada" /></div>
        </div>

        <Field label="Cuéntale a la comunidad quién eres"><textarea className="input" rows={4} maxLength={1000} value={f.bio} onChange={up("bio")} placeholder="Qué haces, desde cuándo, qué tipo de trabajos tomas…" /></Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Ciudad"><input className="input" maxLength={80} value={f.city} onChange={up("city")} placeholder="Maracaibo" /></Field>
          <Field label="País"><select className="input" value={f.country} onChange={up("country")}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          <Field label="WhatsApp" hint="Con código de país. Ej. +58 412…"><input className="input" inputMode="tel" maxLength={30} value={f.whatsapp} onChange={up("whatsapp")} /></Field>
          <Field label="Instagram"><input className="input" maxLength={60} value={f.instagram} onChange={up("instagram")} placeholder="tu_usuario" /></Field>
          <Field label="TikTok"><input className="input" maxLength={60} value={f.tiktok} onChange={up("tiktok")} placeholder="tu_usuario" /></Field>
        </div>

        <div className="soft p-5">
          <label className="flex items-center gap-3 font-bold">
            <input type="checkbox" className="w-5 h-5 accent-[#2a211c]" checked={f.hasStore} onChange={(e) => setF((p) => ({ ...p, hasStore: e.target.checked }))} />
            Tengo tienda física
          </label>
          {f.hasStore && (
            <div className="grid gap-4 mt-4">
              <Field label="Dirección"><input className="input" maxLength={255} value={f.address} onChange={up("address")} placeholder="C.C. Galerías, local 12" /></Field>
              <Field label="Horario"><input className="input" maxLength={255} value={f.hours} onChange={up("hours")} placeholder="Lunes a sábado, 10 am a 7 pm" /></Field>
            </div>
          )}
        </div>

        {error && <p role="alert" className="rounded-2xl bg-sakura/60 px-4 py-2.5 font-bold text-sm">{error}</p>}
        <div className="flex gap-2.5">
          <button className="btn btn-ink flex-1 sm:flex-none" disabled={save.isPending}>{save.isPending ? "Guardando…" : isNew ? "Abrir mi vitrina" : "Guardar cambios"}</button>
          {!isNew && <Link href="/mi-vitrina" className="btn">Cancelar</Link>}
        </div>
      </form>
    </div>
  );
}
