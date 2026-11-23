import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { uploadImage } from "@/lib/trpc";
import { useToast } from "./ui";

// Varias fotos; la primera es la portada
export function PhotosInput({ value, onChange, max = 8 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(0);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, max - value.length);
    setBusy(list.length);
    const added: string[] = [];
    for (const f of list) {
      try { added.push(await uploadImage(f)); } catch (e) { toast((e as Error).message, true); }
      setBusy((b) => b - 1);
    }
    onChange([...value, ...added]);
    if (ref.current) ref.current.value = "";
  };
  const move = (i: number) => { const v = [...value]; const [x] = v.splice(i, 1); v.unshift(x); onChange(v); };
  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {value.map((src, i) => (
          <div key={src} className="relative aspect-square rounded-2xl overflow-hidden border-[1.5px] border-ink bg-oat">
            <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-contain" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Quitar foto ${i + 1}`} className="absolute top-1 right-1 w-8 h-8 grid place-items-center rounded-full bg-paper border-[1.5px] border-ink"><X size={15} /></button>
            {i === 0
              ? <span className="tag absolute left-1 bottom-1 !text-[0.68rem]">Portada</span>
              : <button type="button" onClick={() => move(i)} className="tag absolute left-1 bottom-1 !text-[0.68rem]">Usar de portada</button>}
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-oat animate-pulse" />)}
        {value.length + busy < max && (
          <button type="button" onClick={() => ref.current?.click()} className="aspect-square rounded-2xl border-[1.5px] border-dashed border-ink grid place-items-center text-center text-sm font-bold hover:bg-paper p-2">
            <span className="grid place-items-center gap-1"><ImagePlus size={24} />Agregar fotos</span>
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      <p className="field-hint">Hasta {max} fotos. Muestra el artículo completo, los detalles y cualquier desgaste.</p>
    </div>
  );
}

export function SinglePhoto({ value, onChange, label, shape = "wide" }: { value: string | null; onChange: (v: string | null) => void; label: string; shape?: "round" | "wide" }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadImage(f)); } catch (e) { toast((e as Error).message, true); }
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => ref.current?.click()} aria-label={label}
        className={`overflow-hidden border-[1.5px] border-dashed border-ink grid place-items-center bg-paper shrink-0 ${shape === "round" ? "w-24 h-24 rounded-full" : "w-44 h-20 rounded-2xl"} ${busy ? "animate-pulse" : ""}`}>
        {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={22} />}
      </button>
      <div className="grid gap-1.5">
        <button type="button" className="btn btn-sm" onClick={() => ref.current?.click()}>{value ? "Cambiar" : label}</button>
        {value && <button type="button" className="text-sm underline text-cocoa text-left" onClick={() => onChange(null)}>Quitar</button>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
