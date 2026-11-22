import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { errText, trpc } from "@/lib/api";
import { Btn, Field, Input, Sheet, useToast } from "./core";

// Escribirle a una vitrina, con oferta opcional cuando es sobre una publicación
export default function ContactSheet({ open, onClose, shopId, shopName, listingId, listingTitle, withOffer }: {
  open: boolean; onClose: () => void; shopId: number; shopName: string; listingId?: number; listingTitle?: string; withOffer?: boolean;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const initial = listingTitle ? `Hola, me interesa "${listingTitle}". ¿Sigue disponible?` : "Hola, ";
  const [body, setBody] = useState(initial);
  const [offer, setOffer] = useState("");
  useEffect(() => { if (open) { setBody(initial); setOffer(""); } }, [open, initial]);
  const start = trpc.chat.start.useMutation({
    onSuccess: (r) => { utils.chat.list.invalidate(); utils.review.invalidate(); onClose(); toast("Mensaje enviado"); router.push(`/mensajes/${r.id}`); },
    onError: (e) => toast(errText(e), true),
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Escribirle a ${shopName}`}>
      <View style={{ gap: 16 }}>
        <Field label="Tu mensaje"><Input multiline value={body} onChangeText={setBody} maxLength={2000} accessibilityLabel="Tu mensaje" /></Field>
        {withOffer && (
          <Field label="Tu oferta en dólares (opcional)" hint="El vendedor decide si la acepta.">
            <Input keyboardType="decimal-pad" placeholder="Ej. 35" value={offer} onChangeText={(v) => setOffer(v.replace(/[^\d.]/g, ""))} accessibilityLabel="Tu oferta en dólares" />
          </Field>
        )}
        <Btn label="Enviar mensaje" kind="ink" busy={start.isPending} disabled={!body.trim()}
          onPress={() => start.mutate({ shopId, listingId, body: body.trim(), offer: withOffer && offer ? Number(offer) : undefined })} />
      </View>
    </Sheet>
  );
}
