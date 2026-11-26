import {
  mysqlTable, int, varchar, text, boolean, timestamp, mysqlEnum, uniqueIndex, index, customType, primaryKey,
} from "drizzle-orm/mysql-core";
import {
  ACCENT_IDS, CONDITION_IDS, DEAL_IDS, DELIVERY_IDS, ORDER_STATUS_IDS, PAY_STATUS_IDS, SHOP_KIND_IDS,
} from "../shared/catalog";

// Lista de URLs guardada como texto JSON (funciona igual en MySQL y MariaDB)
const stringList = customType<{ data: string[]; driverData: string }>({
  dataType: () => "text",
  toDriver: (v) => JSON.stringify(v ?? []),
  fromDriver: (v) => {
    try { const p = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(p) ? p : []; } catch { return []; }
  },
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 190 }).notNull(),
  passwordHash: varchar("password_hash", { length: 100 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

// Vitrina: el perfil público de venta de cada persona o tienda
export const shops = mysqlTable("shops", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  handle: varchar("handle", { length: 40 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  kind: mysqlEnum("kind", SHOP_KIND_IDS).notNull().default("cosplayer"),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  bannerUrl: varchar("banner_url", { length: 500 }),
  accent: mysqlEnum("accent", ACCENT_IDS).notNull().default("sakura"),
  city: varchar("city", { length: 80 }),
  country: varchar("country", { length: 60 }),
  whatsapp: varchar("whatsapp", { length: 30 }),
  instagram: varchar("instagram", { length: 60 }),
  tiktok: varchar("tiktok", { length: 60 }),
  hasStore: boolean("has_store").notNull().default(false),
  address: varchar("address", { length: 255 }),
  hours: varchar("hours", { length: 255 }),
  verified: boolean("verified").notNull().default(false),
  // Insignia "Apoya a Cosland" otorgada a mano desde administración (además de la que se gana con aportes confirmados)
  supportBadge: boolean("support_badge").notNull().default(false),
  // Acepta que le paguen al momento de la entrega
  payOnDelivery: boolean("pay_on_delivery").notNull().default(true),
  // Destacada (primera en búsquedas y en Vitrinas) hasta esta fecha: cada dólar confirmado a Cosland suma 15 días
  featuredUntil: timestamp("featured_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("shops_handle_idx").on(t.handle), uniqueIndex("shops_user_idx").on(t.userId)]);

export const listings = mysqlTable("listings", {
  id: int("id").autoincrement().primaryKey(),
  shopId: int("shop_id").notNull(),
  kind: mysqlEnum("kind", ["product", "service"]).notNull().default("product"),
  deal: mysqlEnum("deal", DEAL_IDS).notNull().default("venta"),
  category: varchar("category", { length: 40 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  description: text("description").notNull(),
  priceCents: int("price_cents"),
  acceptsTrade: boolean("accepts_trade").notNull().default(false),
  condition: mysqlEnum("item_condition", CONDITION_IDS),
  size: varchar("size", { length: 30 }),
  measurements: varchar("measurements", { length: 255 }),
  series: varchar("series", { length: 100 }),
  characterName: varchar("character_name", { length: 100 }),
  delivery: mysqlEnum("delivery", DELIVERY_IDS).notNull().default("ambos"),
  images: stringList("images").notNull(),
  // El vendedor sumó 1 dólar al precio para aportarlo a Cosland cuando venda
  supportsApp: boolean("supports_app").notNull().default(false),
  // Unidades disponibles (solo cuenta en artículos en venta; al llegar a 0 la publicación queda vendida)
  stock: int("stock").notNull().default(1),
  status: mysqlEnum("status", ["active", "paused", "sold", "removed"]).notNull().default("active"),
  featured: boolean("featured").notNull().default(false),
  views: int("views").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => [
  index("listings_shop_idx").on(t.shopId),
  index("listings_browse_idx").on(t.status, t.category, t.createdAt),
]);

export const favorites = mysqlTable("favorites", {
  userId: int("user_id").notNull(),
  listingId: int("listing_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.listingId] })]);

export const follows = mysqlTable("follows", {
  userId: int("user_id").notNull(),
  shopId: int("shop_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.shopId] }), index("follows_shop_idx").on(t.shopId)]);

// Un hilo por comprador y vitrina
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  buyerId: int("buyer_id").notNull(),
  shopId: int("shop_id").notNull(),
  lastBody: varchar("last_body", { length: 200 }),
  lastAt: timestamp("last_at").notNull().defaultNow(),
  buyerUnread: int("buyer_unread").notNull().default(0),
  sellerUnread: int("seller_unread").notNull().default(0),
}, (t) => [uniqueIndex("conv_pair_idx").on(t.buyerId, t.shopId), index("conv_shop_idx").on(t.shopId)]);

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversation_id").notNull(),
  senderId: int("sender_id").notNull(),
  body: text("body").notNull(),
  listingId: int("listing_id"),
  offerCents: int("offer_cents"),
  imageUrl: varchar("image_url", { length: 500 }),
  replyToId: int("reply_to_id"), // el mensaje al que responde, si lo citó
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("msg_conv_idx").on(t.conversationId, t.id)]);

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  shopId: int("shop_id").notNull(),
  authorId: int("author_id").notNull(),
  rating: int("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("reviews_pair_idx").on(t.shopId, t.authorId)]);

// "Se busca": pedidos de la comunidad para que los vendedores respondan
export const wanted = mysqlTable("wanted", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 40 }).notNull(),
  budgetCents: int("budget_cents"),
  size: varchar("size", { length: 30 }),
  city: varchar("city", { length: 80 }),
  contact: varchar("contact", { length: 120 }),
  status: mysqlEnum("status", ["open", "closed", "removed"]).notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("wanted_status_idx").on(t.status, t.createdAt)]);

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reporterId: int("reporter_id").notNull(),
  listingId: int("listing_id").notNull(),
  reason: varchar("reason", { length: 120 }).notNull(),
  detail: text("detail"),
  status: mysqlEnum("status", ["open", "resolved"]).notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Aportes voluntarios de los vendedores para mantener Cosland (1 dólar por venta)
export const contributions = mysqlTable("contributions", {
  id: int("id").autoincrement().primaryKey(),
  shopId: int("shop_id").notNull(),
  listingId: int("listing_id"),
  orderId: int("order_id"), // si el aporte salió de un pedido cerrado dentro de Cosland
  amountCents: int("amount_cents").notNull().default(100),
  // pending: vendió y aún no envía · reported: dice que ya envió · confirmed: el admin lo verificó
  status: mysqlEnum("status", ["pending", "reported", "confirmed", "dismissed"]).notNull().default("pending"),
  reference: varchar("reference", { length: 120 }),
  proofUrl: varchar("proof_url", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reportedAt: timestamp("reported_at"),
  confirmedAt: timestamp("confirmed_at"),
}, (t) => [index("contrib_shop_idx").on(t.shopId, t.status), index("contrib_status_idx").on(t.status, t.confirmedAt)]);

// Métodos de pago de cada vitrina (Pago Móvil, Zelle…). Los datos solo los ve quien le compra.
export const shopPayments = mysqlTable("shop_payments", {
  id: int("id").autoincrement().primaryKey(),
  shopId: int("shop_id").notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  details: varchar("details", { length: 600 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("shop_payments_shop_idx").on(t.shopId)]);

// Pedidos: el registro de cada venta acordada dentro de Cosland (el pago va por fuera, entre las dos personas)
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listing_id").notNull(),
  shopId: int("shop_id").notNull(),
  buyerId: int("buyer_id").notNull(),
  conversationId: int("conversation_id"),
  // Copia de cómo estaba la publicación al pedir, por si luego cambia
  title: varchar("title", { length: 120 }).notNull(),
  unitPriceCents: int("unit_price_cents"),
  quantity: int("quantity").notNull().default(1),
  note: varchar("note", { length: 500 }),
  status: mysqlEnum("status", ORDER_STATUS_IDS).notNull().default("pending"),
  // Pago: va directo al vendedor. Aquí solo queda cómo se pagó y si ya se confirmó.
  payMethodId: int("pay_method_id"),
  payLabel: varchar("pay_label", { length: 60 }),
  payStatus: mysqlEnum("pay_status", PAY_STATUS_IDS).notNull().default("on_delivery"),
  payReference: varchar("pay_reference", { length: 120 }),
  payProofUrl: varchar("pay_proof_url", { length: 500 }),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  deliveredAt: timestamp("delivered_at"),
}, (t) => [index("orders_shop_idx").on(t.shopId, t.status), index("orders_buyer_idx").on(t.buyerId, t.status), index("orders_listing_idx").on(t.listingId)]);

// Ajustes que el administrador cambia desde el panel (por ejemplo, la cuenta para los aportes)
// Dispositivos que aceptaron recibir avisos (notificaciones push del navegador o de la app instalada)
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  endpointHash: varchar("endpoint_hash", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 1000 }).notNull(),
  p256dh: varchar("p256dh", { length: 200 }).notNull(),
  auth: varchar("auth", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("push_endpoint_idx").on(t.endpointHash), index("push_user_idx").on(t.userId)]);

// Teléfonos con la app Android instalada que aceptaron avisos (token de Firebase Cloud Messaging)
export const deviceTokens = mysqlTable("device_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  token: varchar("token", { length: 500 }).notNull(),
  platform: varchar("platform", { length: 12 }).notNull().default("android"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("device_token_idx").on(t.tokenHash), index("device_user_idx").on(t.userId)]);

export const settings = mysqlTable("settings", {
  key: varchar("setting_key", { length: 60 }).primaryKey(),
  value: text("value").notNull(),
});
