import { Link } from "wouter";
import { Awning } from "@/components/ui";

const TIPS: [string, string, string][] = [
  ["Pide fotos o video de hoy", "Con tu nombre escrito en un papel junto al artículo. Así confirmas que la persona lo tiene.", "#f6c3cf"],
  ["Revisa la vitrina", "Mira sus reseñas, cuánto lleva publicando y si la vitrina está verificada.", "#cde4be"],
  ["Entrega en un lugar público", "Un centro comercial o un evento. Ve con alguien si puedes y revisa el artículo antes de pagar.", "#bcdfee"],
  ["Si es con envío, deja todo por escrito", "Acuerda en el chat el precio, la empresa de envío y quién lo paga. Pide el número de guía.", "#d8cbf0"],
  ["Desconfía de la prisa", "Precios demasiado bajos, pagos por adelantado a terceros o presión para cerrar ya son señales de alerta.", "#f8e29c"],
  ["Denuncia lo sospechoso", "Cada publicación tiene un enlace para denunciarla. El equipo de Cosland la revisa.", "#fad0b5"],
];

export default function Safety() {
  return (
    <div className="wrap pt-6 md:pt-10 max-w-4xl">
      <h1 className="text-3xl md:text-5xl">Consejos de compra segura</h1>
      <p className="text-cocoa mt-3 text-lg max-w-2xl">En Cosland cada venta se acuerda directamente entre comprador y vendedor. Estos hábitos te cuidan a ti y a la comunidad.</p>
      <div className="grid gap-4 sm:grid-cols-2 mt-8">
        {TIPS.map(([t, d, bg]) => (
          <div key={t} className="rounded-[1.75rem] border-[1.5px] border-ink p-5" style={{ background: bg }}>
            <h2 className="text-xl">{t}</h2>
            <p className="mt-2">{d}</p>
          </div>
        ))}
      </div>
      <div className="panel overflow-hidden mt-10">
        <Awning accent="matcha" size={30} />
        <div className="p-6">
          <h2 className="text-2xl">Para quienes venden</h2>
          <p className="mt-2 max-w-prose">Describe el artículo tal como está, con medidas y desgaste. Entrega solo cuando el pago esté confirmado en tu cuenta, no con una captura. Las buenas reseñas son lo que más ayuda a vender.</p>
          <Link href="/mi-vitrina" className="btn btn-ink mt-5">Ir a mi vitrina</Link>
        </div>
      </div>
    </div>
  );
}
