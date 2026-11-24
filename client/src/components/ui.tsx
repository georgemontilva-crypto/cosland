import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Star, X } from "lucide-react";
import { accentOf, thumbUrl } from "@shared/catalog";

const INK = "#2a211c";
const PAPER = "#fffaef";

/* El toldo de cada vitrina: franjas con borde festoneado en el color que eligió el vendedor.
   background-repeat: round ajusta el ancho para que siempre quepan festones completos. */
export function Awning({ accent, size = 34, className = "" }: { accent?: string | null; size?: number; className?: string }) {
  const a = accentOf(accent);
  const bg = useMemo(() => {
    const w = size * 1.9, h = size, r = w / 4, drop = h - r - 1.5;
    const scallop = (x: number, fill: string) =>
      `<path d='M${x} -2h${w / 2}v${drop + 2}a${r} ${r} 0 0 1 -${w / 2} 0z' fill='${fill}' stroke='${INK}' stroke-width='1.5'/>`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>${scallop(0, a.hex)}${scallop(w / 2, PAPER)}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [a.hex, size]);
  return (
    <div
      aria-hidden
      className={className}
      style={{ height: size, backgroundImage: bg, backgroundSize: `${size * 1.9}px ${size}px`, backgroundRepeat: "round no-repeat" }}
    />
  );
}

export function Avatar({ src, name, accent, size = 48 }: { src?: string | null; name: string; accent?: string | null; size?: number }) {
  const a = accentOf(accent);
  return src ? (
    <img src={thumbUrl(src)} alt="" width={size} height={size} loading="lazy" decoding="async" className="rounded-full object-cover border-[1.5px] border-ink shrink-0" style={{ width: size, height: size }}
      onError={(e) => { const el = e.currentTarget; if (!el.dataset.full) { el.dataset.full = "1"; el.src = src; } }} />
  ) : (
    <span
      aria-hidden
      className="rounded-full border-[1.5px] border-ink grid place-items-center font-extrabold shrink-0"
      style={{ width: size, height: size, background: a.hex, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} strokeWidth={1.8} className={i <= Math.round(value) ? "fill-yuzu text-ink" : "text-ink/30"} />
      ))}
    </span>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error ? <p className="field-hint !text-berry font-bold">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </label>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="soft text-center px-6 py-12 flex flex-col items-center">
      <img src="/gato-ink.png" alt="" className="w-20 opacity-80 mb-4" />
      <h3 className="text-xl">{title}</h3>
      {children && <p className="text-cocoa mt-2 max-w-md">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="py-16 grid place-items-center text-cocoa" role="status">
      <img src="/gato-ink.png" alt="" className="w-14 animate-pulse" />
      <span className="mt-3 font-bold">{label}…</span>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-ink/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="pop bg-cream w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border-[1.5px] border-ink p-5 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-2xl">{title}</h2>
          <button className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* Avisos breves */
type Toast = { id: number; text: string; bad?: boolean };
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, bad?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, text, bad }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed left-0 right-0 bottom-24 md:bottom-8 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pop pointer-events-auto rounded-full border-[1.5px] border-ink px-5 py-2.5 font-bold text-sm ${t.bad ? "bg-sakura" : "bg-matcha"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
