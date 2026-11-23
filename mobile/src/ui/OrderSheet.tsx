import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import { formatPrice, hasStock } from "@shared/catalog";
import { errText, trpc } from "@/lib/api";
import { C } from "@/lib/theme";
import { Btn, Field, IconBtn, Input, Sheet, T, useToast } from "./core";

type Item = { id: number; title: string; priceCents: number | null; deal: string; kind: string; stock: number };

// "Lo quiero": deja el pedido registrado y abre el chat con el vendedor para acordar pago y entrega
export default function OrderSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item: Item }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const max = hasStock(item.kind, item.deal) ? Math.max(1, item.stock) : 1;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  useEffect(() => { if (open) { setQty(1); setNote(""); } }, [open]);
  const create = trpc.order.create.useMutation({
    onSuccess: (r) => {
      utils.order.invalidate(); utils.listing.byId.invalidate({ id: item.id }); utils.chat.invalidate();
      onClose();
      toast(r.existing ? "Ya tenías este pedido en curso" : "Pedido enviado. Acuerda aquí el pago y la entrega.");
      if (r.conversationId) router.push(`/mensajes/${r.conversationId}`); else router.push("/pedidos");
    },
    onError: (e) => toast(errText(e), true),
  });
  const service = item.kind === "service";
  return (
    <Sheet open={open} onClose={onClose} title={service ? "Pedir este servicio" : "Lo quiero"}>
      <View style={{ gap: 16 }}>
        <View>
          <T w="black" size={16}>{item.title}</T>
          <T color={C.cocoa} style={{ marginTop: 2 }}>{formatPrice(item.priceCents, item.deal)}{max > 1 ? ` cada uno. Quedan ${item.stock}.` : ""}</T>
        </View>
        {max > 1 && (
          <Field label="Cantidad">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <IconBtn label="Una menos" size={46} border bg={C.paper} onPress={() => setQty((v) => Math.max(1, v - 1))}><Minus size={18} color={C.ink} /></IconBtn>
              <T w="black" size={24} style={{ minWidth: 30, textAlign: "center" }} accessibilityLabel={`Cantidad: ${qty}`}>{qty}</T>
              <IconBtn label="Una más" size={46} border bg={C.paper} onPress={() => setQty((v) => Math.min(max, v + 1))}><Plus size={18} color={C.ink} /></IconBtn>
              {item.priceCents != null && qty > 1 ? <T color={C.cocoa}>Total {formatPrice(item.priceCents * qty, item.deal)}</T> : null}
            </View>
          </Field>
        )}
        <Field label="Mensaje para el vendedor" hint="Opcional. Por ejemplo, tu ciudad o cómo prefieres recibirlo.">
          <Input multiline value={note} onChangeText={setNote} maxLength={500} accessibilityLabel="Mensaje para el vendedor" />
        </Field>
        <T size={13.5} color={C.cocoa}>El pago y la entrega los acuerdas directo con el vendedor en el chat. Cosland no cobra ni guarda dinero.</T>
        <Btn label="Enviar pedido" kind="ink" busy={create.isPending} onPress={() => create.mutate({ listingId: item.id, quantity: qty, note: note.trim() || null })} />
      </View>
    </Sheet>
  );
}
