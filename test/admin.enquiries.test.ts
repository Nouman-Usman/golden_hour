import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { newKey, seedStaff } from "./fixtures.ts";
import { enquiries } from "../db/schema.ts";
import { getEnquiryDetail, listEnquiries } from "../app/lib/admin-queries.ts";
import { changeEnquiryStatus, setEnquiryNotes, submitEnquiry } from "../app/lib/enquiries.ts";
import type { Db } from "../db/types.ts";

const enquire = (db: Db, name: string) =>
  submitEnquiry(db, { idempotencyKey: newKey(), name, phone: "03001234567", program: "Personal training", message: "Evenings" });

test("listEnquiries filters by status, newest first", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const a = await enquire(db, "First");
    const b = await enquire(db, "Second");
    await changeEnquiryStatus(db, owner, { enquiryId: a.id, to: "contacted" });

    assert.deepEqual((await listEnquiries(db, {})).map((e) => e.name), ["Second", "First"]);
    assert.deepEqual((await listEnquiries(db, { status: "new" })).map((e) => e.id), [b.id]);
  } finally {
    await close();
  }
});

test("getEnquiryDetail returns history with staff names, null for unknown ids", async () => {
  const { db, close } = await createTestDb();
  try {
    const owner = await seedStaff(db);
    const e = await enquire(db, "Sara");
    await changeEnquiryStatus(db, owner, { enquiryId: e.id, to: "contacted", note: "Left a message" });

    const d = await getEnquiryDetail(db, e.id);
    assert.ok(d);
    assert.equal(d.program, "Personal training");
    assert.deepEqual(
      d.events.map((x) => [x.toStatus, x.staffName, x.note]),
      [["new", "Customer", null], ["contacted", "Test Staff", "Left a message"]],
    );
    assert.equal(await getEnquiryDetail(db, randomUUID()), null);
    assert.equal(await getEnquiryDetail(db, "nope"), null);
  } finally {
    await close();
  }
});

test("setEnquiryNotes trims, clears, limits and checks the actor", async () => {
  const { db, close } = await createTestDb();
  try {
    const desk = await seedStaff(db, { role: "front_desk" });
    const gone = await seedStaff(db, { active: false });
    const e = await enquire(db, "Sara");
    const notes = async () => (await db.select({ n: enquiries.notes }).from(enquiries).where(eq(enquiries.id, e.id)))[0].n;

    await setEnquiryNotes(db, desk, { enquiryId: e.id, notes: "  Prefers mornings " });
    assert.equal(await notes(), "Prefers mornings");
    await setEnquiryNotes(db, desk, { enquiryId: e.id, notes: "" });
    assert.equal(await notes(), "");
    await assert.rejects(
      setEnquiryNotes(db, desk, { enquiryId: e.id, notes: "x".repeat(2001) }),
      (err: { code?: string; fields?: Record<string, string> }) => err.code === "invalid_input" && !!err.fields?.notes,
    );
    await assert.rejects(setEnquiryNotes(db, desk, { enquiryId: "nope", notes: "a" }), { code: "not_found" });
    await assert.rejects(setEnquiryNotes(db, gone, { enquiryId: e.id, notes: "a" }), { code: "forbidden" });
  } finally {
    await close();
  }
});
