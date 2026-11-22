import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Send } from "lucide-react";
import { formatPrice } from "@shared/catalog";
import { trpc, timeAgo, whatsappLink } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Avatar, Empty, Loading, useToast } from "@/components/ui";

function Thread({ id }: { id: number }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.chat.thread.useQuery({ id }, { refetchInterval: 45_000, retry: false });
  const [body, setBody] = useState("");
  const [offer, setOffer] = useState("");
  const [offering, setOffering] = useState(false);
  const end = useRef<HTMLDivElement>(null);
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
            id: -Date.now(), senderId: prev.me, body: v.body, offerCents: v.offer != null ? Math.round(v.offer * 100) : null, createdAt: new Date().toISOString(),
            listingId: null, listingTitle: null, listingImages: null, listingPrice: null, listingDeal: null,
          }],
        });
      }
      setBody(""); setOffer(""); setOffering(false);
      return { prev, text: v.body };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) utils.chat.thread.setData({ id }, ctx.prev);
      if (ctx) setBody(ctx.text);
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

      <div className="flex-1 overflow-y-auto px-1 md:px-5 py-4 grid gap-2.5 content-start">
        {t.messages.map((m) => {
          const mine = m.senderId === t.me;
          return (
            <div key={m.id} className={`max-w-[85%] md:max-w-[70%] ${mine ? "justify-self-end" : "justify-self-start"}`}>
              {m.listingId && m.listingTitle && (
                <Link href={`/p/${m.listingId}`} className="flex items-center gap-2.5 mb-1 p-1.5 pr-3 rounded-2xl bg-paper border-[1.5px] border-ink/25">
                  {m.listingImages?.[0] && <img src={m.listingImages[0]} alt="" className="w-11 h-11 rounded-xl object-cover" />}
                  <span className="min-w-0"><span className="block text-sm font-bold truncate">{m.listingTitle}</span><span className="block text-xs text-cocoa">{formatPrice(m.listingPrice, m.listingDeal)}</span></span>
                </Link>
              )}
              <div className={`px-4 py-2.5 rounded-[1.4rem] border-[1.5px] border-ink whitespace-pre-line break-words ${mine ? "bg-ink text-cream rounded-br-md" : "bg-paper rounded-bl-md"}`}>
                {m.offerCents != null && <p className={`font-extrabold text-lg ${mine ? "text-yuzu" : ""}`}>Oferta: {formatPrice(m.offerCents)}</p>}
                {m.body}
              </div>
              <p className={`text-xs text-cocoa mt-1 ${mine ? "text-right" : ""}`}>{timeAgo(m.createdAt)}</p>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <form className="px-1 md:px-5 py-3 border-t-[1.5px] border-ink/15" onSubmit={(e) => { e.preventDefault(); if (body.trim() || offer) send.mutate({ id, body: body.trim() || "Te hago esta oferta.", offer: offer ? Number(offer) : undefined }); }}>
        {offering && (
          <div className="flex items-center gap-2 mb-2">
            <label className="font-bold text-sm" htmlFor="oferta">Oferta en $</label>
            <input id="oferta" className="input !w-28 !min-h-10 !py-1" inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^\d.]/g, ""))} autoFocus />
            <button type="button" className="text-sm underline text-cocoa" onClick={() => { setOffering(false); setOffer(""); }}>Quitar</button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          {!offering && <button type="button" className="btn btn-sm btn-yuzu shrink-0 !min-h-[2.875rem]" onClick={() => setOffering(true)}>Ofertar</button>}
          <textarea className="input !min-h-[2.875rem] !rounded-[1.4rem]" rows={1} placeholder="Escribe un mensaje" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} aria-label="Mensaje" />
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
