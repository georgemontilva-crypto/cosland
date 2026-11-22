// Catálogo compartido entre servidor y cliente: una sola fuente para categorías, estados y colores.

export const CATEGORIES = [
  { id: "cosplay", label: "Cosplays completos", short: "Cosplays", jp: "コスプレ", kind: "product" },
  { id: "pelucas", label: "Pelucas", short: "Pelucas", jp: "ウィッグ", kind: "product" },
  { id: "props", label: "Props y armas", short: "Props", jp: "プロップ", kind: "product" },
  { id: "accesorios", label: "Accesorios y calzado", short: "Accesorios", jp: "アクセ", kind: "product" },
  { id: "figuras", label: "Figuras y coleccionables", short: "Figuras", jp: "フィギュア", kind: "product" },
  { id: "manga", label: "Manga y cómics", short: "Manga", jp: "マンガ", kind: "product" },
  { id: "cartas", label: "Cartas y TCG", short: "Cartas", jp: "カード", kind: "product" },
  { id: "merch", label: "Ropa y merch", short: "Merch", jp: "グッズ", kind: "product" },
  { id: "arte", label: "Arte, prints y stickers", short: "Arte", jp: "アート", kind: "product" },
  { id: "videojuegos", label: "Videojuegos y consolas", short: "Videojuegos", jp: "ゲーム", kind: "product" },
  { id: "costura", label: "Costura y confección", short: "Costura", jp: "ソーイング", kind: "service" },
  { id: "props-encargo", label: "Props por encargo e impresión 3D", short: "Props por encargo", jp: "クラフト", kind: "service" },
  { id: "peinado", label: "Peinado de pelucas", short: "Peinado", jp: "セット", kind: "service" },
  { id: "maquillaje", label: "Maquillaje y caracterización", short: "Maquillaje", jp: "メイク", kind: "service" },
  { id: "fotografia", label: "Fotografía y video", short: "Fotografía", jp: "フォト", kind: "service" },
  { id: "otros-servicios", label: "Otros servicios", short: "Otros", jp: "ほか", kind: "service" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id);

export const CONDITIONS = [
  { id: "nuevo", label: "Nuevo" },
  { id: "como_nuevo", label: "Como nuevo" },
  { id: "usado", label: "Usado" },
  { id: "hecho_a_mano", label: "Hecho a mano" },
] as const;
export type ConditionId = (typeof CONDITIONS)[number]["id"];
export const CONDITION_IDS = CONDITIONS.map((c) => c.id) as [ConditionId, ...ConditionId[]];
export const conditionLabel = (id?: string | null) => CONDITIONS.find((c) => c.id === id)?.label ?? "";

// Qué se ofrece: venta directa, alquiler por evento o trabajo por encargo
export const DEALS = [
  { id: "venta", label: "En venta" },
  { id: "alquiler", label: "En alquiler" },
  { id: "encargo", label: "Por encargo" },
] as const;
export type DealId = (typeof DEALS)[number]["id"];
export const DEAL_IDS = DEALS.map((d) => d.id) as [DealId, ...DealId[]];
export const dealLabel = (id?: string | null) => DEALS.find((d) => d.id === id)?.label ?? "";

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "A medida", "Talla única"] as const;

export const DELIVERY = [
  { id: "personal", label: "Entrega en persona" },
  { id: "envio", label: "Envío nacional" },
  { id: "ambos", label: "Entrega en persona o envío" },
] as const;
export type DeliveryId = (typeof DELIVERY)[number]["id"];
export const DELIVERY_IDS = DELIVERY.map((d) => d.id) as [DeliveryId, ...DeliveryId[]];
export const deliveryLabel = (id?: string | null) => DELIVERY.find((d) => d.id === id)?.label ?? "";

export const SHOP_KINDS = [
  { id: "cosplayer", label: "Cosplayer", plural: "Cosplayers" },
  { id: "taller", label: "Taller de costura o props", plural: "Talleres" },
  { id: "tienda", label: "Tienda", plural: "Tiendas" },
  { id: "coleccionista", label: "Coleccionista", plural: "Coleccionistas" },
  { id: "artista", label: "Artista", plural: "Artistas" },
  { id: "fotografo", label: "Fotografía", plural: "Fotógrafos" },
] as const;
export type ShopKindId = (typeof SHOP_KINDS)[number]["id"];
export const SHOP_KIND_IDS = SHOP_KINDS.map((k) => k.id) as [ShopKindId, ...ShopKindId[]];
export const shopKindLabel = (id?: string | null) => SHOP_KINDS.find((k) => k.id === id)?.label ?? "";

// Colores del toldo de cada vitrina. Cada vendedor elige el suyo.
export const ACCENTS = [
  { id: "sakura", label: "Sakura", hex: "#F6C3CF", deep: "#E48AA0" },
  { id: "matcha", label: "Matcha", hex: "#CDE4BE", deep: "#86B56C" },
  { id: "ramune", label: "Ramune", hex: "#BCDFEE", deep: "#6FB2CF" },
  { id: "fuji", label: "Glicina", hex: "#D8CBF0", deep: "#A48BDB" },
  { id: "yuzu", label: "Yuzu", hex: "#F8E29C", deep: "#DDB84A" },
  { id: "momo", label: "Durazno", hex: "#FAD0B5", deep: "#EE9C6C" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];
export const ACCENT_IDS = ACCENTS.map((a) => a.id) as [AccentId, ...AccentId[]];
export const accentOf = (id?: string | null) => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];

export const COUNTRIES = ["Venezuela", "Colombia", "México", "Argentina", "Chile", "Perú", "Ecuador", "España", "Otro"] as const;

export const REPORT_REASONS = [
  "Es una estafa o es sospechoso",
  "El artículo no existe o ya se vendió",
  "Contenido inapropiado",
  "Producto prohibido",
  "Otro motivo",
] as const;

export function formatPrice(cents: number | null | undefined, deal?: string | null) {
  if (cents == null) return "A convenir";
  const n = cents / 100;
  const s = "$" + (Number.isInteger(n) ? n.toLocaleString("es") : n.toFixed(2));
  return deal === "alquiler" ? `${s} por evento` : deal === "encargo" ? `Desde ${s}` : s;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
