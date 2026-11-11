import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { seedStaff } from "./fixtures.ts";
import { pushSubscriptions } from "../db/schema.ts";
import { deletePushSubscription, notifyStaff, pushPayload, savePushSubscription, type PushSender } from "../app/lib/push.ts";
import type { Db } from "../db/types.ts";

const KEY = "BElp" + "a".repeat(80);
const sub = (n: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, p256dh: KEY, auth: "abcDEF123_-", userAgent: "test" });

function fakeSender(results: Record<string, "ok" | "gone" | "failed"> = {}) {
  const sent: { endpoint: string; payload: string }[] = [];
  const sender: PushSender = {
    async send(s, payload) {
      sent.push({ endpoint: s.endpoint, payload });
      return results[s.endpoint] ?? "ok";
    },
  };
  return { sender, sent };
}
const rows = (db: Db) => db.select().from(pushSubscriptions);
const order = { kind: "order" as const, id: "o1", number: "GH-1042", total: 5500, fulfilment: "pickup" as const };

test("save validates endpoint and keys", async () => {
  const { db, close } = await createTestDb();
  try {
    const me = await seedStaff(db, { role: "front_desk" });
    const bad = { code: "invalid_input" };
    await assert.rejects(savePushSubscription(db, me, { ...sub("a"), endpoint: "http://fcm.googleapis.com/a" }), bad);
    await assert.rejects(savePushSubscription(db, me, { ...sub("a"), endpoint: `https://fcm.googleapis.com/${"x".repeat(1000)}` }), bad);
    // SSRF: only real browser push services, no credentials, no custom ports
    for (const endpoint of [
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/push",
      "https://internal.supabase.co/x",
      "https://fcm.googleapis.com.evil.test/x",
      "https://evilfcm.googleapis.com.attacker.io/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
    ]) {
      await assert.rejects(savePushSubscription(db, me, { ...sub("a"), endpoint }), bad, endpoint);
    }
    for (const endpoint of [
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QAbc",
      "https://wns2-db5p.notify.windows.com/w/?token=abc",
      "https://FCM.googleapis.com./fcm/send/x",
    ]) {
      await savePushSubscription(db, me, { ...sub("a"), endpoint });
    }
    await assert.rejects(savePushSubscription(db, me, { ...sub("a"), p256dh: "" }), bad);
    await assert.rejects(savePushSubscription(db, me, { ...sub("a"), auth: "not base64!" }), bad);
    await savePushSubscription(db, me, sub("a"));
    assert.equal((await rows(db)).length, 5);
  } finally {
    await close();
  }
});

test("saving an existing endpoint re-assigns it to the current staff member", async () => {
  const { db, close } = await createTestDb();
  try {
    const a = await seedStaff(db);
    const b = await seedStaff(db, { role: "front_desk" });
    await savePushSubscription(db, a, sub("shared"));
    await savePushSubscription(db, b, sub("shared"));
    const r = await rows(db);
    assert.equal(r.length, 1);
    assert.equal(r[0].staffUserId, b.userId);
  } finally {
    await close();
  }
});

test("delete removes only your own subscription; inactive staff can't save", async () => {
  const { db, close } = await createTestDb();
  try {
    const a = await seedStaff(db);
    const b = await seedStaff(db);
    await savePushSubscription(db, a, sub("a"));
    await deletePushSubscription(db, b, { endpoint: sub("a").endpoint });
    assert.equal((await rows(db)).length, 1);
    await deletePushSubscription(db, a, { endpoint: sub("a").endpoint });
    assert.equal((await rows(db)).length, 0);
    const gone = await seedStaff(db, { active: false });
    await assert.rejects(savePushSubscription(db, gone, sub("g")), { code: "forbidden" });
  } finally {
    await close();
  }
});

test("orders and enquiries go to active owners and front desk, not inactive or signed-out devices", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const desk = await seedStaff(db, { role: "front_desk" });
    const inactive = await seedStaff(db);
    const revoked = await seedStaff(db);
    await savePushSubscription(db, owner, sub("owner"));
    await savePushSubscription(db, desk, sub("desk"));
    await savePushSubscription(db, inactive, sub("inactive"));
    await savePushSubscription(db, revoked, sub("revoked"));
    const { staff } = await import("../db/schema.ts");
    await db.update(staff).set({ active: false }).where(eq(staff.userId, inactive.userId));
    await db.update(staff).set({ sessionsValidAfter: new Date(Date.now() + 60_000) }).where(eq(staff.userId, revoked.userId));

    for (const event of [order, { kind: "enquiry" as const, id: "e1", program: "Personal training" }]) {
      const { sender, sent } = fakeSender();
      const r = await notifyStaff(db, sender, event);
      assert.deepEqual(new Set(sent.map((s) => s.endpoint)), new Set([sub("owner").endpoint, sub("desk").endpoint]));
      assert.deepEqual(r, { sent: 2, removed: 0, failed: 0 });
    }
  } finally {
    await close();
  }
});

test("gone subscriptions are deleted, failures counted, successes stamped, nothing throws", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    for (const n of ["ok", "gone", "failed"]) await savePushSubscription(db, owner, sub(n));
    const { sender } = fakeSender({ [sub("gone").endpoint]: "gone", [sub("failed").endpoint]: "failed" });
    const orig = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await notifyStaff(db, sender, order), { sent: 1, removed: 1, failed: 1 });
    } finally {
      console.error = orig;
    }
    const r = await rows(db);
    assert.deepEqual(r.map((x) => x.endpoint).sort(), [sub("failed").endpoint, sub("ok").endpoint]);
    assert.ok(r.find((x) => x.endpoint === sub("ok").endpoint)?.lastSuccessAt instanceof Date);
  } finally {
    await close();
  }
});

test("a sender that throws is counted as failed, not thrown", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    await savePushSubscription(db, owner, sub("x"));
    const sender: PushSender = { send: async () => { throw new Error("network"); } };
    const orig = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await notifyStaff(db, sender, order), { sent: 0, removed: 0, failed: 1 });
    } finally {
      console.error = orig;
    }
  } finally {
    await close();
  }
});

test("payloads carry no customer names or phone numbers", () => {
  const o = JSON.parse(pushPayload({ ...order }));
  assert.deepEqual(o, { title: "New order GH-1042", body: "Rs 5,500 · Pickup", url: "/admin/orders/o1", tag: "order-o1" });
  const e = JSON.parse(pushPayload({ kind: "enquiry", id: "e1", program: "Personal training" }));
  assert.deepEqual(e, { title: "New enquiry", body: "Personal training", url: "/admin/enquiries/e1", tag: "enquiry-e1" });
  const all = JSON.stringify([o, e]);
  assert.ok(!/03\d{9}|\+92|Ali|Sara/.test(all));
});
