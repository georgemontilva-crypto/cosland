import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AtSign, BadgeCheck, Clock, MapPin, MessageCircle, Pencil, Share2, Star, Store } from "lucide-react";
import { shopKindLabel } from "@shared/catalog";
import { trpc, timeAgo, whatsappLink } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Awning, Avatar, Empty, Field, Loading, Stars, useToast } from "@/components/ui";
import { ListingGrid } from "@/components/cards";
import ContactModal from "@/components/ContactModal";
import FollowersModal from "@/components/FollowersModal";
import { share } from "./ListingPage";

function Reviews({ shopId, shopName }: { shopId: number; shopName: string }) {
  const { me } = useMe();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.review.list.useQuery({ shopId });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const save = trpc.review.save.useMutation({
    onSuccess: () => { utils.review.invalidate(); utils.shop.invalidate(); setComment(""); toast("Reseña publicada"); },
    onError: (e) => toast(e.message, true),
  });
  if (q.isLoading) return <Loading />;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] items-start">
      <div className="grid gap-3">
        {q.data?.items.length ? q.data.items.map((r) => (
          <article key={r.id} className="soft p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-extrabold">{r.author}</p>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p className="mt-2 whitespace-pre-line">{r.comment}</p>}
            <p className="text-sm text-cocoa mt-2">{timeAgo(r.createdAt)}</p>
          </article>
        )) : <Empty title="Aún sin reseñas">Las reseñas las dejan quienes ya le escribieron a {shopName} por una compra.</Empty>}
      </div>
      <div className="panel p-5">
        <h3 className="text-lg">Deja tu reseña</h3>
        {!me ? <p className="text-cocoa mt-2"><Link href="/entrar" className="font-bold underline">Entra a tu cuenta</Link> para opinar.</p>
          : !q.data?.canReview ? <p className="text-cocoa mt-2">Podrás opinar después de escribirle a esta vitrina por una compra o servicio.</p>
          : (
            <form className="grid gap-3 mt-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ shopId, rating, comment }); }}>
              <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button type="button" key={i} role="radio" aria-checked={rating === i} aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`} onClick={() => setRating(i)} className="p-1 rounded-full">
                    <Star size={30} strokeWidth={1.8} className={i <= rating ? "fill-yuzu" : "text-ink/30"} />
                  </button>
                ))}
              </div>
              <Field label="¿Cómo te fue?"><textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Trato, tiempos de entrega, calidad…" /></Field>
              <button className="btn btn-ink" disabled={save.isPending}>Publicar reseña</button>
            </form>
          )}
      </div>
    </div>
  );
}

export default function ShopPage({ handle }: { handle: string }) {
  const { me } = useMe();
  const [, go] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.shop.byHandle.useQuery({ handle }, { retry: false });
  const [tab, setTab] = useState<"all" | "product" | "service" | "reviews">("all");
  const [contact, setContact] = useState(false);
  const [followers, setFollowers] = useState(false);
  const items = trpc.listing.search.useQuery({ shopId: q.data?.id, kind: tab === "product" || tab === "service" ? tab : undefined }, { enabled: Boolean(q.data) && tab !== "reviews" });
  const follow = trpc.shop.toggleFollow.useMutation({
    onSuccess: (r) => { utils.shop.invalidate(); toast(r.following ? "Ahora sigues esta vitrina" : "Dejaste de seguir esta vitrina"); },
  });

  if (q.isLoading) return <Loading />;
  if (!q.data) return <div className="wrap py-14"><Empty title="No encontramos esa vitrina" action={<Link href="/vitrinas" className="btn btn-ink">Ver vitrinas</Link>} /></div>;
  const s = q.data;
  const needLogin = () => { toast("Entra a tu cuenta para continuar"); go(`/entrar?volver=/v/${handle}`); };
  const tabBtn = (id: typeof tab, label: string) => <button className="chip" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>;

  return (
    <div>
      <Awning accent={s.accent} size={44} className="unroll" />
      <div className="wrap">
        {s.bannerUrl && (
          <div className="mt-5 aspect-[3/1] md:aspect-[4/1] rounded-[2rem] overflow-hidden border-[1.5px] border-ink">
            <img src={s.bannerUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className={`flex flex-col md:flex-row md:items-end gap-4 md:gap-6 ${s.bannerUrl ? "-mt-10 md:-mt-12 px-4 md:px-8" : "mt-8"}`}>
          <Avatar src={s.avatarUrl} name={s.name} accent={s.accent} size={112} />
          <div className="flex-1 min-w-0 md:pb-1">
            <h1 className="text-3xl md:text-5xl flex items-center gap-2 flex-wrap">
              {s.name}{s.verified && <BadgeCheck size={28} aria-label="Vitrina verificada" />}
            </h1>
            <p className="text-cocoa mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{shopKindLabel(s.kind)}</span>
              {s.city && <span className="inline-flex items-center gap-1"><MapPin size={15} />{s.city}{s.country ? `, ${s.country}` : ""}</span>}
              {s.reviewCount > 0 && <span className="inline-flex items-center gap-1.5"><Stars value={s.rating} size={14} />{s.rating.toFixed(1)} ({s.reviewCount})</span>}
              <button className="font-bold text-ink underline underline-offset-4" onClick={() => setFollowers(true)}>{s.followers} {s.followers === 1 ? "seguidor" : "seguidores"}</button>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {s.isMine ? (
            <>
              <Link href="/mi-vitrina/editar" className="btn btn-ink"><Pencil size={17} />Editar vitrina</Link>
              <Link href="/publicar" className="btn btn-sakura">Publicar algo nuevo</Link>
            </>
          ) : (
            <>
              <button className={`btn ${s.isFollowing ? "" : "btn-ink"}`} aria-pressed={s.isFollowing} onClick={() => (me ? follow.mutate({ shopId: s.id }) : needLogin())}>{s.isFollowing ? "Siguiendo" : "Seguir"}</button>
              <button className="btn" onClick={() => (me ? setContact(true) : needLogin())}><MessageCircle size={17} />Escribir</button>
              {s.whatsapp && <a className="btn btn-matcha" target="_blank" rel="noopener noreferrer" href={whatsappLink(s.whatsapp, `Hola, vi tu vitrina "${s.name}" en Cosland.`)}>WhatsApp</a>}
            </>
          )}
          {s.instagram && <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://instagram.com/${s.instagram}`}><AtSign size={17} />Instagram</a>}
          {s.tiktok && <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://tiktok.com/@${s.tiktok}`}>TikTok</a>}
          <button className="btn" onClick={() => share(`${s.name} en Cosland`, toast)}><Share2 size={17} />Compartir</button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr] items-start">
          {s.bio && <p className="whitespace-pre-line max-w-prose text-[1.05rem]">{s.bio}</p>}
          {s.hasStore && (s.address || s.hours) && (
            <div className="panel p-5">
              <h2 className="text-lg flex items-center gap-2"><Store size={19} />Tienda física</h2>
              {s.address && (
                <p className="mt-2 flex gap-2"><MapPin size={17} className="shrink-0 mt-1" />
                  <a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.address} ${s.city ?? ""}`)}`}>{s.address}</a>
                </p>
              )}
              {s.hours && <p className="mt-1.5 flex gap-2"><Clock size={17} className="shrink-0 mt-1" />{s.hours}</p>}
            </div>
          )}
        </div>

        <div className="scroll-row mt-9 mb-6">
          {tabBtn("all", `Todo (${s.listingCount})`)}
          {tabBtn("product", "Artículos")}
          {tabBtn("service", "Servicios")}
          {tabBtn("reviews", `Reseñas (${s.reviewCount})`)}
        </div>

        {tab === "reviews" ? <Reviews shopId={s.id} shopName={s.name} /> : items.isLoading ? <Loading /> : items.data?.items.length ? <ListingGrid items={items.data.items} /> : (
          <Empty title="Esta vitrina aún está vacía" action={s.isMine ? <Link href="/publicar" className="btn btn-sakura">Publicar mi primer artículo</Link> : undefined}>
            {s.isMine ? "Sube tu primera publicación para que te encuentren." : "Síguela para enterarte cuando publique algo."}
          </Empty>
        )}
      </div>
      {contact && <ContactModal shopId={s.id} shopName={s.name} onClose={() => setContact(false)} />}
      {followers && <FollowersModal shopId={s.id} mine={s.isMine} onClose={() => setFollowers(false)} />}
    </div>
  );
}
