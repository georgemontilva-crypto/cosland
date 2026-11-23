import { useState } from "react";
import { BellRing, Share, X } from "lucide-react";
import { useMe } from "@/lib/hooks";
import { usePush } from "@/lib/push";

const KEY = "cosland_avisos";

// Invitación a activar los avisos. Solo sale con sesión iniciada y mientras no estén activados; se puede cerrar.
export default function PushCard({ className = "" }: { className?: string }) {
  const { me } = useMe();
  const { state, enable } = usePush();
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem(KEY) === "0"; } catch { return false; } });
  const [busy, setBusy] = useState(false);
  if (!me || closed || (state !== "off" && state !== "install")) return null;
  const close = () => { setClosed(true); try { localStorage.setItem(KEY, "0"); } catch { /* vale solo para esta visita */ } };
  return (
    <section className={`relative rounded-[1.75rem] border-[1.5px] border-ink bg-ramune/60 p-4 pr-12 flex flex-wrap items-center gap-x-4 gap-y-3 ${className}`} aria-label="Avisos">
      <BellRing size={24} className="shrink-0" />
      <div className="flex-1 basis-56 min-w-0">
        {state === "install" ? (
          <>
            <b className="block">Recibe avisos en tu iPhone</b>
            <p className="text-sm">Añade Cosland a tu pantalla de inicio: toca <Share size={15} className="inline -mt-1" aria-label="Compartir" /> y luego "Añadir a pantalla de inicio". Ábrela desde ese icono y activa los avisos.</p>
          </>
        ) : (
          <>
            <b className="block">Activa los avisos</b>
            <p className="text-sm">Entérate al momento cuando te escriban, te compren o guarden una publicación tuya.</p>
          </>
        )}
      </div>
      {state === "off" && <button className="btn btn-ink" disabled={busy} onClick={async () => { setBusy(true); await enable(); setBusy(false); }}>{busy ? "Activando…" : "Activar avisos"}</button>}
      <button className="absolute top-2.5 right-2.5 grid place-items-center w-9 h-9 rounded-full hover:bg-ink/10" aria-label="Cerrar" onClick={close}><X size={18} /></button>
    </section>
  );
}
