// Datos de muestra para ver la tienda con contenido.
//   npm run seed           crea vitrinas, publicaciones y pedidos de muestra
//   npm run seed -- clear  borra todo lo de muestra
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { inArray, like } from "drizzle-orm";
import { db, pool, runMigrations } from "./db";
import { users, shops, listings, wanted, reviews, conversations, messages, follows, favorites, contributions } from "./schema";

const DOMAIN = "@muestra.cosland";

async function clear() {
  const demo = await db.select({ id: users.id }).from(users).where(like(users.email, `%${DOMAIN}`));
  const ids = demo.map((u) => u.id);
  if (!ids.length) return 0;
  const demoShops = (await db.select({ id: shops.id }).from(shops).where(inArray(shops.userId, ids))).map((s) => s.id);
  if (demoShops.length) {
    const ls = (await db.select({ id: listings.id }).from(listings).where(inArray(listings.shopId, demoShops))).map((l) => l.id);
    if (ls.length) await db.delete(favorites).where(inArray(favorites.listingId, ls));
    await db.delete(listings).where(inArray(listings.shopId, demoShops));
    await db.delete(reviews).where(inArray(reviews.shopId, demoShops));
    await db.delete(follows).where(inArray(follows.shopId, demoShops));
    await db.delete(contributions).where(inArray(contributions.shopId, demoShops));
    const convs = (await db.select({ id: conversations.id }).from(conversations).where(inArray(conversations.shopId, demoShops))).map((c) => c.id);
    if (convs.length) { await db.delete(messages).where(inArray(messages.conversationId, convs)); await db.delete(conversations).where(inArray(conversations.id, convs)); }
    await db.delete(shops).where(inArray(shops.id, demoShops));
  }
  await db.delete(wanted).where(inArray(wanted.userId, ids));
  await db.delete(reviews).where(inArray(reviews.authorId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  return ids.length;
}

type L = Partial<typeof listings.$inferInsert> & { category: string; title: string; description: string };
const SHOPS: { user: string; shop: Omit<typeof shops.$inferInsert, "userId">; items: L[] }[] = [
  {
    user: "Mariana",
    shop: { handle: "taller-de-sakura", name: "El Taller de Sakura", kind: "taller", accent: "sakura", city: "Maracaibo", country: "Venezuela", verified: true, whatsapp: "+584120000001", instagram: "tallerdesakura",
      bio: "Coso cosplay a medida desde 2018. Trabajo con patrones propios y te mando avances por foto en cada etapa." },
    items: [
      { category: "costura", deal: "encargo", title: "Confección de cosplay a medida", priceCents: 6000, description: "Traje completo según referencia. Incluye toma de medidas, una prueba y ajustes. Entrega entre 3 y 5 semanas según la complejidad.", featured: true },
      { category: "cosplay", title: "Cosplay de Nezuko Kamado completo", priceCents: 4500, condition: "como_nuevo", size: "M", measurements: "Busto 88, cintura 70, largo 110 cm", series: "Kimetsu no Yaiba", characterName: "Nezuko Kamado", acceptsTrade: true, description: "Kimono, haori, obi y bozal de bambú. Usado una sola vez en convención. Sin manchas ni arreglos." },
      { category: "cosplay", deal: "alquiler", title: "Vestido de Frieren para alquilar", priceCents: 1500, condition: "usado", size: "S", series: "Sousou no Frieren", characterName: "Frieren", description: "Vestido, capa y orejas. Se entrega lavado y planchado. Pido un depósito que devuelvo al recibirlo." },
    ],
  },
  {
    user: "Diego",
    shop: { handle: "kitsune-figuras", name: "Kitsune Figuras", kind: "tienda", accent: "ramune", city: "Caracas", country: "Venezuela", verified: true, hasStore: true, address: "C.C. Sambil, nivel Feria, local 14", hours: "Lunes a sábado, 10 am a 8 pm", whatsapp: "+584140000002",
      bio: "Figuras originales, manga en español y cartas. Todo sellado y con factura. Apartamos con el 30 %." },
    items: [
      { category: "figuras", title: "Figura Gojo Satoru 20 cm, original", priceCents: 5500, condition: "nuevo", series: "Jujutsu Kaisen", characterName: "Gojo Satoru", description: "Figura de PVC en su caja sellada. Base incluida.", featured: true },
      { category: "manga", title: "Chainsaw Man tomos 1 al 5 en español", priceCents: 4000, condition: "nuevo", series: "Chainsaw Man", description: "Los cinco primeros tomos, edición en español, sin abrir." },
      { category: "cartas", title: "Caja de sobres de cartas coleccionables", priceCents: 9000, condition: "nuevo", description: "Caja sellada con 24 sobres. Se puede retirar en tienda." },
      { category: "merch", title: "Sudadera con capucha de Akatsuki", priceCents: 2800, condition: "nuevo", size: "L", series: "Naruto", description: "Algodón grueso, estampado bordado. Tallas S a XL en tienda." },
    ],
  },
  {
    user: "Valentina",
    shop: { handle: "vale-cos", name: "Vale Cos", kind: "cosplayer", accent: "fuji", city: "Bogotá", country: "Colombia", instagram: "vale.cos",
      bio: "Cosplayer hace seis años. Vendo los trajes que ya no uso para hacerle espacio a los nuevos." },
    items: [
      { category: "cosplay", title: "Cosplay de Marin Kitagawa, uniforme escolar", priceCents: 3000, condition: "usado", size: "S", measurements: "Busto 84, cintura 64", series: "Sono Bisque Doll", characterName: "Marin Kitagawa", description: "Camisa, falda, corbata y accesorios. Tiene un pequeño arreglo en el cierre de la falda, se ve en las fotos." },
      { category: "pelucas", title: "Peluca rubia larga con puntas rosadas", priceCents: 1800, condition: "como_nuevo", series: "Sono Bisque Doll", characterName: "Marin Kitagawa", acceptsTrade: true, description: "Fibra resistente al calor, 80 cm. Peinada una vez. Incluye malla." },
      { category: "accesorios", title: "Botas blancas de plataforma talla 37", priceCents: 2200, condition: "usado", size: "Talla única", description: "Sirven para muchos personajes. Suela con poco uso." },
    ],
  },
  {
    user: "Andrés",
    shop: { handle: "forja-props", name: "Forja Props", kind: "taller", accent: "matcha", city: "Valencia", country: "Venezuela", whatsapp: "+584240000004",
      bio: "Armas y armaduras en goma EVA e impresión 3D. Livianas y permitidas en convenciones." },
    items: [
      { category: "props-encargo", deal: "encargo", title: "Espadas y armas en goma EVA por encargo", priceCents: 3500, description: "Dime el personaje y te cotizo. Acabado sellado y pintado. Entrega en 2 semanas." },
      { category: "props", title: "Guadaña de Zhongli, 1,8 m, desmontable", priceCents: 7000, condition: "hecho_a_mano", series: "Genshin Impact", characterName: "Zhongli", description: "Se desarma en tres piezas para transportarla. Núcleo de PVC, detalles en EVA." },
    ],
  },
  {
    user: "Camila",
    shop: { handle: "luna-lente", name: "Luna Lente", kind: "fotografo", accent: "yuzu", city: "Maracaibo", country: "Venezuela", instagram: "lunalente",
      bio: "Fotografía de cosplay en estudio y en convenciones. Edición incluida." },
    items: [
      { category: "fotografia", deal: "encargo", title: "Sesión de fotos de cosplay, 1 hora", priceCents: 2500, description: "Una hora en locación o estudio. Recibes 15 fotos editadas en alta resolución en 7 días." },
      { category: "maquillaje", deal: "encargo", title: "Maquillaje de caracterización para eventos", priceCents: 2000, description: "Maquillaje completo del personaje, incluye pestañas y fijador. Voy a domicilio dentro de la ciudad." },
    ],
  },
  {
    user: "Sofía",
    shop: { handle: "mochi-prints", name: "Mochi Prints", kind: "artista", accent: "momo", city: "Medellín", country: "Colombia", instagram: "mochiprints",
      bio: "Ilustradora. Prints, stickers y llaveros de mis series favoritas." },
    items: [
      { category: "arte", title: "Set de 12 stickers holográficos", priceCents: 600, condition: "nuevo", description: "Vinilo resistente al agua. Diseños propios." },
      { category: "arte", title: "Print A4 de Studio Ghibli, ilustración propia", priceCents: 900, condition: "nuevo", series: "Studio Ghibli", description: "Impreso en papel de 300 g. Se envía en tubo rígido." },
      { category: "peinado", deal: "encargo", title: "Peinado y estilizado de pelucas", priceCents: 1500, description: "Picos, trenzas y cortes según el personaje. Tú me envías la peluca o la consigo por ti." },
      { category: "videojuegos", title: "Control inalámbrico edición especial", priceCents: 4800, condition: "como_nuevo", acceptsTrade: true, description: "Con su caja y cable. Batería en buen estado." },
    ],
  },
];

async function seed() {
  await runMigrations();
  await clear();
  const hash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10); // nadie entra con estas cuentas
  const shopIds: number[] = [];
  const userIds: number[] = [];
  for (const [i, s] of SHOPS.entries()) {
    const [u] = await db.insert(users).values({ name: s.user, email: `vitrina${i + 1}${DOMAIN}`, passwordHash: hash });
    const [sh] = await db.insert(shops).values({ ...s.shop, userId: u.insertId });
    userIds.push(u.insertId); shopIds.push(sh.insertId);
    for (const it of s.items) {
      const service = ["costura", "props-encargo", "peinado", "maquillaje", "fotografia", "otros-servicios"].includes(it.category);
      await db.insert(listings).values({
        deal: "venta", delivery: "ambos", ...it, shopId: sh.insertId, kind: service ? "service" : "product",
        images: [`/demo/${it.category}.svg`], views: 10 + Math.floor(Math.random() * 180),
      });
    }
  }
  // Reseñas entre vitrinas de muestra (cada una con su conversación previa)
  const R: [number, number, number, string][] = [
    [2, 0, 5, "Me cosió el traje en tres semanas y quedó idéntico a la referencia."],
    [4, 0, 5, "Muy puntual y atenta con los ajustes."],
    [0, 1, 5, "La figura llegó sellada y bien empacada."],
    [5, 1, 4, "Buen surtido. El envío tardó un día más de lo acordado."],
    [2, 3, 5, "La guadaña aguantó toda la convención."],
    [0, 4, 5, "Las fotos quedaron hermosas."],
  ];
  for (const [author, shop, rating, comment] of R) {
    const [c] = await db.insert(conversations).values({ buyerId: userIds[author], shopId: shopIds[shop], lastBody: "Gracias" });
    await db.insert(messages).values({ conversationId: c.insertId, senderId: userIds[author], body: "Hola, me interesa. ¿Sigue disponible?" });
    await db.insert(reviews).values({ authorId: userIds[author], shopId: shopIds[shop], rating, comment });
  }
  await db.insert(wanted).values([
    { userId: userIds[2], title: "Cosplay de Yor Forger talla M", category: "cosplay", budgetCents: 5000, size: "M", city: "Bogotá", description: "Para una convención en dos meses. Acepto usado en buen estado." },
    { userId: userIds[4], title: "Quien me cosa un traje de Howl", category: "costura", budgetCents: 8000, city: "Maracaibo", description: "Chaqueta con rombos y pantalón. Tengo las referencias." },
    { userId: userIds[5], title: "Figura de Anya Forger", category: "figuras", city: "Medellín" },
  ]);
  console.log(`Listo: ${SHOPS.length} vitrinas de muestra creadas.`);
}

(async () => {
  if (process.argv.includes("clear")) { await runMigrations(); console.log(`Se borraron ${await clear()} cuentas de muestra y todo su contenido.`); }
  else await seed();
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
