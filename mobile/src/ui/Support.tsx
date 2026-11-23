import { useState } from "react";
import { Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy } from "lucide-react-native";
import { formatPrice } from "@shared/catalog";
import { errText, trpc } from "@/lib/api";
import { BORDER, C } from "@/lib/theme";
import { Btn, Field, Input, Sheet, T, useToast } from "./core";
import { SinglePhoto } from "./photos";

export const useSupport = () => trpc.support.info.useQuery(undefined, { staleTime: 60_000 }).data;
export type Owed = { id: number; title?: string | null; amountCents?: number };

// Después de vender: a dónde enviar el dólar y cómo avisar que ya se envió
export function SupportSheet({ owed, onClose }: { owed: Owed | null; onClose: () => void }) {
  // El formulario nace limpio cada vez que se abre
  return <Sheet open={Boolean(owed)} onClose={onClose} title="Envía tu dólar a Cosland">{owed ? <SupportForm key={owed.id} owed={owed} onClose={onClose} /> : null}</Sheet>;
}

function SupportForm({ owed, onClose }: { owed: Owed; onClose: () => void }) {
  const s = useSupport();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const done = () => { utils.support.invalidate(); utils.order.invalidate(); onClose(); };
  const report = trpc.support.report.useMutation({ onSuccess: () => { toast("Gracias por apoyar a Cosland"); done(); }, onError: (e) => toast(errText(e), true) });
  const skip = trpc.support.skip.useMutation({ onSuccess: done });
  const copy = async () => { try { await Clipboard.setStringAsync(s?.account ?? ""); toast("Datos copiados"); } catch { toast("No se pudo copiar. Mantén presionado el texto para copiarlo.", true); } };
  const amount = owed.amountCents ? `${formatPrice(owed.amountCents)} de esta venta` : `${formatPrice(s?.amountCents ?? 100)} por venta`;
  return (
      <View style={{ gap: 14 }}>
        <T>{owed.title ? `Vendiste "${owed.title}". ` : ""}Con {amount} ayudas a que Cosland siga funcionando para toda la comunidad.</T>
        <View style={{ backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.ink, borderRadius: 22, padding: 16, gap: 10 }}>
          <T size={13.5} w="bold" color={C.cocoa}>Datos para enviarlo</T>
          <T w="bold" selectable>{s?.account || "El equipo de Cosland aún no ha publicado la cuenta."}</T>
          {s?.account ? <Btn small label="Copiar datos" icon={<Copy size={15} color={C.ink} />} style={{ alignSelf: "flex-start" }} onPress={copy} /> : null}
        </View>
        <Field label="Número de referencia (opcional)"><Input value={reference} onChangeText={setReference} maxLength={120} accessibilityLabel="Número de referencia del aporte" /></Field>
        <Field label="Comprobante (opcional)"><SinglePhoto value={proof} onChange={setProof} label="Subir comprobante" /></Field>
        <Btn label="Ya lo envié" kind="ink" busy={report.isPending} onPress={() => report.mutate({ id: owed.id, reference: reference.trim() || null, proofUrl: proof })} />
        <Btn label="Lo envío después" onPress={onClose} />
        <Pressable accessibilityRole="button" onPress={() => skip.mutate({ id: owed.id })} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 4 }}>
          <T size={13.5} color={C.cocoa} style={{ textDecorationLine: "underline" }}>Esta vez no voy a aportar</T>
        </Pressable>
      </View>
  );
}
