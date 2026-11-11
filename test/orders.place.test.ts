import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { newKey, seedProduct, setShopOpen } from "./fixtures.ts";
import { orders, orderItems, orderEvents, productVariants } from "../db/schema.ts";
import { placeOrder, type PlaceOrderInput } from "../app/lib/orders.ts";
import { requestHash } from "../app/lib/idempotency.ts";
import type { DomainError } from "../app/lib/errors.ts";

const base = (items: PlaceOrderInput["items"], o: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  idempotencyKey: newKey(),
  customerName: "Ali",
  customerPhone: "03214220245",
  fulfilment: "pickup",
  items,
  ...o,
});
const rejects = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: DomainError) => e.code === code);

test("requestHash ignores key order and undefined", () => {
  assert.equal(requestHash({ a: 1, b: { c: 2, d: [1, 2] } }), requestHash({ b: { d: [1, 2], c: 2 }, a: 1, z: undefined }));
  assert.notEqual(requestHash([1, 2]), requestHash([2, 1]));
});

test("snapshots, GH number, pickup, one new event", async () => {
  const { db, close } = await createTestDb();
  const { variantId, productId } = await seedProduct(db, { name: "Strength", price: 2500, stock: 10, label: "1kg" });
  const r = await placeOrder(db, base([{ variantId, quantity: 2 }]));
  assert.equal(r.created, true);
  assert.match(r.number, /^GH-\d+$/);
  const [o] = await db.select().from(orders).where(eq(orders.id, r.id));
  assert.equal(o.subtotal, 5000);
  assert.equal(o.deliveryFee, 0);
  assert.equal(o.total, 5000);
  assert.equal(o.address, null);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, r.id));
  assert.deepEqual(
    items.map((i) => [i.productId, i.productName, i.variantLabel, i.unitPrice, i.quantity, i.lineTotal]),
    [[productId, "Strength", "1kg", 2500, 2, 5000]],
  );
  const ev = await db.select().from(orderEvents).where(eq(orderEvents.orderId, r.id));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].toStatus, "new");
  assert.equal(ev[0].fromStatus, null);
  assert.equal(ev[0].staffUserId, null);
  await close();
});

test("delivery needs address and adds fee", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Strength", price: 2500, stock: 10 });
  const items = [{ variantId, quantity: 1 }];
  await assert.rejects(placeOrder(db, base(items, { fulfilment: "delivery" })), (e: DomainError) =>
    e.code === "invalid_input" && !!e.fields?.address);
  const r = await placeOrder(db, base(items, { fulfilment: "delivery", address: " DHA Lahore " }));
  const [o] = await db.select().from(orders).where(eq(orders.id, r.id));
  assert.equal(o.deliveryFee, 250);
  assert.equal(o.total, 2750);
  assert.equal(o.address, "DHA Lahore");
  await close();
});

test("same key + same payload returns original; different cart conflicts", async () => {
  const { db, close } = await createTestDb();
  const a = await seedProduct(db, { name: "A", price: 100, stock: 10 });
  const b = await seedProduct(db, { name: "B", price: 100, stock: 10 });
  const input = base([{ variantId: a.variantId, quantity: 1 }]);
  const r1 = await placeOrder(db, input);
  const r2 = await placeOrder(db, { ...input, customerName: " Ali ", customerPhone: "0321 422-0245" });
  assert.equal(r2.created, false);
  assert.equal(r2.id, r1.id);
  assert.equal((await db.select().from(orders)).length, 1);
  await rejects(placeOrder(db, { ...input, items: [{ variantId: b.variantId, quantity: 1 }] }), "idempotency_conflict");
  await close();
});

test("concurrent duplicate submit yields one order", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "A", price: 100, stock: 10 });
  const input = base([{ variantId, quantity: 1 }]);
  const rs = await Promise.all([placeOrder(db, input), placeOrder(db, input)]);
  assert.equal(rs[0].id, rs[1].id);
  assert.equal(rs.filter((r) => r.created).length, 1);
  assert.equal((await db.select().from(orders)).length, 1);
  await close();
});

test("non-UUID key is invalid_input", async () => {
  const { db, close } = await createTestDb();
  await rejects(placeOrder(db, base([], { idempotencyKey: "nope" })), "invalid_input");
  await close();
});

test("uses DB price", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "A", price: 2500, stock: 10 });
  await db.update(productVariants).set({ price: 2800 }).where(eq(productVariants.id, variantId));
  const r = await placeOrder(db, base([{ variantId, quantity: 1 }]));
  const [o] = await db.select().from(orders).where(eq(orders.id, r.id));
  assert.equal(o.subtotal, 2800);
  await close();
});

test("archived product or variant is unavailable", async () => {
  const { db, close } = await createTestDb();
  const p = await seedProduct(db, { name: "Old", price: 100, stock: 5, archived: true });
  const v = await seedProduct(db, { name: "Live", price: 100, stock: 5, variantArchived: true });
  await assert.rejects(placeOrder(db, base([{ variantId: p.variantId, quantity: 1 }])), (e: DomainError) =>
    e.code === "unavailable" && e.message === "Old is no longer available.");
  await rejects(placeOrder(db, base([{ variantId: v.variantId, quantity: 1 }])), "unavailable");
  await rejects(placeOrder(db, base([{ variantId: newKey(), quantity: 1 }])), "unavailable");
  await close();
});

test("duplicate lines merge; bad quantities rejected", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "A", price: 100, stock: 10 });
  const r = await placeOrder(db, base([{ variantId, quantity: 1 }, { variantId, quantity: 2 }]));
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, r.id));
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 3);
  for (const q of [0, 1.5]) {
    await rejects(placeOrder(db, base([{ variantId, quantity: q }])), "invalid_input");
  }
  await rejects(placeOrder(db, base([])), "invalid_input");
  await close();
});

test("over stock names the product; shop closed", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 2, label: "2kg" });
  await assert.rejects(placeOrder(db, base([{ variantId, quantity: 3 }])), (e: DomainError) =>
    e.code === "insufficient_stock" && e.message === "Only 2 left of Whey (2kg).");
  await setShopOpen(db, false);
  await rejects(placeOrder(db, base([{ variantId, quantity: 1 }])), "shop_closed");
  await close();
});

test("phone formats", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "A", price: 100, stock: 10 });
  const items = [{ variantId, quantity: 1 }];
  for (const p of ["0321 422-0245", "+923214220245"]) {
    const r = await placeOrder(db, base(items, { customerPhone: p }));
    const [o] = await db.select().from(orders).where(eq(orders.id, r.id));
    assert.equal(o.customerPhone, p.replace(/[\s-]/g, ""));
  }
  await assert.rejects(placeOrder(db, base(items, { customerPhone: "123" })), (e: DomainError) =>
    e.code === "invalid_input" && !!e.fields?.customerPhone);
  await close();
});
