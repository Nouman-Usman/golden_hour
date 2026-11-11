import { sql } from "drizzle-orm";
import {
  boolean, check, index, integer, pgEnum, pgSequence, pgTable, text, timestamp, unique, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

export const planPeriod = pgEnum("plan_period", ["one_time", "month", "quarter", "year"]);

// Membership plans shown in the pricing section; the admin portal edits these.
// RLS on with no policies: Supabase's public Data API can't touch it, only our server connection can.
export const plans = pgTable(
  "plans",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    price: integer().notNull(), // PKR, whole rupees
    period: planPeriod().notNull().default("month"),
    description: text(),
    features: text().array().notNull().default(sql`'{}'::text[]`),
    highlighted: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    visible: boolean().notNull().default(true),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [check("plans_price_non_negative", sql`${t.price} >= 0`)],
).enableRLS();

export type Plan = typeof plans.$inferSelect;

export const staffRole = pgEnum("staff_role", ["owner", "front_desk"]);
export const orderStatus = pgEnum("order_status", [
  "new", "confirmed", "ready_for_pickup", "out_for_delivery", "completed", "cancelled",
]);
export const fulfilment = pgEnum("fulfilment", ["pickup", "delivery"]);
export const enquiryStatus = pgEnum("enquiry_status", ["new", "contacted", "joined", "not_interested"]);
export const galleryKind = pgEnum("gallery_kind", ["floor", "members"]);

export type Role = (typeof staffRole.enumValues)[number];
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type EnquiryStatus = (typeof enquiryStatus.enumValues)[number];

const id = () => uuid().primaryKey().defaultRandom();
const ts = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updated = () => ts().$onUpdate(() => new Date());

// Supabase Auth user id; no FK across schemas.
export const staff = pgTable(
  "staff",
  {
    userId: uuid().primaryKey(),
    name: text().notNull(),
    email: text().notNull(), // stored lowercased
    role: staffRole().notNull(),
    active: boolean().notNull().default(true),
    // Sign-ins that started before this are refused (password reset, demotion, deactivation).
    sessionsValidAfter: timestamp({ withTimezone: true }),
    createdAt: ts(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("staff_email_lower_unique").on(sql`lower(${t.email})`)],
).enableRLS();

export const settings = pgTable(
  "settings",
  {
    id: integer().primaryKey(),
    whatsapp: text().notNull(),
    phone: text().notNull(),
    address: text().notNull(),
    instagramUrl: text().notNull(),
    mapsUrl: text().notNull(),
    mapsEmbedUrl: text().notNull(),
    googleRating: text().notNull(),
    googleReviewCount: integer().notNull(),
    instagramFollowers: text().notNull(),
    deliveryFee: integer().notNull(),
    shopOpen: boolean().notNull(),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_review_count_non_negative", sql`${t.googleReviewCount} >= 0`),
    check("settings_delivery_fee_non_negative", sql`${t.deliveryFee} >= 0`),
  ],
).enableRLS();

export type Settings = typeof settings.$inferSelect;

export const pageCopy = pgTable("page_copy", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: updated(),
}).enableRLS();

export const timings = pgTable("timings", {
  id: id(),
  label: text().notNull(),
  hours: text().notNull(),
  position: integer().notNull().default(0),
}).enableRLS();

export const programs = pgTable("programs", {
  id: id(),
  title: text().notNull(),
  body: text().notNull(),
  position: integer().notNull().default(0),
  visible: boolean().notNull().default(true),
}).enableRLS();

export const coach = pgTable(
  "coach",
  {
    id: integer().primaryKey(),
    name: text().notNull(),
    bio: text().notNull(),
    photoUrl: text().notNull(),
  },
  (t) => [check("coach_singleton", sql`${t.id} = 1`)],
).enableRLS();

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: id(),
    kind: galleryKind().notNull(),
    url: text().notNull(),
    alt: text().notNull(),
    caption: text(),
    position: integer().notNull().default(0),
  },
  (t) => [index("gallery_images_kind_position_idx").on(t.kind, t.position)],
).enableRLS();

export const reviews = pgTable("reviews", {
  id: id(),
  quote: text().notNull(),
  author: text().notNull(),
  featured: boolean().notNull().default(false),
  position: integer().notNull().default(0),
  visible: boolean().notNull().default(true),
}).enableRLS();

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    description: text().notNull().default(""),
    category: text().notNull(),
    images: text().array().notNull().default(sql`'{}'::text[]`),
    archived: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    createdAt: ts(),
    updatedAt: updated(),
  },
  (t) => [index("products_archived_position_idx").on(t.archived, t.position)],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid().notNull().references(() => products.id, { onDelete: "restrict" }),
    label: text().notNull().default(""),
    price: integer().notNull(),
    stock: integer().notNull(),
    archived: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    createdAt: ts(),
    updatedAt: updated(),
  },
  (t) => [
    check("product_variants_price_non_negative", sql`${t.price} >= 0`),
    check("product_variants_stock_non_negative", sql`${t.stock} >= 0`),
    unique("product_variants_product_label_unique").on(t.productId, t.label),
    index("product_variants_product_idx").on(t.productId),
  ],
).enableRLS();

export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1001 });

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: text().notNull().unique(),
    idempotencyKey: uuid().notNull().unique(),
    requestHash: text().notNull(),
    status: orderStatus().notNull().default("new"),
    fulfilment: fulfilment().notNull(),
    customerName: text().notNull(),
    customerPhone: text().notNull(),
    address: text(),
    subtotal: integer().notNull(),
    deliveryFee: integer().notNull(),
    total: integer().notNull(),
    notes: text().notNull().default(""),
    createdAt: ts(),
    updatedAt: updated(),
  },
  (t) => [
    check("orders_subtotal_non_negative", sql`${t.subtotal} >= 0`),
    check("orders_delivery_fee_non_negative", sql`${t.deliveryFee} >= 0`),
    check("orders_total_non_negative", sql`${t.total} >= 0`),
    index("orders_status_created_idx").on(t.status, t.createdAt.desc()),
  ],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid().notNull().references(() => orders.id, { onDelete: "restrict" }),
    productId: uuid().notNull().references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid().notNull().references(() => productVariants.id, { onDelete: "restrict" }),
    productName: text().notNull(),
    variantLabel: text().notNull(),
    unitPrice: integer().notNull(),
    quantity: integer().notNull(),
    lineTotal: integer().notNull(),
  },
  (t) => [
    check("order_items_unit_price_non_negative", sql`${t.unitPrice} >= 0`),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    check("order_items_line_total_non_negative", sql`${t.lineTotal} >= 0`),
    index("order_items_order_idx").on(t.orderId),
  ],
).enableRLS();

export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: uuid().notNull().references(() => orders.id, { onDelete: "restrict" }),
    fromStatus: orderStatus(),
    toStatus: orderStatus().notNull(),
    staffUserId: uuid().references(() => staff.userId, { onDelete: "restrict" }), // null = customer
    note: text(),
    createdAt: ts(),
  },
  (t) => [index("order_events_order_created_idx").on(t.orderId, t.createdAt)],
).enableRLS();

export const enquiries = pgTable(
  "enquiries",
  {
    id: id(),
    idempotencyKey: uuid().notNull().unique(),
    requestHash: text().notNull(),
    name: text().notNull(),
    phone: text().notNull(),
    program: text().notNull(),
    message: text().notNull(),
    status: enquiryStatus().notNull().default("new"),
    notes: text().notNull().default(""),
    createdAt: ts(),
  },
  (t) => [index("enquiries_status_created_idx").on(t.status, t.createdAt.desc())],
).enableRLS();

export const enquiryEvents = pgTable(
  "enquiry_events",
  {
    id: id(),
    enquiryId: uuid().notNull().references(() => enquiries.id, { onDelete: "restrict" }),
    fromStatus: enquiryStatus(),
    toStatus: enquiryStatus().notNull(),
    staffUserId: uuid().references(() => staff.userId, { onDelete: "restrict" }), // null = customer
    note: text(),
    createdAt: ts(),
  },
  (t) => [index("enquiry_events_enquiry_created_idx").on(t.enquiryId, t.createdAt)],
).enableRLS();

// Browser push subscriptions for staff devices (admin PWA). One row per browser endpoint.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: id(),
  staffUserId: uuid().notNull().references(() => staff.userId, { onDelete: "restrict" }),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  userAgent: text().notNull().default(""),
  createdAt: ts(),
  lastSuccessAt: timestamp({ withTimezone: true }),
}).enableRLS();
