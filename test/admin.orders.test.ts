import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { newKey, seedProduct, seedStaff } from "./fixtures.ts";
import { orders } from "../db/schema.ts";
import { getOrderDetail, listOrders } from "../app/lib/admin-queries.ts";
import { changeOrderStatus, placeOrder, setOrderNotes } from "../app/lib/orders.ts";
import type { Db } from "../db/types.ts";

async function newOrder(db: Db, variantId: string, name = "Ali") {
  return placeOrder(db, {
    idempotencyKey: newKey(),
    customerName: name,
    customerPhone: "03001234567",
    fulfilment: "pickup",
    items: [{ variantId, quantity: 2 }],
  });
}

test("listOrders filters by status, newest first", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const { variantId } = await seedProduct(db, { name: "Whey", price: 6500, stock: 50 });
    const a = await newOrder(db, variantId, "First");
    const b = await newOrder(db, variantId, "Second");
    await changeOrderStatus(db, owner, { orderId: a.id, to: "confirmed" });

    const all = await listOrders(db, {});
    assert.deepEqual(all.map((o) => o.customerName), ["Second", "First"]);
    const fresh = await listOrders(db, { status: "new" });
    assert.deepEqual(fresh.map((o) => o.id), [b.id]);
    assert.equal(fresh[0].total, 13000);
  } finally {
    await close();
  }
});

test("getOrderDetail returns items and history with staff names", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const { variantId } = await seedProduct(db, { name: "Whey", price: 6500, stock: 50, label: "Chocolate" });
    const o = await newOrder(db, variantId);
    await changeOrderStatus(db, owner, { orderId: o.id, to: "confirmed", note: "Called" });

    const d = await getOrderDetail(db, o.id);
    assert.ok(d);
    assert.equal(d.number, o.number);
    assert.deepEqual(
      d.items.map((i) => [i.productName, i.variantLabel, i.quantity, i.unitPrice, i.lineTotal]),
      [["Whey", "Chocolate", 2, 6500, 13000]],
    );
    assert.deepEqual(
      d.events.map((e) => [e.toStatus, e.staffName, e.note]),
      [["new", "Customer", null], ["confirmed", "Test Staff", "Called"]],
    );
  } finally {
    await close();
  }
});

test("getOrderDetail returns null for unknown and non-UUID ids", async () => {
  const { db, close } = await createTestDb();
  try {
    assert.equal(await getOrderDetail(db, randomUUID()), null);
    assert.equal(await getOrderDetail(db, "nope"), null);
  } finally {
    await close();
  }
});

test("setOrderNotes trims, clears and enforces 2000 characters", async () => {
  const { db, close } = await createTestDb();
  try {
    const desk = await seedStaff(db, { role: "front_desk" });
    const { variantId } = await seedProduct(db, { name: "Whey", price: 6500, stock: 50 });
    const o = await newOrder(db, variantId);
    const notes = async () => (await db.select({ n: orders.notes }).from(orders).where(eq(orders.id, o.id)))[0].n;

    await setOrderNotes(db, desk, { orderId: o.id, notes: "  Ring after 6pm  " });
    assert.equal(await notes(), "Ring after 6pm");
    await setOrderNotes(db, desk, { orderId: o.id, notes: "   " });
    assert.equal(await notes(), "");
    await assert.rejects(
      setOrderNotes(db, desk, { orderId: o.id, notes: "x".repeat(2001) }),
      (e: { code?: string; fields?: Record<string, string> }) => e.code === "invalid_input" && !!e.fields?.notes,
    );
    await assert.rejects(setOrderNotes(db, desk, { orderId: "nope", notes: "a" }), { code: "not_found" });
  } finally {
    await close();
  }
});

test("setOrderNotes refuses inactive staff", async () => {
  const { db, close } = await createTestDb();
  try {
    const gone = await seedStaff(db, { active: false });
    const { variantId } = await seedProduct(db, { name: "Whey", price: 6500, stock: 50 });
    const o = await newOrder(db, variantId);
    await assert.rejects(setOrderNotes(db, gone, { orderId: o.id, notes: "a" }), { code: "forbidden" });
  } finally {
    await close();
  }
});

test("whatsappDigits rewrites local numbers to 92…", async () => {
  const { whatsappDigits, formatWhen } = await import("../app/admin/format.ts");
  assert.equal(whatsappDigits("03001234567"), "923001234567");
  assert.equal(whatsappDigits("+923001234567"), "923001234567");
  assert.equal(whatsappDigits("923001234567"), "923001234567");
  assert.equal(formatWhen(new Date("2026-11-12T10:14:00Z")), "12 Nov, 3:14 pm"); // Asia/Karachi
});
