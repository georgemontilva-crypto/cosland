import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Plus, Trash2 } from "lucide-react-native";
import { PAY_TYPES } from "@shared/catalog";
import { errText, trpc } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C } from "@/lib/theme";
import { Btn, Check2, Empty, Field, IconBtn, Input, Loading, Screen, Select, T, soft, useToast } from "@/ui/core";

type Method = { id?: number; type: string; details: string };
const OPTIONS = PAY_TYPES.map((t) => ({ value: t.id as string, label: t.label }));

// Cómo te pagan: el vendedor lo configura una vez y el comprador lo ve al comprar
export default function Payments() {
  const { me, loading } = useSession();
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.shop.payments.useQuery(undefined, { enabled: Boolean(me?.shop) });
  const [methods, setMethods] = useState<Method[]>([]);
  const [onDelivery, setOnDelivery] = useState(true);
  const [filled, setFilled] = useState(false);
  useEffect(() => { if (q.data && !filled) { setMethods(q.data.methods); setOnDelivery(q.data.payOnDelivery); setFilled(true); } }, [q.data, filled]);
  const save = trpc.shop.savePayments.useMutation({
    onSuccess: () => { utils.shop.invalidate(); utils.listing.invalidate(); toast("Formas de pago guardadas"); router.back(); },
    onError: (e) => toast(errText(e), true),
  });
  if (loading || (me?.shop && q.isLoading)) return <Screen title="Cómo te pagan"><Loading /></Screen>;
  if (!me?.shop) return <Screen title="Cómo te pagan"><Empty title="Primero abre tu vitrina" action={<Btn label="Ir a mi cuenta" kind="ink" onPress={() => router.replace("/cuenta")} />} /></Screen>;
  const set = (i: number, patch: Partial<Method>) => setMethods((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const submit = () => {
    if (methods.some((m) => m.details.trim().length < 4)) return toast("Completa los datos de cada forma de pago o quítala.", true);
    save.mutate({ payOnDelivery: onDelivery, methods: methods.map((m) => ({ ...m, type: m.type as never, details: m.details.trim() })) });
  };

  return (
    <Screen title="Cómo te pagan">
      <T color={C.cocoa}>Agrega tus formas de pago una sola vez. Quien te compre las elige al comprar y ve tus datos solo después de hacer el pedido.</T>
      <View style={{ gap: 12, marginTop: 16 }}>
        {methods.map((m, i) => (
          <View key={m.id ?? `n${i}`} style={[soft, { padding: 14, gap: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Forma de pago"><Select title="Forma de pago" value={m.type} options={OPTIONS} onChange={(v) => set(i, { type: v })} /></Field></View>
              <IconBtn label="Quitar esta forma de pago" size={48} border bg={C.paper} onPress={() => setMethods((ms) => ms.filter((_, j) => j !== i))}><Trash2 size={18} color={C.ink} /></IconBtn>
            </View>
            <Field label="Tus datos para recibir el pago" hint={PAY_TYPES.find((t) => t.id === m.type)?.hint}>
              <Input multiline value={m.details} onChangeText={(v) => set(i, { details: v })} maxLength={600} accessibilityLabel="Tus datos para recibir el pago" />
            </Field>
          </View>
        ))}
        {methods.length < 8 && (
          <Btn label="Agregar forma de pago" icon={<Plus size={18} color={C.ink} />}
            onPress={() => setMethods((ms) => [...ms, { type: PAY_TYPES.find((t) => !ms.some((m) => m.type === t.id))?.id ?? "otro", details: "" }])} />
        )}
        <View style={[soft, { padding: 16, gap: 6 }]}>
          <Check2 value={onDelivery} onChange={setOnDelivery} label="Acepto pago al recibir" />
          <T size={13.5} color={C.cocoa} style={{ marginLeft: 36 }}>El comprador te paga cuando le entregas, en efectivo o como acuerden.</T>
        </View>
        {methods.length === 0 && !onDelivery ? <T w="bold" color={C.berry}>Sin ninguna forma de pago, tus publicaciones no tendrán el botón de comprar. Solo podrán escribirte.</T> : null}
        <Btn label="Guardar" kind="ink" busy={save.isPending} onPress={submit} />
      </View>
    </Screen>
  );
}
