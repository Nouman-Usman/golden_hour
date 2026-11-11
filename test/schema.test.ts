import { test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import * as s from "../db/schema.ts";
import { getSettings } from "../app/lib/settings.ts";

async function withDb(fn: (db: Awaited<ReturnType<typeof createTestDb>>["db"]) => Promise<void>) {
  const { db, close } = await createTestDb();
  try { await fn(db); } finally { await close(); }
}

const msg = (e: unknown) => String((e as Error).message) + String((e as { cause?: Error }).cause?.message ?? "");
const product = { slug: "p", name: "P", category: "c" };

async function mkProduct(db: Parameters<Parameters<typeof withDb>[0]>[0]) {
  const [p] = await db.insert(s.products).values(product).returning();
  return p;
}

test("rejects negative stock", () => withDb(async (db) => {
  const p = await mkProduct(db);
  await assert.rejects(
    db.insert(s.productVariants).values({ productId: p.id, price: 1, stock: -1 }),
    (e) => msg(e).includes("product_variants_stock_non_negative"),
  );
}));

test("rejects negative money", () => withDb(async (db) => {
  await assert.rejects(
    db.insert(s.orders).values({
      number: "1", idempotencyKey: crypto.randomUUID(), requestHash: "h", fulfilment: "pickup",
      customerName: "a", customerPhone: "1", subtotal: 0, deliveryFee: 0, total: -1,
    }),
    (e) => msg(e).includes("orders_total_non_negative"),
  );
}));

test("rejects duplicate variant label per product", () => withDb(async (db) => {
  const p = await mkProduct(db);
  await db.insert(s.productVariants).values({ productId: p.id, label: "L", price: 1, stock: 1 });
  await assert.rejects(db.insert(s.productVariants).values({ productId: p.id, label: "L", price: 1, stock: 1 }));
}));

test("emails are unique case-insensitively", () => withDb(async (db) => {
  await db.insert(s.staff).values({ userId: crypto.randomUUID(), name: "a", email: "A@x.com", role: "owner" });
  await assert.rejects(db.insert(s.staff).values({ userId: crypto.randomUUID(), name: "b", email: "a@x.com", role: "owner" }));
}));

test("products with orders cannot be deleted", () => withDb(async (db) => {
  const p = await mkProduct(db);
  const [v] = await db.insert(s.productVariants).values({ productId: p.id, price: 1, stock: 1 }).returning();
  const [o] = await db.insert(s.orders).values({
    number: "1", idempotencyKey: crypto.randomUUID(), requestHash: "h", fulfilment: "pickup",
    customerName: "a", customerPhone: "1", subtotal: 1, deliveryFee: 0, total: 1,
  }).returning();
  await db.insert(s.orderItems).values({
    orderId: o.id, productId: p.id, variantId: v.id, productName: "P", variantLabel: "", unitPrice: 1, quantity: 1, lineTotal: 1,
  });
  await assert.rejects(db.delete(s.products).where(eq(s.products.id, p.id)), (e) => /foreign key/i.test(msg(e)));
}));

test("seeds content", () => withDb(async (db) => {
  assert.equal((await db.select().from(s.timings)).length, 3);
  assert.equal((await db.select().from(s.programs)).length, 4);
  const g = await db.select().from(s.galleryImages);
  assert.equal(g.filter((r) => r.kind === "floor").length, 6);
  assert.equal(g.filter((r) => r.kind === "members").length, 12);
  const r = await db.select().from(s.reviews);
  assert.equal(r.length, 3);
  assert.equal(r.filter((x) => x.featured).length, 1);
  assert.equal((await getSettings(db)).deliveryFee, 250);
  assert.equal((await db.select().from(s.coach)).length, 1);
}));

test("order numbers start at 1001", () => withDb(async (db) => {
  const res = (await db.execute(sql`select nextval('order_number_seq') as n`)) as unknown as { rows: { n: string }[] };
  assert.equal(String(res.rows[0].n), "1001");
}));

test("missing settings is misconfigured", () => withDb(async (db) => {
  await db.delete(s.settings);
  await assert.rejects(getSettings(db), (e) => (e as { code?: string }).code === "misconfigured");
}));
