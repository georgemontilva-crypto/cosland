import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useLocation } from "wouter";
import { LayoutGrid, Search, X } from "lucide-react";
import { formatPrice } from "@shared/catalog";
import { trpc } from "@/lib/trpc";
import { Photo } from "./cards";
import { Avatar } from "./ui";

type Props = {
  value: string; onChange: (v: string) => void;
  onSubmit: (q: string) => void;          // buscar ese texto
  placeholder: string; label: string;
  big?: boolean;                           // el de la portada
  button?: boolean;                        // con botón "Buscar" al lado
  className?: string;
  inputRef?: RefObject<HTMLInputElement>;
  onLeave?: () => void;                    // se fue a una vitrina o publicación desde una sugerencia
};

// Resalta lo que la persona ya escribió dentro de la sugerencia
function Mark({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<b className="font-extrabold">{text.slice(i, i + q.length)}</b>{text.slice(i + q.length)}</>;
}

// Buscador con sugerencias desde la primera letra: personajes y series, categorías, vitrinas y publicaciones
export default function SearchField({ value, onChange, onSubmit, placeholder, label, big, button, className = "", inputRef, onLeave }: Props) {
  const [, go] = useLocation();
  const own = useRef<HTMLInputElement>(null);
  const input = inputRef ?? own;
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);   // cerrada con Escape hasta que vuelva a escribir
  const [active, setActive] = useState(-1);
  const typed = value.trim();
  // Espera un instante entre teclas para no consultar por cada letra
  const [q, setQ] = useState(typed);
  useEffect(() => { const t = setTimeout(() => setQ(typed), 120); return () => clearTimeout(t); }, [typed]);
  const open = focused && !hidden && typed.length > 0;
  const res = trpc.listing.suggest.useQuery({ q }, { enabled: open && q.length > 0, placeholderData: (prev) => prev, staleTime: 30_000 });
  const data = q && typed ? res.data : undefined;

  const done = () => { setHidden(true); setActive(-1); input.current?.blur(); };
  const search = (text: string) => { onChange(text); done(); onSubmit(text); };
  const leave = (to: string) => { done(); onLeave?.(); go(to); };

  const row = "w-full flex items-center gap-3 px-4 py-2.5 min-h-12 text-left";
  const hint = "ml-auto shrink-0 pl-2 text-sm text-cocoa";
  const options: { key: string; run: () => void; node: ReactNode }[] = !open ? [] : [
    { key: "q", run: () => search(typed), node: <><Search size={18} className="shrink-0 text-cocoa" /><span className="min-w-0 truncate">Buscar "<b className="font-extrabold">{typed}</b>"</span></> },
    ...(data?.terms ?? []).map((t) => ({
      key: `t-${t.kind}-${t.text}`, run: () => search(t.text),
      node: <><Search size={18} className="shrink-0 text-cocoa" /><span className="min-w-0 truncate"><Mark text={t.text} q={typed} /></span><span className={hint}>{t.kind === "personaje" ? "Personaje" : "Serie"}</span></>,
    })),
    ...(data?.categories ?? []).map((c) => ({
      key: `c-${c.id}`, run: () => leave(`/explorar?category=${c.id}`),
      node: <><LayoutGrid size={18} className="shrink-0 text-cocoa" /><span className="min-w-0 truncate"><Mark text={c.label} q={typed} /></span><span className={hint}>Categoría</span></>,
    })),
    ...(data?.shops ?? []).map((s) => ({
      key: `s-${s.handle}`, run: () => leave(`/v/${s.handle}`),
      node: <><Avatar src={s.avatarUrl} name={s.name} accent={s.accent} size={32} /><span className="min-w-0 truncate"><Mark text={s.name} q={typed} /></span><span className={hint}>Vitrina</span></>,
    })),
    ...(data?.items ?? []).map((i) => ({
      key: `i-${i.id}`, run: () => leave(`/p/${i.id}`),
      node: <>
        <span className="w-10 h-10 rounded-xl overflow-hidden border-[1.5px] border-ink/60 bg-oat shrink-0"><Photo src={i.image} alt="" accent={i.shopAccent} /></span>
        <span className="min-w-0"><span className="block leading-snug line-clamp-2"><Mark text={i.title} q={typed} /></span><span className="block text-sm text-cocoa truncate">{i.shopName}</span></span>
        <span className="ml-auto shrink-0 pl-2 font-bold">{formatPrice(i.priceCents, i.deal)}</span>
      </>,
    })),
  ];
  useEffect(() => { setActive(-1); }, [q]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { if (open) { e.preventDefault(); setHidden(true); } return; }
    if (!options.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); options[active].run(); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); done(); onSubmit(typed); };

  return (
    <form onSubmit={submit} role="search" className={`relative flex gap-2 ${className}`}>
      <div className="relative flex-1 min-w-0">
        <Search size={big ? 20 : 18} className={`absolute ${big ? "left-4" : "left-4"} top-1/2 -translate-y-1/2 text-cocoa pointer-events-none`} />
        <input
          ref={input} type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
          className={`input !rounded-full ${big ? "!pl-12 !min-h-14 !text-[1.05rem] !border-ink" : "!pl-11"} ${typed ? "!pr-11" : ""} [&::-webkit-search-cancel-button]:hidden`}
          placeholder={placeholder} aria-label={label} value={value}
          role="combobox" aria-expanded={options.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => { onChange(e.target.value); setHidden(false); }}
          onFocus={() => { setFocused(true); setHidden(false); }} onBlur={() => setFocused(false)} onKeyDown={onKey}
        />
        {typed && (
          <button type="button" aria-label="Borrar la búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full hover:bg-ink/10"
            onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(""); input.current?.focus(); }}><X size={17} /></button>
        )}
      </div>
      {button && <button className={`btn btn-ink ${big ? "!min-h-14 !px-6" : ""}`}>Buscar</button>}
      {options.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Sugerencias"
          className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain rounded-[1.5rem] border-[1.5px] border-ink bg-paper py-1.5 shadow-[0_8px_0_rgba(42,33,28,0.1)]"
          onMouseDown={(e) => e.preventDefault() /* el toque no le quita el foco al campo antes de elegir */}>
          {options.map((o, i) => (
            <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" tabIndex={-1} className={`${row} ${i === active ? "bg-oat" : "hover:bg-oat/60"}`} onClick={o.run} onMouseEnter={() => setActive(i)}>{o.node}</button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
