import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Download, X } from "lucide-react";
import { useAppDownload } from "@/pages/GetApp";

// Banner de abajo para llevar Cosland en el teléfono. Le sale a todo el mundo:
// en Android baja la app, en iPhone explica cómo añadirla al inicio y en computador lleva a la página de descarga.
// No le sale a quien ya la tiene: si la abrió instalada, si el navegador detecta la app, o si ya tocó descargar.
const KEY = "cosland_app_banner";      // "listo" = no mostrar más · un número = cerrado en esa fecha
const SNOOZE_MS = 7 * 24 * 3600_000;   // al cerrarlo con la X vuelve a salir a la semana
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Related = Navigator & { getInstalledRelatedApps?: () => Promise<{ id?: string; platform?: string }[]> };

function hiddenByChoice() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "listo" || (v !== null && Date.now() - Number(v) < SNOOZE_MS);
  } catch { return false; }
}
const remember = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* vale solo para esta visita */ } };

export default function InstallHint() {
  const [path, go] = useLocation();
  const app = useAppDownload();
  const [device, setDevice] = useState<"android" | "ios" | "desktop" | null>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone || hiddenByChoice()) return;
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setDevice(ios ? "ios" : /android/i.test(ua) ? "android" : "desktop");
    setHidden(false);

    // Android con la app ya instalada: el navegador lo sabe y el banner no sale más
    let live = true;
    (navigator as Related).getInstalledRelatedApps?.().then((apps) => {
      if (live && apps.some((a) => a.id === "com.cosland.app")) { remember("listo"); setHidden(true); }
    }).catch(() => {});

    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => { remember("listo"); setHidden(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { live = false; window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (hidden || !device || path === "/app") return null;
  const close = () => { setHidden(true); remember(String(Date.now())); };
  const done = () => { setHidden(true); remember("listo"); };
  const pwa = async () => {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") done(); else close();
  };

  const btn = "btn btn-sm btn-yuzu shrink-0 !px-3.5";
  let title: string, text: string, action: ReactNode;
  if (device === "ios") {
    title = "Instala Cosland"; text = "Añádela al inicio.";
    action = <Link href="/app" className={btn} onClick={close}>Ver cómo</Link>;
  } else if (app?.store) {
    title = "Descarga la app"; text = "Está en Google Play.";
    action = <a href="/descargar/android" target="_blank" rel="noopener noreferrer" className={btn} onClick={done}>Abrir</a>;
  } else if (app && device === "android") {
    title = "Descarga la app"; text = `Gratis${app.sizeMb ? `, ${app.sizeMb} MB` : ""}.`;
    // Empieza la descarga y, de una vez, muestra los pasos para instalarla
    action = <a href="/descargar/android" className={btn} onClick={() => { done(); setTimeout(() => go("/app"), 400); }}><Download size={16} className="hidden md:block" />Descargar</a>;
  } else if (app) {
    title = "Cosland para Android"; text = "Descarga la app para tu teléfono.";
    action = <Link href="/app" className={btn} onClick={close}><Download size={16} className="hidden md:block" />Descargar</Link>;
  } else if (event) {
    // Aún no hay app para bajar: se ofrece instalar la web como acceso directo
    title = "Instala Cosland"; text = "Se abre como una app.";
    action = <button className={btn} onClick={pwa}>Instalar</button>;
  } else return null;

  return (
    <aside aria-label="Descargar la app" className="pop fixed z-40 inset-x-2 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] md:inset-x-0 md:bottom-0 bg-ink text-cream rounded-[1.4rem] md:rounded-none border-[1.5px] border-ink shadow-[0_6px_0_rgba(42,33,28,0.12)] md:shadow-none">
      <div className="flex items-center gap-2.5 py-2 pl-2.5 pr-1 md:py-2.5 md:max-w-[76rem] md:mx-auto md:px-8">
        <img src="/icon-192.png" alt="" width={40} height={40} className="w-10 h-10 rounded-xl shrink-0" />
        <p className="min-w-0 flex-1 leading-tight">
          <b className="block font-extrabold text-[0.97rem]">{title}</b>
          <span className="block text-sm text-cream/75">{text}</span>
        </p>
        {action}
        <button className="grid place-items-center w-9 h-10 rounded-full shrink-0 hover:bg-cream/10" onClick={close} aria-label="Cerrar"><X size={18} /></button>
      </div>
    </aside>
  );
}
