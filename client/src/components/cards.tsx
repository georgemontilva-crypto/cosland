import { Link } from "wouter";
import { BadgeCheck, Heart, HeartHandshake, MapPin, Repeat2, Sparkles, Store } from "lucide-react";
import { accentOf, categoryOf, conditionLabel, dealLabel, formatPrice, shopKindLabel, thumbUrl } from "@shared/catalog";
import type { Card, ShopCardData } from "@/lib/trpc";
import { useFavorites } from "@/lib/hooks";
import { Awning, Avatar, Stars } from "./ui";

// Vitrina que apoyó a Cosland y por eso sale primero. Se marca siempre, para que quien compra sepa por qué está arriba.
export function FeaturedTag({ className = "" }: { className?: string }) {
  return <span className={`tag ${className}`} style={{ background: "#f8e29c" }} title="Esta vitrina apoyó a Cosland y sale primero por unos días"><Sparkles size={12} strokeWidth={2.4} />Destacada</span>;
}

// Las fotos de publicaciones van siempre en un marco cuadrado: la imagen se acerca hasta llenarlo
// Por defecto pide la miniatura (liviana); "full" pide la foto grande, para verla en detalle.
// Si la miniatura aún no existe (fotos viejas), cae sola a la grande.
export function Photo({ src, alt, accent, className = "", full, eager }: { src?: string | null; alt: string; accent?: string | null; className?: string; full?: boolean; eager?: boolean }) {
  return src ? (
    <img src={full ? src : thumbUrl(src)} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" className={`object-cover w-full h-full ${className}`}
      onError={(e) => { const el = e.currentTarget; if (!el.dataset.full) { el.dataset.full = "1"; el.src = src; } }} />
  ) : (
    <div className={`w-full h-full grid place-items-center ${className}`} style={{ background: accentOf(accent).hex }}>
      <img src="/gato-ink.png" alt="" className="w-2/5 opacity-70" />
    </div>
  );
}

export function ListingCard({ item }: { item: Card }) {
  const fav = useFavorites();
  const on = fav.has(item.id);
  const badge = item.kind === "service" ? "Servicio" : item.deal !== "venta" ? dealLabel(item.deal) : conditionLabel(item.condition);
  return (
    <article className="group relative">
      <Link href={`/p/${item.id}`} className="block rounded-[1.6rem]">
        <div className="relative aspect-square rounded-[1.6rem] overflow-hidden border-[1.5px] border-ink bg-oat">
          <Photo src={item.images[0]} alt={item.title} accent={item.shopAccent} className="transition-transform duration-300 group-hover:scale-[1.03]" />
          {item.shopFeatured > 0 && <FeaturedTag className="absolute left-2.5 top-2.5" />}
          {item.status === "sold" && (
            <div className="absolute inset-0 bg-cream/75 grid place-items-center"><span className="tag !text-base !px-4 !py-1 -rotate-6">Vendido</span></div>
          )}
          <div className="absolute left-2.5 bottom-2.5 flex flex-wrap gap-1.5">
            {badge && <span className="tag">{badge}</span>}
            {item.acceptsTrade && <span className="tag" style={{ background: "#cde4be" }}><Repeat2 size={12} strokeWidth={2.5} />Acepta cambio</span>}
          </div>
        </div>
        <div className="pt-2.5 px-1">
          <p className="font-extrabold text-lg leading-tight">{formatPrice(item.priceCents, item.deal)}</p>
          <h3 className="!font-bold text-[0.95rem] leading-snug mt-0.5 line-clamp-2">{item.title}</h3>
          <p className="text-cocoa text-sm mt-1 flex items-center gap-1 truncate">
            <span className="truncate">{item.shopName}</span>
            {item.shopVerified && <BadgeCheck size={14} className="shrink-0 text-ink" aria-label="Vitrina verificada" />}
            {item.shopCity && <span className="truncate">en {item.shopCity}</span>}
          </p>
        </div>
      </Link>
      <button
        onClick={() => fav.toggle(item.id)}
        aria-pressed={on}
        aria-label={on ? "Quitar de favoritos" : "Guardar en favoritos"}
        className={`absolute top-2.5 right-2.5 w-10 h-10 grid place-items-center rounded-full border-[1.5px] border-ink transition-transform active:scale-90 ${on ? "bg-sakura" : "bg-paper"}`}
      >
        <Heart size={18} strokeWidth={2.2} className={on ? "fill-berry text-berry" : ""} />
      </button>
    </article>
  );
}

export function ListingGrid({ items }: { items: Card[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3.5 gap-y-7 md:gap-x-5">
      {items.map((it) => <ListingCard key={it.id} item={it} />)}
    </div>
  );
}

/* Tarjeta de vitrina: una fachada con su toldo */
export function ShopCard({ shop }: { shop: Pick<ShopCardData, "handle" | "name" | "kind" | "avatarUrl" | "accent" | "city" | "verified" | "hasStore" | "listingCount" | "rating" | "reviewCount"> & { supporter?: number; sales?: number; featured?: number } }) {
  return (
    <Link href={`/v/${shop.handle}`} className="relative block h-full panel overflow-hidden transition-transform hover:-translate-y-1">
      <Awning accent={shop.accent} size={30} />
      {(shop.featured ?? 0) > 0 && <FeaturedTag className="absolute right-3 top-3" />}
      <div className="px-4 pb-4 pt-3 flex items-center gap-3">
        <Avatar src={shop.avatarUrl} name={shop.name} accent={shop.accent} size={56} />
        <div className="min-w-0">
          <h3 className="text-[1.05rem] flex items-center gap-1">
            <span className="truncate">{shop.name}</span>
            {shop.verified && <BadgeCheck size={16} className="shrink-0" aria-label="Vitrina verificada" />}
          </h3>
          <p className="text-cocoa text-sm truncate">{shopKindLabel(shop.kind)}</p>
          <p className="text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-cocoa">
            {shop.city && <span className="inline-flex items-center gap-1"><MapPin size={13} />{shop.city}</span>}
            {shop.hasStore && <span className="inline-flex items-center gap-1"><Store size={13} />Tienda física</span>}
            {(shop.supporter ?? 0) > 0 && <span className="inline-flex items-center gap-1 text-ink font-bold"><HeartHandshake size={13} />Apoya a Cosland</span>}
          </p>
          <p className="text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {shop.reviewCount > 0 && <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Stars value={shop.rating} size={13} /><span className="text-cocoa">({shop.reviewCount})</span></span>}
            {(shop.sales ?? 0) > 0 && <span className="font-bold whitespace-nowrap">{shop.sales} {shop.sales === 1 ? "venta" : "ventas"}</span>}
            <span className="text-cocoa whitespace-nowrap">{shop.listingCount} {shop.listingCount === 1 ? "publicación" : "publicaciones"}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

export function CategoryBubble({ id, active }: { id: string; active?: boolean }) {
  const c = categoryOf(id)!;
  return (
    <Link href={`/explorar?category=${c.id}`} className={`chip flex-col !items-start !gap-0 !rounded-[1.25rem] !py-2 ${active ? "chip-on" : ""}`}>
      <span>{c.short}</span>
      <span className={`kana text-[0.65rem] ${active ? "!text-cream/70" : ""}`}>{c.jp}</span>
    </Link>
  );
}
