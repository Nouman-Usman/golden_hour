import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { newKey, seedProduct, seedStaff } from "./fixtures.ts";
import { orders, orderEvents, productVariants } from "../db/schema.ts";
import { placeOrder, changeOrderStatus } from "../app/lib/orders.ts";
import type { Db } from "../db/types.ts";
import type { StaffRecord } from "../app/lib/permissions.ts";
import type { DomainError } from "../app/lib/errors.ts";

const rejects = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: DomainError) => e.code === code);

async function place(db: Db, items: { variantId: string; quantity: number }[], fulfilment: "pickup" | "delivery" = "pickup") {
  const r = await placeOrder(db, {
    idempotencyKey: newKey(),
    customerName: "Ali",
    customerPhone: "03214220245",
    fulfilment,
    address: fulfilment === "delivery" ? "DHA Lahore" : undefined,
    items,
  });
  return r.id;
}
const stockOf = async (db: Db, id: string) =>
  (await db.select({ s: productVariants.stock }).from(productVariants).where(eq(productVariants.id, id)))[0].s;
const statusOf = async (db: Db, id: string) =>
  (await db.select({ s: orders.status }).from(orders).where(eq(orders.id, id)))[0].s;
const go = async (db: Db, orderId: string, to: Parameters<typeof changeOrderStatus>[2]["to"], actor?: StaffRecord) =>
  changeOrderStatus(db, actor ?? (await seedStaff(db, { role: "front_desk" })), { orderId, to });

test("confirm decrements stock and logs the staff user", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 5 });
  const id = await place(db, [{ variantId, quantity: 2 }]);
  const staff = await seedStaff(db, { role: "front_desk" });
  await changeOrderStatus(db, staff, { orderId: id, to: "confirmed", note: "ok" });
  assert.equal(await stockOf(db, variantId), 3);
  assert.equal(await statusOf(db, id), "confirmed");
  const ev = await db.select().from(orderEvents).where(eq(orderEvents.orderId, id));
  const last = ev.find((e) => e.toStatus === "confirmed")!;
  assert.equal(last.fromStatus, "new");
  assert.equal(last.staffUserId, staff.userId);
  assert.equal(last.note, "ok");
  await close();
});

test("last unit goes to the first confirm only", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 1, label: "1kg" });
  const a = await place(db, [{ variantId, quantity: 1 }]);
  const b = await place(db, [{ variantId, quantity: 1 }]);
  await go(db, a, "confirmed");
  await assert.rejects(go(db, b, "confirmed"), (e: DomainError) =>
    e.code === "insufficient_stock" && e.message === "Only 0 left of Whey (1kg).");
  assert.equal(await statusOf(db, b), "new");
  assert.equal(await stockOf(db, variantId), 0);
  assert.equal((await db.select().from(orderEvents).where(eq(orderEvents.orderId, b))).length, 1);
  await close();
});

test("multi-item confirm that fails midway changes nothing", async () => {
  const { db, close } = await createTestDb();
  const x = await seedProduct(db, { name: "X", price: 1, stock: 5 });
  const y = await seedProduct(db, { name: "Y", price: 1, stock: 1 });
  const id = await place(db, [{ variantId: x.variantId, quantity: 2 }, { variantId: y.variantId, quantity: 1 }]);
  await db.update(productVariants).set({ stock: 0 }).where(eq(productVariants.id, y.variantId));
  await rejects(go(db, id, "confirmed"), "insufficient_stock");
  assert.equal(await stockOf(db, x.variantId), 5);
  await close();
});

test("cancel after confirm restores stock; from new leaves it alone", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 5 });
  const a = await place(db, [{ variantId, quantity: 2 }]);
  await go(db, a, "confirmed");
  assert.equal(await stockOf(db, variantId), 3);
  await go(db, a, "cancelled");
  assert.equal(await stockOf(db, variantId), 5);
  const b = await place(db, [{ variantId, quantity: 2 }]);
  await go(db, b, "cancelled");
  assert.equal(await stockOf(db, variantId), 5);
  await close();
});

test("cancel from ready_for_pickup and out_for_delivery restores stock", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 5 });
  const p = await place(db, [{ variantId, quantity: 2 }]);
  await go(db, p, "confirmed");
  await go(db, p, "ready_for_pickup");
  await go(db, p, "cancelled");
  assert.equal(await stockOf(db, variantId), 5);
  const d = await place(db, [{ variantId, quantity: 3 }], "delivery");
  await go(db, d, "confirmed");
  await go(db, d, "out_for_delivery");
  assert.equal(await stockOf(db, variantId), 2);
  await go(db, d, "cancelled");
  assert.equal(await stockOf(db, variantId), 5);
  await close();
});

test("no going backwards or skipping", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 5 });
  const id = await place(db, [{ variantId, quantity: 1 }]);
  await rejects(go(db, id, "completed"), "invalid_transition");
  await rejects(go(db, id, "ready_for_pickup"), "invalid_transition");
  await rejects(go(db, id, "new"), "invalid_transition");
  await go(db, id, "confirmed");
  await rejects(go(db, id, "new"), "invalid_transition");
  await rejects(go(db, id, "confirmed"), "invalid_transition");
  await rejects(go(db, id, "completed"), "invalid_transition");
  assert.equal(await stockOf(db, variantId), 4);
  await assert.rejects(go(db, id, "new"), (e: DomainError) =>
    e.message === "An order can't move from confirmed to new.");
  await close();
});

test("fulfilment-specific steps", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 9 });
  const p = await place(db, [{ variantId, quantity: 1 }], "pickup");
  const d = await place(db, [{ variantId, quantity: 1 }], "delivery");
  await go(db, p, "confirmed");
  await go(db, d, "confirmed");
  await rejects(go(db, p, "out_for_delivery"), "invalid_transition");
  await rejects(go(db, d, "ready_for_pickup"), "invalid_transition");
  await go(db, p, "ready_for_pickup");
  await go(db, p, "completed");
  await go(db, d, "out_for_delivery");
  await go(db, d, "completed");
  await close();
});

test("completed and cancelled are final; stock untouched", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 5 });
  const a = await place(db, [{ variantId, quantity: 1 }]);
  await go(db, a, "confirmed");
  await go(db, a, "ready_for_pickup");
  await go(db, a, "completed");
  await rejects(go(db, a, "cancelled"), "invalid_transition");
  const b = await place(db, [{ variantId, quantity: 1 }]);
  await go(db, b, "cancelled");
  await rejects(go(db, b, "confirmed"), "invalid_transition");
  await rejects(go(db, b, "cancelled"), "invalid_transition");
  assert.equal(await stockOf(db, variantId), 4);
  await close();
});

test("unknown order is not_found", async () => {
  const { db, close } = await createTestDb();
  await assert.rejects(go(db, randomUUID(), "confirmed"), (e: DomainError) =>
    e.code === "not_found" && e.message === "Order not found.");
  await close();
});

test("direct stock = -1 violates the check", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 1 });
  await assert.rejects(db.execute(sql`update product_variants set stock = -1 where id = ${variantId}`));
  await close();
});

test("changeOrderStatus: non-UUID order id is not_found", async () => {
  const { db, close } = await createTestDb();
  await rejects(go(db, "x", "confirmed"), "not_found");
  await close();
});

test("changeOrderStatus: inactive staff is forbidden, nothing changes", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 5 });
  const id = await place(db, [{ variantId, quantity: 1 }]);
  await rejects(go(db, id, "confirmed", await seedStaff(db, { active: false })), "forbidden");
  assert.equal(await statusOf(db, id), "new");
  await close();
});

test("changeOrderStatus: front_desk may change status", async () => {
  const { db, close } = await createTestDb();
  const { variantId } = await seedProduct(db, { name: "Whey", price: 100, stock: 5 });
  const id = await place(db, [{ variantId, quantity: 1 }]);
  await go(db, id, "confirmed", await seedStaff(db, { role: "front_desk" }));
  assert.equal(await statusOf(db, id), "confirmed");
  await close();
});
