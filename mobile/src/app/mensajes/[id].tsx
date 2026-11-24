import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Reply, Send, X } from "lucide-react-native";
import { formatPrice } from "@shared/catalog";
import { errText, img, timeAgo, trpc, whatsappLink } from "@/lib/api";
import { openExternal } from "@/lib/actions";
import { BORDER, C } from "@/lib/theme";
import { Avatar, Btn, Empty, IconBtn, Input, Loading, Photo, T, useToast } from "@/ui/core";

type Quote = { id: number; senderId: number; body: string; hasImage: boolean; offerCents: number | null };
// Lo que se ve de un mensaje citado
const quoteText = (q: Quote) => (q.offerCents != null ? `Oferta: ${formatPrice(q.offerCents)}. ` : "") + (q.body || (q.hasImage ? "Foto" : ""));
const TRIGGER = 56;
const NATIVE = Platform.OS !== "web";

// Deslizar una burbuja hacia la derecha para responderla, como en WhatsApp. Solo toma el gesto cuando va de lado,
// así la conversación se sigue desplazando con normalidad.
function SwipeRow({ enabled, mine, onReply, onLayoutY, children }: { enabled: boolean; mine: boolean; onReply: () => void; onLayoutY: (y: number) => void; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const act = useRef(onReply); act.current = onReply;
  const on = useRef(enabled); on.current = enabled;
  const pan = useMemo(() => {
    const sideways = (g: { dx: number; dy: number }) => on.current && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
    const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: NATIVE, bounciness: 6 }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => sideways(g),
      onMoveShouldSetPanResponderCapture: (_e, g) => sideways(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => x.setValue(Math.max(0, Math.min(84, g.dx * 0.85))),
      onPanResponderRelease: (_e, g) => { back(); if (g.dx * 0.85 >= TRIGGER) act.current(); },
      onPanResponderTerminate: back,
    });
  }, [x]);
  return (
    <View onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)} style={{ maxWidth: "84%", alignSelf: mine ? "flex-end" : "flex-start" }}>
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: -38, top: "50%", marginTop: -24, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.line, opacity: x.interpolate({ inputRange: [0, TRIGGER], outputRange: [0, 1], extrapolate: "clamp" }) }}>
        <Reply size={15} color={C.ink} />
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
}

export default function Thread() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.chat.thread.useQuery({ id }, { refetchInterval: 45_000, retry: false, enabled: Number.isInteger(id) });
  const [body, setBody] = useState("");
  const [offer, setOffer] = useState("");
  const [offering, setOffering] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const box = useRef<ComponentRef<typeof TextInput>>(null);
  // Responder a un mensaje concreto: queda citado sobre el cuadro de texto hasta enviar o cancelar
  const [replyTo, setReplyTo] = useState<Quote | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const tops = useRef(new Map<number, number>());
  const follow = useRef(true); // seguir pegado al final cuando llegan mensajes; se suelta al ir a un mensaje citado
  const reply = (m: Quote) => { setReplyTo(m); box.current?.focus(); };
  // Tocar la cita lleva al mensaje original y lo resalta un momento
  const jump = (mid: number) => {
    const y = tops.current.get(mid);
    if (y === undefined) return;
    follow.current = false;
    scroll.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
    setFlash(mid); setTimeout(() => setFlash((f) => (f === mid ? null : f)), 1400);
  };
  const count = q.data?.messages.length ?? 0;
  useEffect(() => { utils.auth.me.invalidate(); utils.chat.list.invalidate(); }, [count, utils]);

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
      setBody(""); setOffer(""); setOffering(false); setReplyTo(null); follow.current = true;
      return { prev, text: v.body, quoted: replyTo };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) utils.chat.thread.setData({ id }, ctx.prev); if (ctx) { setBody(ctx.text); setReplyTo(ctx.quoted); } toast(errText(e), true); },
    onSettled: () => utils.chat.thread.invalidate({ id }),
  });
  const submit = () => { if (body.trim() || offer) send.mutate({ id, body: body.trim() || "Te hago esta oferta.", offer: offer ? Number(offer) : undefined, replyTo: replyTo?.id }); };
  const back = () => (router.canGoBack() ? router.back() : router.replace("/mensajes"));
  const t = q.data;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.cream, paddingTop: insets.top }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.faint }}>
        <IconBtn label="Volver a mensajes" onPress={back}><ArrowLeft size={22} color={C.ink} strokeWidth={2.2} /></IconBtn>
        {t && (
          <>
            <Avatar name={t.otherName} accent={t.accent} size={40} />
            <Pressable style={{ flex: 1 }} disabled={!t.otherHandle} accessibilityRole={t.otherHandle ? "link" : undefined} onPress={() => t.otherHandle && router.push(`/v/${t.otherHandle}`)}>
              <T w="black" numberOfLines={1}>{t.otherName}</T>
              {t.otherHandle ? <T size={13} color={C.cocoa} style={{ textDecorationLine: "underline" }}>Ver vitrina</T> : null}
            </Pressable>
            {t.whatsapp ? <Btn small kind="matcha" label="WhatsApp" onPress={() => openExternal(whatsappLink(t.whatsapp!, "Hola, te escribo desde Cosland."))} /> : null}
          </>
        )}
      </View>

      {q.isLoading ? <View style={{ flex: 1 }}><Loading /></View> : !t ? <View style={{ flex: 1, padding: 18 }}><Empty title="No encontramos esa conversación" /></View> : (
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }} keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => { if (follow.current) scroll.current?.scrollToEnd({ animated: false }); }}>
          {t.messages.map((m) => {
            const mine = m.senderId === t.me;
            const thumb = img(m.listingImages?.[0]);
            const quote: Quote = { id: m.id, senderId: m.senderId, body: m.body, hasImage: Boolean(m.imageUrl), offerCents: m.offerCents };
            const sent = m.id > 0; // los que aún se están enviando no se pueden citar
            return (
              <SwipeRow key={m.id} enabled={sent} mine={mine} onReply={() => reply(quote)} onLayoutY={(y) => tops.current.set(m.id, y)}>
                {m.listingId && m.listingTitle ? (
                  <Pressable accessibilityRole="link" accessibilityLabel={`Ver ${m.listingTitle}`} onPress={() => router.push(`/p/${m.listingId}`)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4, padding: 6, paddingRight: 12, borderRadius: 18, backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.line }}>
                    {thumb ? <View style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden" }}><Photo src={m.listingImages?.[0]} /></View> : null}
                    <View style={{ flexShrink: 1 }}><T w="bold" size={13.5} numberOfLines={1}>{m.listingTitle}</T><T size={12} color={C.cocoa}>{formatPrice(m.listingPrice, m.listingDeal)}</T></View>
                  </Pressable>
                ) : null}
                <Pressable disabled={!sent} delayLongPress={320} onLongPress={() => reply(quote)} accessibilityHint="Mantén presionado o desliza a la derecha para responder"
                  accessibilityActions={[{ name: "activate", label: "Responder" }]} onAccessibilityAction={() => reply(quote)}
                  style={[{ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22, borderWidth: flash === m.id ? 3 : BORDER, borderColor: flash === m.id ? C.yuzu : C.ink }, mine ? { backgroundColor: C.ink, borderBottomRightRadius: 6 } : { backgroundColor: C.paper, borderBottomLeftRadius: 6 }]}>
                  {m.reply ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Ver el mensaje al que responde" onPress={() => jump(m.reply!.id)}
                      style={{ marginBottom: 6, marginHorizontal: -5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: mine ? C.yuzu : C.sakura, backgroundColor: mine ? "rgba(251,241,220,0.15)" : C.oat }}>
                      <T w="black" size={13.5} color={mine ? C.yuzu : C.ink}>{m.reply.senderId === t.me ? "Tú" : t.otherName}</T>
                      <T size={13.5} numberOfLines={2} color={mine ? "rgba(251,241,220,0.85)" : C.cocoa}>{quoteText(m.reply)}</T>
                    </Pressable>
                  ) : null}
                  {m.offerCents != null && <T w="black" size={18} color={mine ? C.yuzu : C.ink}>Oferta: {formatPrice(m.offerCents)}</T>}
                  <T color={mine ? C.cream : C.ink}>{m.body}</T>
                  {img(m.imageUrl) ? (
                    <Pressable accessibilityRole="imagebutton" accessibilityLabel="Abrir la imagen en grande" onPress={() => openExternal(img(m.imageUrl)!)} style={{ marginTop: 8 }}>
                      <View style={{ width: 220, height: 280, borderRadius: 16, overflow: "hidden" }}><Photo src={m.imageUrl} /></View>
                    </Pressable>
                  ) : null}
                </Pressable>
                <T size={11.5} color={C.cocoa} style={{ marginTop: 3, textAlign: mine ? "right" : "left" }}>{timeAgo(m.createdAt)}</T>
              </SwipeRow>
            );
          })}
        </ScrollView>
      )}

      {t && (
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 1, borderTopColor: C.faint, gap: 8 }}>
          {offering && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <T w="bold" size={14}>Oferta en $</T>
              <Input value={offer} onChangeText={(v) => setOffer(v.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" autoFocus accessibilityLabel="Oferta en dólares" style={{ width: 110, minHeight: 42 }} />
              <Pressable accessibilityRole="button" onPress={() => { setOffering(false); setOffer(""); }} hitSlop={8}><T size={13.5} color={C.cocoa} style={{ textDecorationLine: "underline" }}>Quitar</T></Pressable>
            </View>
          )}
          {replyTo && (
            <View style={{ flexDirection: "row", alignItems: "stretch", borderRadius: 18, backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.line, overflow: "hidden" }}>
              <View style={{ width: 6, backgroundColor: C.sakura }} />
              <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 6 }}>
                <T w="black" size={13.5}>Respondiendo a {replyTo.senderId === t.me ? "ti" : t.otherName}</T>
                <T size={13.5} color={C.cocoa} numberOfLines={1}>{quoteText(replyTo)}</T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancelar la respuesta" onPress={() => setReplyTo(null)} style={{ width: 46, alignItems: "center", justifyContent: "center" }}><X size={18} color={C.ink} /></Pressable>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            {!offering && <Btn label="Ofertar" kind="yuzu" small style={{ minHeight: 48 }} onPress={() => setOffering(true)} />}
            <Input inputRef={box} value={body} onChangeText={setBody} placeholder="Mensaje" multiline maxLength={2000} accessibilityLabel="Mensaje"
              style={{ flex: 1, minHeight: 48, maxHeight: 120, paddingTop: 12, borderRadius: 24 }} />
            <IconBtn label="Enviar" size={48} bg={body.trim() || offer ? C.ink : C.line} onPress={submit}><Send size={19} color={C.cream} /></IconBtn>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
