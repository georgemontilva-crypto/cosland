import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MapPin, Plus } from "lucide-react-native";
import { CATEGORIES, SIZES, categoryOf, formatPrice } from "@shared/catalog";
import { errText, timeAgo, trpc } from "@/lib/api";
import { requireLogin, useSession } from "@/lib/session";
import { BORDER, C, NOTE } from "@/lib/theme";
import { Btn, Empty, Field, Input, Loading, Screen, Select, Sheet, T, useToast } from "@/ui/core";

const blank = { title: "", description: "", category: "cosplay", budget: "", size: "", city: "" };

export default function Wanted() {
  const { me } = useSession();
  const toast = useToast();
  const utils = trpc.useUtils();
  const params = useLocalSearchParams<{ nuevo?: string }>();
  const [creating, setCreating] = useState(params.nuevo === "1" && Boolean(me));
  const [answer, setAnswer] = useState<null | { id: number; title: string }>(null);
  const [reply, setReply] = useState("");
  const [f, setF] = useState(blank);
  const list = trpc.wanted.list.useQuery();
  const create = trpc.wanted.create.useMutation({
    onSuccess: () => { utils.wanted.invalidate(); utils.listing.home.invalidate(); setCreating(false); setF(blank); toast("Pedido publicado"); },
    onError: (e) => toast(errText(e), true),
  });
  const close = trpc.wanted.close.useMutation({ onSuccess: () => { utils.wanted.invalidate(); utils.listing.home.invalidate(); toast("Pedido cerrado"); } });
  const send = trpc.chat.answerWanted.useMutation({
    onSuccess: (r) => { setAnswer(null); toast("Mensaje enviado"); router.push(`/mensajes/${r.id}`); },
    onError: (e) => toast(errText(e), true),
  });
  const login = () => { toast("Entra a tu cuenta para continuar"); requireLogin("/se-busca"); };
  const respond = (w: { id: number; title: string }) => {
    if (!me) return login();
    if (!me.shop) { toast("Crea tu vitrina para responder pedidos"); router.push("/cuenta"); return; }
    setReply(""); setAnswer(w);
  };

  return (
    <Screen title="Se busca">
      <T color={C.cocoa}>El tablero de pedidos de la comunidad. Di qué necesitas y los vendedores que lo tengan te escriben.</T>
      <Btn label="Publicar lo que busco" kind="ink" icon={<Plus size={18} color={C.cream} strokeWidth={2.6} />} onPress={() => (me ? setCreating(true) : login())} style={{ marginTop: 14, marginBottom: 18 }} />

      {list.isLoading ? <Loading /> : !list.data?.length ? (
        <Empty title="El tablero está vacío" text="Publica el primer pedido: un cosplay en tu talla, una figura que no consigues o alguien que te cosa un traje." />
      ) : (
        <View style={{ gap: 12 }}>
          {list.data.map((w, i) => (
            <View key={w.id} style={{ borderRadius: 26, borderWidth: BORDER, borderColor: C.ink, padding: 18, backgroundColor: NOTE[i % NOTE.length] }}>
              <T w="bold" size={13}>{categoryOf(w.category)?.short}, {timeAgo(w.createdAt)}</T>
              <T w="black" size={19} style={{ marginTop: 4 }}>{w.title}</T>
              {w.description ? <T style={{ marginTop: 6 }}>{w.description}</T> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2, marginTop: 10 }}>
                <T w="bold" size={13.5}>{w.budgetCents != null ? `Presupuesto: ${formatPrice(w.budgetCents)}` : "Presupuesto abierto"}</T>
                {w.size ? <T w="bold" size={13.5}>Talla {w.size}</T> : null}
                {w.city ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><MapPin size={14} color={C.ink} /><T w="bold" size={13.5}>{w.city}</T></View> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 }}>
                <T size={13.5} style={{ flex: 1 }}>Lo pide {w.author}</T>
                {w.isMine ? <Btn small label="Ya lo conseguí" onPress={() => close.mutate({ id: w.id })} /> : <Btn small kind="ink" label="Yo lo tengo" onPress={() => respond(w)} />}
              </View>
            </View>
          ))}
        </View>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="¿Qué estás buscando?">
        <View style={{ gap: 16 }}>
          <Field label="Lo que busco"><Input value={f.title} onChangeText={(title) => setF({ ...f, title })} maxLength={120} placeholder="Cosplay de Frieren talla S" accessibilityLabel="Lo que busco" /></Field>
          <Field label="Categoría"><Select title="Categoría" value={f.category} onChange={(category) => setF({ ...f, category })} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} /></Field>
          <Field label="Detalles (opcional)"><Input multiline value={f.description} onChangeText={(description) => setF({ ...f, description })} maxLength={2000} placeholder="Para cuándo lo necesitas, si aceptas usado, medidas…" /></Field>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><Field label="Presupuesto en $"><Input keyboardType="decimal-pad" placeholder="Abierto" value={f.budget} onChangeText={(v) => setF({ ...f, budget: v.replace(/[^\d.]/g, "") })} accessibilityLabel="Presupuesto en dólares" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Talla"><Select title="Talla" value={f.size} onChange={(size) => setF({ ...f, size })} placeholder="No aplica" options={[{ value: "", label: "No aplica" }, ...SIZES.map((s) => ({ value: s, label: s }))]} /></Field></View>
          </View>
          <Field label="Ciudad (opcional)"><Input value={f.city} onChangeText={(city) => setF({ ...f, city })} maxLength={80} /></Field>
          <Btn label="Publicar pedido" kind="ink" busy={create.isPending} disabled={f.title.trim().length < 4}
            onPress={() => create.mutate({ title: f.title, description: f.description, category: f.category as never, budget: f.budget ? Number(f.budget) : undefined, size: f.size, city: f.city })} />
        </View>
      </Sheet>

      <Sheet open={Boolean(answer)} onClose={() => setAnswer(null)} title="Responder al pedido">
        <View style={{ gap: 16 }}>
          <T color={C.cocoa}>“{answer?.title}”</T>
          <Field label="Tu mensaje" hint="Llega al chat de quien hizo el pedido, a nombre de tu vitrina.">
            <Input multiline value={reply} onChangeText={setReply} maxLength={1800} placeholder="Tengo justo eso. Te cuento precio y te paso fotos…" accessibilityLabel="Tu mensaje" />
          </Field>
          <Btn label="Enviar mensaje" kind="ink" busy={send.isPending} disabled={!reply.trim()} onPress={() => answer && send.mutate({ wantedId: answer.id, body: reply.trim() })} />
        </View>
      </Sheet>
    </Screen>
  );
}
