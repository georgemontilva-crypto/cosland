import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Reply, Send, X } from "lucide-react";
import { formatPrice, thumbUrl } from "@shared/catalog";
import { Photo } from "@/components/cards";
import { trpc, timeAgo, whatsappLink } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import PushCard from "@/components/PushCard";
import { Avatar, Empty, Loading, useToast } from "@/components/ui";

type Quote = { id: number; senderId: number; body: string; hasImage: boolean; offerCents: number | null };
// Lo que se ve de un mensaje citado
const quoteText = (q: Quote) => (q.offerCents != null ? `Oferta: ${formatPrice(q.offerCents)}. ` : "") + (q.body || (q.hasImage ? "Foto" : ""));

// Deslizar una burbuja hacia la derecha para responderla, como en WhatsApp. El dedo sigue subiendo y bajando la conversación sin estorbo.
function Swipe({ id, enabled, onReply, className, children }: { id: string; enabled: boolean; onReply: () => void; className: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  const g = useRef({ x: 0, y: 0, dx: 0, on: false, dead: false });
  const move = (dx: number, animate: boolean) => {
    if (row.current) { row.current.style.transition = animate ? "transform 0.2s ease" : "none"; row.current.style.transform = dx ? `translateX(${dx}px)` : ""; }
    if (icon.current) icon.current.style.opacity = String(Math.min(1, dx / TRIGGER));
  };
  return (
    <div id={id} ref={row} className={`relative ${className}`} style={{ touchAction: "pan-y" }}
      onTouchStart={(e) => { const t = e.touches[0]; g.current = { x: t.clientX, y: t.clientY, dx: 0, on: false, dead: !enabled || e.touches.length > 1 }; }}
      onTouchMove={(e) => {
        const s = g.current; if (s.dead) return;
        const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
        if (!s.on) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s.dead = true; return; } // está desplazando la conversación
          if (dx < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          s.on = true;
        }
        s.dx = Math.max(0, Math.min(84, dx * 0.85));
        move(s.dx, false);
      }}
      onTouchEnd={() => {
        const s = g.current;
        if (s.on) { move(0, true); if (s.dx >= TRIGGER) { try { navigator.vibrate?.(8); } catch { /* sin vibración */ } onReply(); } }
        s.on = false; s.dead = true;
      }}
      onTouchCancel={() => { g.current.on = false; move(0, true); }}>
      <span ref={icon} aria-hidden className="absolute top-1/2 -left-9 -mt-6 grid place-items-center w-8 h-8 rounded-full bg-paper border-[1.5px] border-ink/30 opacity-0 pointer-events-none"><Reply size={15} /></span>
      {children}
    </div>
  );
}
const TRIGGER = 56;

function Thread({ id }: { id: number }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.chat.thread.useQuery({ id }, { refetchInterval: 45_000, retry: false });
  const [body, setBody] = useState("");
  const [offer, setOffer] = useState("");
  const [offering, setOffering] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  // Responder a un mensaje concreto: queda citado sobre el cuadro de texto hasta enviar o cancelar
  const [replyTo, setReplyTo] = useState<Quote | null>(null);
  const [picked, setPicked] = useState<number | null>(null); // burbuja tocada: muestra su botón de responder
  const [flash, setFlash] = useState<number | null>(null);
  useEffect(() => { setReplyTo(null); setPicked(null); }, [id]);
  // El cuadro crece con el texto, hasta unas cinco líneas
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 3, 136)}px`;
  }, [body, q.data?.id]);
  const reply = (m: Quote) => { setReplyTo(m); setPicked(null); box.current?.focus(); };
  // Tocar la cita lleva al mensaje original y lo resalta un momento
  const jump = (mid: number) => {
    const el = document.getElementById(`m-${mid}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(mid); setTimeout(() => setFlash((f) => (f === mid ? null : f)), 1400);
  };
  const count = q.data?.messages.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); utils.auth.me.invalidate(); utils.chat.list.invalidate(); }, [count, id]);
  // El mensaje aparece al instante; si el envío falla, se retira y vuelve al cuadro de texto
  const send = trpc.chat.send.useMutation({
    onMutate: async (v) => {
      await utils.chat.thread.cancel({ id });
      const prev = utils.chat.thread.getData({ id });
      if (prev) {
        utils.chat.thread.setData({ id }, {
          ...prev,
          messages: [...prev.messages, {
            id: -Date.now(), senderId: prev.me, body: v.body, offerCents: v.offer != null ? Math.round(v.offer * 100) : null, imageUrl: null, createdAt: new Date().toISOString(),
            replyToId: replyTo?.id ?? null, reply: replyTo,
            listingId: null, listingTitle: null, listingImages: null, listingPrice: null, listingDeal: null,
          }],
        });
      }
      setBody(""); setOffer(""); setOffering(false); setReplyTo(null);
      return { prev, text: v.body, quoted: replyTo };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) utils.chat.thread.setData({ id }, ctx.prev);
      if (ctx) { setBody(ctx.text); setReplyTo(ctx.quoted); }
      toast(e.message, true);
    },
    onSettled: () => utils.chat.thread.invalidate({ id }),
  });

  if (q.isLoading) return <Loading />;
  if (!q.data) return <Empty title="No encontramos esa conversación" />;
  const t = q.data;
  return (
    <div className="flex flex-col h-[calc(100dvh-5.25rem)] md:h-[calc(100dvh-9rem)] md:panel md:overflow-hidden">
      <div className="flex items-center gap-3 px-1 md:px-5 py-3 border-b-[1.5px] border-ink/15">
        <Link href="/mensajes" className="md:hidden btn btn-ghost btn-sm !px-2" aria-label="Volver a mensajes"><ArrowLeft size={20} /></Link>
        <Avatar name={t.otherName} accent={t.accent} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold truncate">{t.otherName}</p>
          {t.otherHandle && <Link href={`/v/${t.otherHandle}`} className="text-sm text-cocoa underline underline-offset-2">Ver vitrina</Link>}
        </div>
        {t.whatsapp && <a className="btn btn-sm btn-matcha" target="_blank" rel="noopener noreferrer" href={whatsappLink(t.whatsapp, "Hola, te escribo desde Cosland.")}>WhatsApp</a>}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 md:px-5 py-4 grid gap-2.5 content-start">
        {t.messages.map((m) => {
          const mine = m.senderId === t.me;
          const quote: Quote = { id: m.id, senderId: m.senderId, body: m.body, hasImage: Boolean(m.imageUrl), offerCents: m.offerCents };
          const sent = m.id > 0; // los que aún se están enviando no se pueden citar
          return (
            <Swipe key={m.id} id={`m-${m.id}`} enabled={sent} onReply={() => reply(quote)}
              className={`group flex items-center gap-1.5 max-w-[88%] md:max-w-[75%] ${mine ? "justify-self-end flex-row-reverse" : "justify-self-start"}`}>
              <div className="min-w-0" onClick={() => sent && setPicked((p) => (p === m.id ? null : m.id))}>
                {m.listingId && m.listingTitle && (
                  <Link href={`/p/${m.listingId}`} className="flex items-center gap-2.5 mb-1 p-1.5 pr-3 rounded-2xl bg-paper border-[1.5px] border-ink/25">
                    {m.listingImages?.[0] && <span className="w-11 h-11 rounded-xl overflow-hidden shrink-0"><Photo src={m.listingImages[0]} alt="" /></span>}
                    <span className="min-w-0"><span className="block text-sm font-bold truncate">{m.listingTitle}</span><span className="block text-xs text-cocoa">{formatPrice(m.listingPrice, m.listingDeal)}</span></span>
                  </Link>
                )}
                <div className={`px-4 py-2.5 rounded-[1.4rem] border-[1.5px] border-ink whitespace-pre-line break-words transition-shadow duration-300 ${mine ? "bg-ink text-cream rounded-br-md" : "bg-paper rounded-bl-md"} ${flash === m.id ? "shadow-[0_0_0_4px_#f8e29c]" : ""}`}>
                  {m.reply && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); jump(m.reply!.id); }} aria-label="Ver el mensaje al que responde"
                      className={`block w-full text-left mb-1.5 -mx-1.5 px-2.5 py-1.5 rounded-xl border-l-4 whitespace-normal ${mine ? "bg-cream/15 border-yuzu" : "bg-oat border-sakura"}`} style={{ width: "calc(100% + 0.75rem)" }}>
                      <span className={`block text-sm font-extrabold ${mine ? "text-yuzu" : ""}`}>{m.reply.senderId === t.me ? "Tú" : t.otherName}</span>
                      <span className={`block text-sm line-clamp-2 ${mine ? "text-cream/85" : "text-cocoa"}`}>{quoteText(m.reply)}</span>
                    </button>
                  )}
                  {m.offerCents != null && <p className={`font-extrabold text-lg ${mine ? "text-yuzu" : ""}`}>Oferta: {formatPrice(m.offerCents)}</p>}
                  {m.body}
                  {m.imageUrl && (
                    <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 -mx-1.5 mb-0.5" aria-label="Abrir la imagen en grande" onClick={(e) => e.stopPropagation()}>
                      <img src={thumbUrl(m.imageUrl)} alt="Imagen enviada en el chat" loading="lazy" decoding="async" width={224} height={288} className="rounded-2xl w-56 max-w-full h-72 object-cover border-[1.5px] border-ink/20 bg-cream"
                        onError={(e) => { const el = e.currentTarget; if (!el.dataset.full) { el.dataset.full = "1"; el.src = m.imageUrl!; } }} />
                    </a>
                  )}
                </div>
                <p className={`text-xs text-cocoa mt-1 ${mine ? "text-right" : ""}`}>{timeAgo(m.createdAt)}</p>
              </div>
              {sent && (
                <button type="button" aria-label="Responder a este mensaje" title="Responder" onClick={() => reply(quote)}
                  className={`shrink-0 place-items-center w-9 h-9 rounded-full border-[1.5px] border-ink/30 bg-paper mb-5 transition-opacity ${picked === m.id ? "grid" : "hidden md:grid opacity-0 pointer-events-none focus-visible:opacity-100 focus-visible:pointer-events-auto md:group-hover:opacity-100 md:group-hover:pointer-events-auto"}`}>
                  <Reply size={17} />
                </button>
              )}
            </Swipe>
          );
        })}
        <div ref={end} />
      </div>

      <form className="px-1 md:px-5 py-3 border-t-[1.5px] border-ink/15" onSubmit={(e) => { e.preventDefault(); if (body.trim() || offer) send.mutate({ id, body: body.trim() || "Te hago esta oferta.", offer: offer ? Number(offer) : undefined, replyTo: replyTo?.id }); }}>
        {offering && (
          <div className="flex items-center gap-2 mb-2">
            <label className="font-bold text-sm" htmlFor="oferta">Oferta en $</label>
            <input id="oferta" className="input !w-28 !min-h-10 !py-1" inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^\d.]/g, ""))} autoFocus />
            <button type="button" className="text-sm underline text-cocoa" onClick={() => { setOffering(false); setOffer(""); }}>Quitar</button>
          </div>
        )}
        {replyTo && (
          <div className="flex items-stretch mb-2 rounded-2xl bg-paper border-[1.5px] border-ink/25 overflow-hidden">
            <span className="w-1.5 bg-sakura shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 px-3 py-1.5">
              <p className="text-sm font-extrabold">Respondiendo a {replyTo.senderId === t.me ? "ti" : t.otherName}</p>
              <p className="text-sm text-cocoa truncate">{quoteText(replyTo)}</p>
            </div>
            <button type="button" className="shrink-0 grid place-items-center w-11" aria-label="Cancelar la respuesta" onClick={() => setReplyTo(null)}><X size={18} /></button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          {!offering && <button type="button" className="btn btn-sm btn-yuzu shrink-0 !min-h-[2.875rem]" onClick={() => setOffering(true)}>Ofertar</button>}
          <textarea ref={box} className="input !min-h-[2.875rem] !rounded-[1.4rem] resize-none" rows={1} placeholder="Mensaje" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === "Escape" && replyTo) { e.preventDefault(); setReplyTo(null); }
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
            }} aria-label="Mensaje" />
          <button className="btn btn-ink shrink-0 !px-4" disabled={!body.trim() && !offer} aria-label="Enviar"><Send size={18} /></button>
        </div>
      </form>
    </div>
  );
}

export default function Messages({ id }: { id?: number }) {
  const { me, loading } = useMe();
  const list = trpc.chat.list.useQuery(undefined, { enabled: Boolean(me), refetchInterval: 60_000 });
  if (loading) return <Loading />;
  if (!me) return <div className="wrap py-14"><Empty title="Entra para ver tus mensajes" action={<Link href="/entrar?volver=/mensajes" className="btn btn-ink">Entrar</Link>} /></div>;

  const inbox = (
    <div>
      <h1 className="text-3xl md:text-4xl mb-5">Mensajes</h1>
      <PushCard className="mb-5" />
      {list.isLoading ? <Loading /> : !list.data?.length ? (
        <Empty title="Sin conversaciones todavía" action={<Link href="/explorar" className="btn btn-ink">Explorar</Link>}>Cuando le escribas a un vendedor o alguien pregunte por tus artículos, la conversación aparece aquí.</Empty>
      ) : (
        <ul className="grid gap-2">
          {list.data.map((c) => (
            <li key={c.id}>
              <Link href={`/mensajes/${c.id}`} className={`flex items-center gap-3 p-3 rounded-[1.5rem] border-[1.5px] ${c.id === id ? "border-ink bg-paper" : "border-transparent hover:bg-paper"}`}>
                <Avatar src={c.otherAvatar} name={c.otherName} accent={c.accent} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2"><span className="font-extrabold truncate">{c.otherName}</span><span className="text-xs text-cocoa shrink-0">{timeAgo(c.lastAt)}</span></p>
                  <p className={`text-sm truncate ${c.unread ? "font-bold" : "text-cocoa"}`}>{c.lastBody}</p>
                  {c.asSeller && <p className="text-xs text-cocoa">Conversación de tu vitrina</p>}
                </div>
                {c.unread > 0 && <span className="min-w-[1.4rem] h-[1.4rem] px-1.5 rounded-full bg-berry text-paper text-xs font-bold grid place-items-center">{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="wrap pt-4 md:pt-10">
      <div className="md:grid md:grid-cols-[22rem_1fr] md:gap-8 md:items-start">
        <div className={id ? "hidden md:block" : ""}>{inbox}</div>
        {id ? <Thread key={id} id={id} /> : <div className="hidden md:grid soft min-h-80 place-items-center text-cocoa font-bold">Elige una conversación</div>}
      </div>
    </div>
  );
}
