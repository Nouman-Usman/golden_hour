import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "./db.ts";
import { newKey, seedProduct, seedStaff } from "./fixtures.ts";
import { adminTitle, dashboardCounts } from "../app/lib/admin-queries.ts";
import { changeOrderStatus, placeOrder } from "../app/lib/orders.ts";
import { submitEnquiry } from "../app/lib/enquiries.ts";

const order = (variantId: string) => ({
  idempotencyKey: newKey(),
  customerName: "Ali",
  customerPhone: "03001234567",
  fulfilment: "pickup" as const,
  items: [{ variantId, quantity: 1 }],
});

test("dashboard counts only New orders and enquiries", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const { variantId } = await seedProduct(db, { name: "Whey", price: 6500, stock: 50 });
    const a = await placeOrder(db, order(variantId));
    await placeOrder(db, order(variantId));
    await changeOrderStatus(db, owner, { orderId: a.id, to: "confirmed" });
    await submitEnquiry(db, { idempotencyKey: newKey(), name: "Sara", phone: "03001234567", program: "Personal training", message: "" });

    const c = await dashboardCounts(db);
    assert.equal(c.newOrders, 1);
    assert.equal(c.newEnquiries, 1);
  } finally {
    await close();
  }
});

test("low stock: 0–3 included, 4 excluded, archived excluded, ascending, capped at 10", async () => {
  const { db, close } = await createTestDb();
  try {
    await seedProduct(db, { name: "Four", price: 1, stock: 4 });
    await seedProduct(db, { name: "Archived product", price: 1, stock: 0, archived: true });
    await seedProduct(db, { name: "Archived variant", price: 1, stock: 0, variantArchived: true });
    for (let i = 0; i < 12; i++) await seedProduct(db, { name: `P${i}`, price: 1, stock: i % 4 });

    const { lowStock } = await dashboardCounts(db);
    assert.equal(lowStock.length, 10);
    assert.ok(lowStock.every((r) => r.stock <= 3));
    assert.ok(!lowStock.some((r) => r.productName.startsWith("Archived") || r.productName === "Four"));
    const stocks = lowStock.map((r) => r.stock);
    assert.deepEqual(stocks, [...stocks].sort((x, y) => x - y));
    assert.ok(lowStock[0].productId && lowStock[0].variantId);
  } finally {
    await close();
  }
});

test("adminTitle shows the count only when something is new", () => {
  assert.equal(adminTitle({ newOrders: 0, newEnquiries: 0 }), "Golden Hour Admin");
  assert.equal(adminTitle({ newOrders: 2, newEnquiries: 3 }), "(5) Golden Hour Admin");
});
