import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { connect, startPostgres } from "./server.ts";
import { newKey, seedProduct } from "../fixtures.ts";
import { enquiries, orders, productVariants, programs, staff } from "../../db/schema.ts";
import { placeOrder, changeOrderStatus } from "../../app/lib/orders.ts";
import { submitEnquiry } from "../../app/lib/enquiries.ts";
import { setStaffRole, setStaffActive, type AuthAdmin } from "../../app/lib/staff.ts";
import type { StaffRecord } from "../../app/lib/permissions.ts";
import type { DomainError } from "../../app/lib/errors.ts";

let pg: Awaited<ReturnType<typeof startPostgres>>;
const clients: ReturnType<typeof connect>[] = [];
const conn = () => {
  const c = connect(pg.url);
  clients.push(c);
  return c;
};
before(async () => { pg = await startPostgres(); });
after(async () => {
  await Promise.all(clients.map((c) => c.$client.end()));
  await pg?.stop();
});

const order = (key: string, items: { variantId: string; quantity: number }[]) => ({
  idempotencyKey: key, customerName: "Ali", customerPhone: "03214220245",
  fulfilment: "pickup" as const, items,
});
const stockOf = async (db: ReturnType<typeof conn>, id: string) =>
  (await db.select({ s: productVariants.stock }).from(productVariants).where(eq(productVariants.id, id)))[0].s;

test("same checkout key from two connections creates one order", async () => {
  const [a, b, check] = [conn(), conn(), conn()];
  const { variantId } = await seedProduct(check, { name: "Whey", price: 100, stock: 100 });
  for (let i = 0; i < 10; i++) {
    const key = newKey();
    const r = await Promise.allSettled([placeOrder(a, order(key, [{ variantId, quantity: 1 }])), placeOrder(b, order(key, [{ variantId, quantity: 1 }]))]);
    assert.ok(r.every((x) => x.status === "fulfilled"), JSON.stringify(r));
    const [x, y] = r.map((q) => (q as PromiseFulfilledResult<{ number: string }>).value);
    assert.equal(x.number, y.number);
    const [{ n }] = await check.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.idempotencyKey, key));
    assert.equal(n, 1);
  }
});

test("two staff confirming the last unit: one wins, one insufficient_stock", async () => {
  const [a, b, check] = [conn(), conn(), conn()];
  for (let i = 0; i < 10; i++) {
    const { variantId } = await seedProduct(check, { name: "Last", price: 100, stock: 1 });
    // both orders placed while stock is 1 (placing doesn't reserve)
    const o1 = await placeOrder(check, order(newKey(), [{ variantId, quantity: 1 }]));
    const o2 = await placeOrder(check, order(newKey(), [{ variantId, quantity: 1 }]));
    const r = await Promise.allSettled([
      changeOrderStatus(a, { orderId: o1.id, to: "confirmed", staffUserId: randomUUID() }),
      changeOrderStatus(b, { orderId: o2.id, to: "confirmed", staffUserId: randomUUID() }),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1, JSON.stringify(r));
    const bad = r.find((x) => x.status === "rejected") as PromiseRejectedResult;
    assert.equal((bad.reason as DomainError).code, "insufficient_stock");
    assert.equal(await stockOf(check, variantId), 0);
  }
});

test("confirm and cancel on overlapping variants don't deadlock", async () => {
  const [a, b, check] = [conn(), conn(), conn()];
  for (let i = 0; i < 20; i++) {
    const v1 = (await seedProduct(check, { name: "V1", price: 10, stock: 10 })).variantId;
    const v2 = (await seedProduct(check, { name: "V2", price: 10, stock: 10 })).variantId;
    const A = await placeOrder(check, order(newKey(), [{ variantId: v1, quantity: 1 }, { variantId: v2, quantity: 1 }]));
    const B = await placeOrder(check, order(newKey(), [{ variantId: v2, quantity: 1 }, { variantId: v1, quantity: 1 }]));
    await changeOrderStatus(check, { orderId: B.id, to: "confirmed", staffUserId: randomUUID() });
    const t0 = Date.now();
    const r = await Promise.race([
      Promise.allSettled([
        changeOrderStatus(a, { orderId: A.id, to: "confirmed", staffUserId: randomUUID() }),
        changeOrderStatus(b, { orderId: B.id, to: "cancelled", staffUserId: randomUUID() }),
      ]),
      new Promise<"timeout">((res) => setTimeout(() => res("timeout"), 5000)),
    ]);
    assert.notEqual(r, "timeout", "settle within 5s");
    assert.ok(Date.now() - t0 < 5000);
    for (const x of r as PromiseSettledResult<void>[]) {
      assert.equal(x.status, "fulfilled", `iteration ${i}: ${JSON.stringify(x)}`);
    }
  }
});

test("two owners demoting each other leave one owner", async () => {
  const [a, b, check] = [conn(), conn(), conn()];
  const calls: unknown[][] = [];
  const admin: AuthAdmin = {
    async createUser() { return randomUUID(); },
    async deleteUser(id) { calls.push(["deleteUser", id]); },
    async setPassword(id) { calls.push(["setPassword", id]); },
    async setBanned(id, v) { calls.push(["setBanned", id, v]); },
    async listUserIds() { return []; },
  };
  for (let i = 0; i < 10; i++) {
    await check.delete(staff);
    const [u1, u2] = [randomUUID(), randomUUID()];
    await check.insert(staff).values([
      { userId: u1, name: "A", email: `a${i}@x.pk`, role: "owner" },
      { userId: u2, name: "B", email: `b${i}@x.pk`, role: "owner" },
    ]);
    const rec = (id: string, n: string): StaffRecord => ({ userId: id, name: n, email: `${n}@x.pk`, role: "owner", active: true });
    const mode = i % 2; // alternate demote and deactivate races
    const r = await Promise.allSettled(mode
      ? [setStaffRole(a, rec(u1, "a"), u2, "front_desk"), setStaffRole(b, rec(u2, "b"), u1, "front_desk")]
      : [setStaffActive(a, admin, rec(u1, "a"), u2, false), setStaffActive(b, admin, rec(u2, "b"), u1, false)]);
    const [{ n }] = await check.select({ n: sql<number>`count(*)::int` }).from(staff).where(sql`role = 'owner' and active`);
    assert.ok(n >= 1, `iteration ${i}: owners=${n} ${JSON.stringify(r)}`);
    assert.ok(r.some((x) => x.status === "fulfilled"));
  }
});

test("same enquiry key from two connections stores once", async () => {
  const [a, b, check] = [conn(), conn(), conn()];
  await check.insert(programs).values({ title: "Personal training", body: "x", visible: true, position: 0 });
  for (let i = 0; i < 10; i++) {
    const d = { idempotencyKey: newKey(), name: "Ali", phone: "03214220245", program: "Personal training", message: "hi" };
    const r = await Promise.allSettled([submitEnquiry(a, d as never), submitEnquiry(b, d as never)]);
    assert.ok(r.every((x) => x.status === "fulfilled"), JSON.stringify(r));
    const [{ n }] = await check.select({ n: sql<number>`count(*)::int` }).from(enquiries).where(eq(enquiries.idempotencyKey, d.idempotencyKey));
    assert.equal(n, 1);
  }
});
