import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Send } from "lucide-react-native";
import { formatPrice } from "@shared/catalog";
import { errText, img, timeAgo, trpc, whatsappLink } from "@/lib/api";
import { openExternal } from "@/lib/actions";
import { BORDER, C } from "@/lib/theme";
import { Avatar, Btn, Empty, IconBtn, Input, Loading, T, useToast } from "@/ui/core";

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
            id: -Date.now(), senderId: prev.me, body: v.body, offerCents: v.offer != null ? Math.round(v.offer * 100) : null, createdAt: new Date().toISOString(),
            listingId: null, listingTitle: null, listingImages: null, listingPrice: null, listingDeal: null,
          }],
        });
      }
      setBody(""); setOffer(""); setOffering(false);
      return { prev, text: v.body };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) utils.chat.thread.setData({ id }, ctx.prev); if (ctx) setBody(ctx.text); toast(errText(e), true); },
    onSettled: () => utils.chat.thread.invalidate({ id }),
  });
  const submit = () => { if (body.trim() || offer) send.mutate({ id, body: body.trim() || "Te hago esta oferta.", offer: offer ? Number(offer) : undefined }); };
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
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
          {t.messages.map((m) => {
            const mine = m.senderId === t.me;
            const thumb = img(m.listingImages?.[0]);
            return (
              <View key={m.id} style={{ maxWidth: "84%", alignSelf: mine ? "flex-end" : "flex-start" }}>
                {m.listingId && m.listingTitle ? (
                  <Pressable accessibilityRole="link" accessibilityLabel={`Ver ${m.listingTitle}`} onPress={() => router.push(`/p/${m.listingId}`)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4, padding: 6, paddingRight: 12, borderRadius: 18, backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.line }}>
                    {thumb ? <Image source={{ uri: thumb }} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" /> : null}
                    <View style={{ flexShrink: 1 }}><T w="bold" size={13.5} numberOfLines={1}>{m.listingTitle}</T><T size={12} color={C.cocoa}>{formatPrice(m.listingPrice, m.listingDeal)}</T></View>
                  </Pressable>
                ) : null}
                <View style={[{ paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22, borderWidth: BORDER, borderColor: C.ink }, mine ? { backgroundColor: C.ink, borderBottomRightRadius: 6 } : { backgroundColor: C.paper, borderBottomLeftRadius: 6 }]}>
                  {m.offerCents != null && <T w="black" size={18} color={mine ? C.yuzu : C.ink}>Oferta: {formatPrice(m.offerCents)}</T>}
                  <T color={mine ? C.cream : C.ink}>{m.body}</T>
                </View>
                <T size={11.5} color={C.cocoa} style={{ marginTop: 3, textAlign: mine ? "right" : "left" }}>{timeAgo(m.createdAt)}</T>
              </View>
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
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            {!offering && <Btn label="Ofertar" kind="yuzu" small style={{ minHeight: 48 }} onPress={() => setOffering(true)} />}
            <Input value={body} onChangeText={setBody} placeholder="Escribe un mensaje" multiline maxLength={2000} accessibilityLabel="Mensaje"
              style={{ flex: 1, minHeight: 48, maxHeight: 120, paddingTop: 12, borderRadius: 24 }} />
            <IconBtn label="Enviar" size={48} bg={body.trim() || offer ? C.ink : C.line} onPress={submit}><Send size={19} color={C.cream} /></IconBtn>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
