import { View } from "react-native";
import { BORDER, C } from "@/lib/theme";
import { Awning, Screen, T, panel } from "@/ui/core";

const TIPS: [string, string, string][] = [
  ["Pide fotos o video de hoy", "Con tu nombre escrito en un papel junto al artículo. Así confirmas que la persona lo tiene.", C.sakura],
  ["Revisa la vitrina", "Mira sus reseñas, cuánto lleva publicando y si la vitrina está verificada.", C.matcha],
  ["Entrega en un lugar público", "Un centro comercial o un evento. Ve con alguien si puedes y revisa el artículo antes de pagar.", C.ramune],
  ["Si es con envío, deja todo por escrito", "Acuerda en el chat el precio, la empresa de envío y quién lo paga. Pide el número de guía.", C.fuji],
  ["Desconfía de la prisa", "Precios demasiado bajos, pagos por adelantado a terceros o presión para cerrar ya son señales de alerta.", C.yuzu],
  ["Denuncia lo sospechoso", "Cada publicación tiene un enlace para denunciarla. El equipo de Cosland la revisa.", C.momo],
];

export default function Safety() {
  return (
    <Screen title="Compra segura">
      <T size={16} color={C.cocoa}>En Cosland cada venta se acuerda directamente entre comprador y vendedor. Estos hábitos te cuidan a ti y a la comunidad.</T>
      <View style={{ gap: 12, marginTop: 18 }}>
        {TIPS.map(([t, d, bg]) => (
          <View key={t} style={{ borderRadius: 26, borderWidth: BORDER, borderColor: C.ink, padding: 18, backgroundColor: bg }}>
            <T w="black" size={18}>{t}</T><T style={{ marginTop: 6 }}>{d}</T>
          </View>
        ))}
      </View>
      <View style={[panel, { marginTop: 22 }]}>
        <Awning accent="matcha" size={28} />
        <View style={{ padding: 20 }}>
          <T w="black" size={20}>Para quienes venden</T>
          <T style={{ marginTop: 6 }}>Describe el artículo tal como está, con medidas y desgaste. Entrega solo cuando el pago esté confirmado en tu cuenta, no con una captura. Las buenas reseñas son lo que más ayuda a vender.</T>
        </View>
      </View>
    </Screen>
  );
}
