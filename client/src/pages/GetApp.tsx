import { Download, Share } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Awning } from "@/components/ui";

export const useAppDownload = () => trpc.app.download.useQuery(undefined, { staleTime: 10 * 60_000 }).data;

// Botón de descarga de la app para Android. Mientras no esté en Play Store baja el APK; después lleva a la tienda.
export function AndroidButton({ className = "" }: { className?: string }) {
  const app = useAppDownload();
  if (!app) return null;
  return (
    <a href="/descargar/android" className={`btn btn-ink ${className}`} {...(app.store ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <Download size={19} />{app.store ? "Ver en Google Play" : `Descargar para Android${app.sizeMb ? ` (${app.sizeMb} MB)` : ""}`}
    </a>
  );
}

const STEPS = [
  ["Descarga el archivo", "Toca el botón y espera a que termine. Tu teléfono puede avisarte que es un archivo de instalación: es normal, acepta."],
  ["Ábrelo", "Toca la descarga terminada, o búscala en la carpeta Descargas."],
  ["Permite instalar", "Si Android lo pide, activa “Permitir de esta fuente” para tu navegador y vuelve atrás."],
  ["Instala y entra", "Toca Instalar, abre Cosland y entra con tu cuenta de siempre."],
];

export default function GetApp() {
  const app = useAppDownload();
  return (
    <div className="wrap pt-6 md:pt-10 max-w-3xl">
      <h1 className="text-3xl md:text-5xl">Cosland en tu teléfono</h1>
      <p className="text-cocoa mt-3 text-lg max-w-2xl">La misma tienda, tus mensajes y tu vitrina, a un toque desde la pantalla de inicio.</p>

      <section className="panel overflow-hidden mt-8" aria-labelledby="app-android">
        <Awning accent="matcha" size={30} />
        <div className="p-5 md:p-6">
          <h2 id="app-android" className="text-2xl">Android</h2>
          {app ? (
            <>
              <p className="mt-2 max-w-prose">{app.store ? "La app de Cosland está en Google Play." : "Descarga la app de Cosland directo desde aquí. Es gratis."}</p>
              <AndroidButton className="mt-4 w-full sm:w-auto" />
              {!app.store && (
                <ol className="mt-6 grid gap-3">
                  {STEPS.map(([t, d], i) => (
                    <li key={t} className="flex gap-3">
                      <span className="grid place-items-center w-8 h-8 rounded-full border-[1.5px] border-ink bg-yuzu font-extrabold shrink-0">{i + 1}</span>
                      <span className="min-w-0"><b className="block">{t}</b><span className="text-cocoa">{d}</span></span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : <p className="mt-2 text-cocoa">La app para Android estará disponible aquí muy pronto.</p>}
        </div>
      </section>

      <section className="panel overflow-hidden mt-6" aria-labelledby="app-iphone">
        <Awning accent="ramune" size={30} />
        <div className="p-5 md:p-6">
          <h2 id="app-iphone" className="text-2xl">iPhone</h2>
          <p className="mt-2 max-w-prose">Abre Cosland en Safari, toca <Share size={17} className="inline -mt-1" aria-label="Compartir" /> y luego “Añadir a pantalla de inicio”. Queda con su icono, como una app, y puedes activar los avisos.</p>
        </div>
      </section>
    </div>
  );
}
