import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMe } from "@/lib/hooks";
import { Field, Loading, useToast } from "@/components/ui";

function Doc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="wrap pt-6 md:pt-10 max-w-3xl">
      <h1 className="text-3xl md:text-5xl">{title}</h1>
      <p className="text-cocoa mt-2">Última actualización: {updated}</p>
      <div className="mt-7 grid gap-6 [&_h2]:text-xl [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:grid [&_ul]:gap-1 [&_a]:underline [&_a]:font-bold">{children}</div>
    </div>
  );
}

function Contact() {
  const email = trpc.auth.site.useQuery(undefined, { staleTime: Infinity }).data?.contactEmail;
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>el chat de soporte de Cosland</>;
}

export function Privacy() {
  return (
    <Doc title="Política de privacidad" updated="noviembre de 2026">
      <section>
        <h2>Qué datos guardamos</h2>
        <ul>
          <li>De tu cuenta: nombre, correo y contraseña (guardada cifrada, nunca en texto legible).</li>
          <li>De tu vitrina: nombre, descripción, ciudad, país, fotos y los contactos que decidas mostrar (WhatsApp, Instagram, TikTok, dirección de tu tienda).</li>
          <li>De tu actividad: publicaciones, fotos, mensajes del chat, favoritos, vitrinas que sigues, reseñas, pedidos y denuncias.</li>
          <li>Técnicos: una cookie de sesión para mantenerte dentro de tu cuenta.</li>
        </ul>
      </section>
      <section>
        <h2>Para qué los usamos</h2>
        <p>Para que la tienda funcione: mostrar tu vitrina y tus publicaciones, entregar tus mensajes, y cuidar a la comunidad frente a estafas o contenido inapropiado. No vendemos tus datos ni mostramos publicidad de terceros basada en ellos.</p>
      </section>
      <section>
        <h2>Qué ven los demás</h2>
        <p>Tu vitrina, tus publicaciones, tus reseñas y los contactos que pongas en tu vitrina son públicos. Tu correo y tus mensajes no lo son: los mensajes solo los ven tú y la otra persona de la conversación. El equipo de Cosland puede revisar contenido denunciado.</p>
      </section>
      <section>
        <h2>Con quién se comparten</h2>
        <p>Solo con los proveedores que alojan el servicio (servidor, base de datos y almacenamiento de imágenes), y con las autoridades cuando la ley lo exija.</p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <p>Puedes corregir tus datos desde tu vitrina y eliminar tu cuenta con todo su contenido cuando quieras desde <Link href="/eliminar-cuenta">Eliminar mi cuenta</Link>. Para cualquier otra solicitud escribe a <Contact />.</p>
      </section>
      <section>
        <h2>Menores de edad</h2>
        <p>Cosland es para mayores de 18 años, o menores con autorización de su representante.</p>
      </section>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc title="Términos de uso" updated="noviembre de 2026">
      <section>
        <h2>Qué es Cosland</h2>
        <p>Un lugar donde la comunidad cosplayer, otaku y geek publica artículos y servicios. Cosland conecta a las personas; no es parte de la venta, no cobra ni entrega los artículos y no responde por ellos. Cada acuerdo es entre comprador y vendedor.</p>
      </section>
      <section>
        <h2>Lo que te comprometes a hacer</h2>
        <ul>
          <li>Publicar solo lo que tienes o el servicio que de verdad ofreces, con fotos y descripción reales.</li>
          <li>Cumplir lo que acuerdes y tratar con respeto a los demás.</li>
          <li>Usar tus propias fotos o tener permiso para usarlas.</li>
        </ul>
      </section>
      <section>
        <h2>Lo que no está permitido</h2>
        <ul>
          <li>Estafas, artículos falsos presentados como originales o publicaciones engañosas.</li>
          <li>Armas reales, drogas, medicamentos, alcohol, tabaco y cualquier artículo ilegal.</li>
          <li>Contenido sexual explícito, violento, de odio o que sexualice a menores.</li>
          <li>Acoso, amenazas, spam o suplantar a otra persona.</li>
        </ul>
      </section>
      <section>
        <h2>Moderación</h2>
        <p>Cualquier publicación se puede denunciar desde su página. Cosland puede retirar contenido y suspender cuentas que incumplan estos términos.</p>
      </section>
      <section>
        <h2>Tu contenido</h2>
        <p>Lo que publicas sigue siendo tuyo. Nos das permiso para mostrarlo dentro de Cosland y en las vistas previas al compartir enlaces.</p>
      </section>
      <section>
        <h2>Contacto</h2>
        <p>Dudas o reclamos: <Contact />. Revisa también los <Link href="/compra-segura">consejos de compra segura</Link> y la <Link href="/privacidad">política de privacidad</Link>.</p>
      </section>
    </Doc>
  );
}

export function DeleteAccount() {
  const { me, loading } = useMe();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState(false);
  const del = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => { toast("Tu cuenta fue eliminada"); setTimeout(() => { location.href = "/"; }, 900); },
    onError: (e) => toast(e.message, true),
  });
  return (
    <Doc title="Eliminar mi cuenta" updated="noviembre de 2026">
      <section>
        <h2>Qué se borra</h2>
        <ul>
          <li>Tu cuenta: nombre, correo y contraseña.</li>
          <li>Tu vitrina, todas tus publicaciones y sus fotos.</li>
          <li>Tus conversaciones del chat, favoritos, reseñas, pedidos de “Se busca” y denuncias.</li>
        </ul>
        <p className="mt-3">El borrado es inmediato y no se puede deshacer. No conservamos copias de esos datos.</p>
      </section>
      <section>
        <h2>Cómo hacerlo</h2>
        {loading ? <Loading /> : !me ? (
          <>
            <p>Entra a tu cuenta de Cosland y vuelve a esta página. Si no puedes entrar, escribe a <Contact /> desde el correo de tu cuenta y la eliminamos por ti.</p>
            <Link href="/entrar?volver=/eliminar-cuenta" className="btn btn-ink mt-4 !no-underline">Entrar a mi cuenta</Link>
          </>
        ) : (
          <form className="panel p-5 grid gap-4 max-w-md" onSubmit={(e) => { e.preventDefault(); del.mutate({ password }); }}>
            <p>Vas a eliminar la cuenta de <strong>{me.email}</strong>.</p>
            <Field label="Confirma con tu contraseña"><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <label className="flex items-start gap-3 font-bold">
              <input type="checkbox" className="w-5 h-5 mt-0.5 accent-[#2a211c]" checked={sure} onChange={(e) => setSure(e.target.checked)} />
              Entiendo que se borra todo y no se puede recuperar
            </label>
            <button className="btn !bg-berry !text-paper !border-berry" disabled={!sure || !password || del.isPending}>{del.isPending ? "Eliminando…" : "Eliminar mi cuenta"}</button>
          </form>
        )}
      </section>
    </Doc>
  );
}
