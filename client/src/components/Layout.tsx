import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Compass, Heart, Home as HomeIcon, LogOut, MessageCircle, Plus, Search, Shield, Store, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMe, useRealtime } from "@/lib/hooks";
import InstallHint from "./InstallHint";
import { Avatar } from "./ui";

function SearchBox({ className = "" }: { className?: string }) {
  const [, go] = useLocation();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); go(`/explorar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); };
  return (
    <form onSubmit={submit} role="search" className={`relative ${className}`}>
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cocoa pointer-events-none" />
      <input className="input !rounded-full !pl-11" placeholder="Busca un personaje, serie o artículo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en Cosland" />
    </form>
  );
}

function AccountMenu() {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { utils.invalidate(); location.href = "/"; } });
  if (!me) return <Link href="/entrar" className="btn btn-sm">Entrar</Link>;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Tu cuenta" className="rounded-full block">
        <Avatar src={me.shop?.avatarUrl} name={me.shop?.name ?? me.name} accent={me.shop?.accent} size={40} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="pop absolute right-0 mt-2 w-60 z-50 panel p-2 text-[0.95rem]" onClick={() => setOpen(false)}>
            <p className="px-3 py-2 text-cocoa text-sm truncate">{me.email}</p>
            <Link href="/mi-vitrina" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-oat font-bold"><Store size={18} />Mi vitrina</Link>
            <Link href="/favoritos" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-oat font-bold"><Heart size={18} />Favoritos</Link>
            <Link href="/mensajes" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-oat font-bold"><MessageCircle size={18} />Mensajes</Link>
            {me.role === "admin" && <Link href="/admin" className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-oat font-bold"><Shield size={18} />Administración</Link>}
            <button onClick={() => logout.mutate()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-oat font-bold text-left"><LogOut size={18} />Salir</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const { me } = useMe();
  const inChat = path.startsWith("/mensajes/");
  useRealtime(me?.id ?? null);
  const navLink = (href: string, label: string) => (
    <Link href={href} className={`px-3.5 py-2 rounded-full font-bold ${path.startsWith(href) ? "bg-oat" : "hover:bg-oat"}`}>{label}</Link>
  );
  const tab = (href: string, label: string, icon: ReactNode, match: boolean, badge?: number) => (
    <Link href={href} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-bold relative ${match ? "text-ink" : "text-cocoa"}`} aria-current={match ? "page" : undefined}>
      <span className={`grid place-items-center w-12 h-7 rounded-full ${match ? "bg-yuzu" : ""}`}>{icon}</span>
      {label}
      {badge ? <span className="absolute top-1 left-1/2 ml-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-berry text-paper text-[0.65rem] grid place-items-center">{badge}</span> : null}
    </Link>
  );

  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] btn btn-ink">Saltar al contenido</a>
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b-[1.5px] border-ink/10">
        <div className="wrap flex items-center gap-3 md:gap-5 h-16 md:h-[4.5rem]">
          <Link href="/" aria-label="Cosland, inicio" className="shrink-0 rounded-xl">
            <img src="/logo-ink.png" alt="Cosland" className="h-9 md:h-11 w-auto" width={1280} height={344} />
          </Link>
          <nav className="hidden lg:flex items-center gap-1" aria-label="Principal">
            {navLink("/explorar", "Explorar")}
            {navLink("/vitrinas", "Vitrinas")}
            {navLink("/se-busca", "Se busca")}
          </nav>
          <SearchBox className="hidden md:block flex-1 max-w-md ml-auto" />
          <div className="flex items-center gap-1.5 ml-auto md:ml-0">
            <Link href="/explorar" className="md:hidden btn btn-ghost btn-sm !px-2.5" aria-label="Buscar"><Search size={21} /></Link>
            <Link href="/favoritos" className="btn btn-ghost btn-sm !px-2.5" aria-label="Favoritos"><Heart size={21} /></Link>
            <Link href="/mensajes" className="hidden md:inline-flex btn btn-ghost btn-sm !px-2.5 relative" aria-label={`Mensajes${me?.unread ? `, ${me.unread} sin leer` : ""}`}>
              <MessageCircle size={21} />
              {me?.unread ? <span className="absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-berry text-paper text-[0.68rem] grid place-items-center">{me.unread}</span> : null}
            </Link>
            <Link href="/publicar" className="hidden md:inline-flex btn btn-ink btn-sm"><Plus size={17} strokeWidth={2.6} />Publicar</Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <main id="contenido" className="flex-1">{children}</main>

      {!inChat && (
        <footer className="mt-20 pb-24 md:pb-0">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="block w-full h-8 md:h-12 text-ink" aria-hidden>
            <path fill="currentColor" d="M0 60V32c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v28z" />
          </svg>
          <div className="bg-ink text-cream">
            <div className="wrap pt-10 pb-7 grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
              <div>
                <img src="/logo-cream.png" alt="Cosland" className="h-11 w-auto" />
                <p className="mt-4 text-cream/75 max-w-sm">El mercado de la comunidad cosplayer, otaku y geek. Cada quien con su vitrina.</p>
              </div>
              <nav className="flex flex-col gap-2 font-bold" aria-label="Tienda">
                <Link href="/explorar" className="hover:underline">Explorar</Link>
                <Link href="/vitrinas" className="hover:underline">Vitrinas</Link>
                <Link href="/se-busca" className="hover:underline">Se busca</Link>
              </nav>
              <nav className="flex flex-col gap-2 font-bold" aria-label="Ayuda">
                <Link href="/publicar" className="hover:underline">Publicar un artículo</Link>
                <Link href="/mi-vitrina" className="hover:underline">Abrir mi vitrina</Link>
                <Link href="/compra-segura" className="hover:underline">Consejos de compra segura</Link>
              </nav>
            </div>
            <nav className="wrap pb-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold" aria-label="Legal">
              <Link href="/terminos" className="hover:underline">Términos de uso</Link>
              <Link href="/privacidad" className="hover:underline">Privacidad</Link>
              <Link href="/eliminar-cuenta" className="hover:underline">Eliminar mi cuenta</Link>
            </nav>
            <p className="wrap pb-8 text-sm text-cream/60">Cosland conecta a compradores y vendedores. Cada venta se acuerda directamente entre las dos personas.</p>
          </div>
        </footer>
      )}

      {!inChat && <InstallHint />}

      {/* Barra inferior en el teléfono */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 z-30 bg-paper border-t-[1.5px] border-ink items-end pb-[env(safe-area-inset-bottom)] ${inChat ? "hidden" : "flex"}`} aria-label="Navegación">
        {tab("/", "Inicio", <HomeIcon size={20} />, path === "/")}
        {tab("/explorar", "Explorar", <Compass size={20} />, path.startsWith("/explorar") || path.startsWith("/vitrinas"))}
        <Link href="/publicar" className="flex-1 flex flex-col items-center gap-0.5 pb-2 text-[0.7rem] font-bold -mt-4" aria-label="Publicar">
          <span className="grid place-items-center w-13 h-13 rounded-full bg-sakura border-[1.5px] border-ink" style={{ width: "3.25rem", height: "3.25rem" }}><Plus size={24} strokeWidth={2.6} /></span>
          Publicar
        </Link>
        {tab("/mensajes", "Mensajes", <MessageCircle size={20} />, path.startsWith("/mensajes"), me?.unread || undefined)}
        {tab(me ? "/mi-vitrina" : "/entrar", me ? "Mi vitrina" : "Entrar", me ? <Store size={20} /> : <User size={20} />, path.startsWith("/mi-vitrina") || path === "/entrar")}
      </nav>
    </div>
  );
}
