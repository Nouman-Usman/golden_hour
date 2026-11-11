import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { connect, startPostgres } from "./server.ts";
import { newKey, seedProduct } from "../fixtures.ts";
import { placeOrder } from "../../app/lib/orders.ts";

let pg: Awaited<ReturnType<typeof startPostgres>>;
before(async () => { pg = await startPostgres(); });
after(async () => { await pg?.stop(); });

test("rls: anon and authenticated see and change nothing", async () => {
  const owner = connect(pg.url);
  const { variantId } = await seedProduct(owner, { name: "Whey", price: 100, stock: 5 });
  await placeOrder(owner, {
    idempotencyKey: newKey(), customerName: "Ali", customerPhone: "03214220245",
    fulfilment: "pickup", items: [{ variantId, quantity: 1 }],
  });
  const [{ n: ownerCount }] = await owner.$client`select count(*)::int n from orders`;
  assert.equal(ownerCount, 1);

  for (const role of ["anon", "authenticated"]) {
    const c = postgres(pg.url, { max: 1 }); // one connection so SET ROLE sticks
    await c.unsafe(`SET ROLE ${role}`);
    const [{ n }] = await c`select count(*)::int n from orders`;
    assert.equal(n, 0, `${role} sees no orders`);
    await assert.rejects(
      c`insert into orders (number, idempotency_key, request_hash, customer_name, customer_phone, fulfilment, total)
        values ('X-1', ${newKey()}, 'h', 'x', 'x', 'pickup', 0)`,
      (e: { code?: string }) => e.code === "42501",
    );
    await c.unsafe(`RESET ROLE`);
    const [{ n: after }] = await c`select count(*)::int n from orders`;
    assert.equal(after, 1);
    await c.end();
  }
  await owner.$client.end();
});

test("rls: every public table has RLS enabled (not forced) and no policies", async () => {
  const c = postgres(pg.url, { max: 1 });
  try {
    const tables = await c`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`;
    assert.ok(tables.length > 0, "no public tables found");
    const bad = await c`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and (not relrowsecurity or relforcerowsecurity)`;
    assert.deepEqual(bad.map((r) => r.relname), []);
    const [{ n }] = await c`select count(*)::int as n from pg_policies where schemaname = 'public'`;
    assert.equal(n, 0);
  } finally {
    await c.end();
  }
});
