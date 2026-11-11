import { test } from "node:test";
import assert from "node:assert/strict";
import { asc, eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { seedStaff } from "./fixtures.ts";
import { plans } from "../db/schema.ts";
import { deletePlan, movePlan, savePlan } from "../app/lib/plans-admin.ts";
import type { Db } from "../db/types.ts";

const ordered = async (db: Db) =>
  (await db.select({ id: plans.id, name: plans.name }).from(plans).orderBy(asc(plans.position), asc(plans.name))).map((p) => p.name);
const rejectsField = (field: string) => (e: { code?: string; fields?: Record<string, string> }) =>
  e.code === "invalid_input" && !!e.fields?.[field];
const base = {
  name: "Strength",
  price: 2500,
  period: "month",
  description: "",
  features: ["Weights"],
  highlighted: false,
  visible: true,
};

test("savePlan creates at the end and edits in place, trimming input", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const id = await savePlan(db, owner, { ...base, name: "  Student  ", features: ["  Off-peak  ", "", "   "] });
    const names = await ordered(db);
    assert.equal(names.at(-1), "Student");
    const [row] = await db.select().from(plans).where(eq(plans.id, id));
    assert.deepEqual(row.features, ["Off-peak"]);

    await savePlan(db, owner, { ...base, planId: id, name: "Student plus", price: "1800" });
    const [edited] = await db.select().from(plans).where(eq(plans.id, id));
    assert.equal(edited.name, "Student plus");
    assert.equal(edited.price, 1800);
  } finally {
    await close();
  }
});

test("savePlan validates every field", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    await assert.rejects(savePlan(db, owner, { ...base, name: "   " }), rejectsField("name"));
    await assert.rejects(savePlan(db, owner, { ...base, name: "x".repeat(41) }), rejectsField("name"));
    for (const price of [-1, 2.5, "", "abc"]) await assert.rejects(savePlan(db, owner, { ...base, price }), rejectsField("price"));
    await assert.rejects(savePlan(db, owner, { ...base, period: "weekly" }), rejectsField("period"));
    await assert.rejects(savePlan(db, owner, { ...base, description: "x".repeat(201) }), rejectsField("description"));
    await assert.rejects(savePlan(db, owner, { ...base, features: ["x".repeat(61)] }), rejectsField("features"));
    await assert.rejects(savePlan(db, owner, { ...base, features: Array(9).fill("ok") }), rejectsField("features"));
  } finally {
    await close();
  }
});

test("movePlan swaps neighbours and is a no-op at the ends", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const start = await ordered(db); // seeded: Registration, Strength, Strength + cardio, Personal training
    const rows = await db.select({ id: plans.id, name: plans.name }).from(plans);
    const id = (n: string) => rows.find((r) => r.name === n)!.id;

    await movePlan(db, owner, { planId: id(start[1]), direction: "up" });
    assert.deepEqual(await ordered(db), [start[1], start[0], ...start.slice(2)]);
    await movePlan(db, owner, { planId: id(start[1]), direction: "up" }); // already first
    assert.deepEqual(await ordered(db), [start[1], start[0], ...start.slice(2)]);
    await movePlan(db, owner, { planId: id(start[3]), direction: "down" }); // already last
    assert.equal((await ordered(db)).at(-1), start[3]);
  } finally {
    await close();
  }
});

test("deletePlan removes it; front desk is forbidden everywhere", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const desk = await seedStaff(db, { role: "front_desk" });
    const id = await savePlan(db, owner, base);
    await assert.rejects(savePlan(db, desk, base), { code: "forbidden" });
    await assert.rejects(movePlan(db, desk, { planId: id, direction: "up" }), { code: "forbidden" });
    await assert.rejects(deletePlan(db, desk, { planId: id }), { code: "forbidden" });
    await deletePlan(db, owner, { planId: id });
    assert.equal((await db.select().from(plans).where(eq(plans.id, id))).length, 0);
  } finally {
    await close();
  }
});
