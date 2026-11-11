import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "./db.ts";
import { seedStaff } from "./fixtures.ts";
import { getSettings } from "../app/lib/settings.ts";
import { updateShopSettings } from "../app/lib/settings-admin.ts";

test("owner saves delivery fee and closes the shop", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    await updateShopSettings(db, owner, { deliveryFee: "300", shopOpen: false });
    const s = await getSettings(db);
    assert.equal(s.deliveryFee, 300);
    assert.equal(s.shopOpen, false);
  } finally {
    await close();
  }
});

test("delivery fee must be whole rupees from 0 to 5000; nothing changes on error", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    for (const deliveryFee of [-1, 5001, 2.5, "", "abc"]) {
      await assert.rejects(
        updateShopSettings(db, owner, { deliveryFee, shopOpen: false }),
        (e: { code?: string; fields?: Record<string, string> }) => e.code === "invalid_input" && !!e.fields?.deliveryFee,
      );
    }
    const s = await getSettings(db);
    assert.equal(s.deliveryFee, 250);
    assert.equal(s.shopOpen, true);
  } finally {
    await close();
  }
});

test("front desk can't change shop settings", async () => {
  const { db, close } = await createTestDb();
  try {
    const desk = await seedStaff(db, { role: "front_desk" });
    await assert.rejects(updateShopSettings(db, desk, { deliveryFee: 0, shopOpen: true }), { code: "forbidden" });
  } finally {
    await close();
  }
});
