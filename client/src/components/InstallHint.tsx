import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Share, X } from "lucide-react";
import { useAppDownload } from "@/pages/GetApp";

// Invitación a llevar Cosland en el teléfono. En Android ofrece descargar la app; si aún no hay descarga,
// abre el diálogo del navegador para instalarla como acceso directo. En iPhone explica el paso manual.
const KEY = "cosland_install_hint";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallHint() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);
  const [android, setAndroid] = useState(false);
  const app = useAppDownload();

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = Boolean(localStorage.getItem(KEY)); } catch { /* sin almacenamiento */ }
    if (standalone || dismissed) return;

    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); setShow(true); };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
    const t = isIos ? setTimeout(() => { setIos(true); setShow(true); }, 8000) : undefined;
    setAndroid(/android/i.test(navigator.userAgent) && !dismissed);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); clearTimeout(t); };
  }, []);

  // En Android, con la app lista para bajar, se ofrece esa en vez del acceso directo
  const native = android && Boolean(app);
  if (!show && !native) return null;
  const dismiss = () => { setShow(false); setAndroid(false); try { localStorage.setItem(KEY, "1"); } catch { /* no pasa nada */ } };
  const install = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    dismiss();
  };

  return (
    <div className="pop fixed inset-x-3 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-96 z-40 panel p-3.5 flex items-center gap-3">
      <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-[0.9rem] shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-extrabold text-base leading-tight">Lleva Cosland en tu teléfono</p>
        {ios
          ? <p className="text-cocoa mt-0.5">Toca <Share size={14} className="inline -mt-1" aria-label="Compartir" /> y luego “Agregar a inicio”.</p>
          : native
            ? <p className="text-cocoa mt-0.5">{app?.store ? "La app está en Google Play." : `Descarga la app para Android${app?.sizeMb ? `, pesa ${app.sizeMb} MB` : ""}.`}</p>
            : <p className="text-cocoa mt-0.5">Se abre como una app y el chat te queda a un toque.</p>}
      </div>
      {native
        ? app?.store
          ? <a className="btn btn-ink btn-sm shrink-0" href="/descargar/android" target="_blank" rel="noopener noreferrer" onClick={dismiss}>Abrir</a>
          : <Link className="btn btn-ink btn-sm shrink-0" href="/app" onClick={dismiss}>Descargar</Link>
        : !ios && <button className="btn btn-ink btn-sm shrink-0" onClick={install}>Instalar</button>}
      <button className="btn btn-ghost btn-sm !px-2 shrink-0" onClick={dismiss} aria-label="Cerrar"><X size={18} /></button>
    </div>
  );
}
