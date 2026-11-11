import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { newKey } from "./fixtures.ts";
import { enquiries, enquiryEvents, programs } from "../db/schema.ts";
import { parseEnquiry, enquiryFailure, ENQUIRY_GENERIC_ERROR } from "../app/lib/enquiry.ts";
import {
  submitEnquiry,
  changeEnquiryStatus,
  getVisibleProgramTitles,
  nextEnquiryStatuses,
  enquiryWhatsAppUrl,
} from "../app/lib/enquiries.ts";
import type { Db } from "../db/types.ts";
import { DomainError } from "../app/lib/errors.ts";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const rejects = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: DomainError) => e.code === code);
const seedProgram = (db: Db, title: string, o: { visible?: boolean; position?: number } = {}) =>
  db.insert(programs).values({ title, body: "x", visible: o.visible ?? true, position: o.position ?? 0 });
const data = (o: Partial<Parameters<typeof submitEnquiry>[1]> = {}) => ({
  idempotencyKey: newKey(),
  name: "Ali",
  phone: "03214220245",
  program: "Personal training",
  message: "",
  ...o,
});

test("parseEnquiry: valid input is normalized, key optional", () => {
  const ok = parseEnquiry(form({ name: " Ali ", phone: "0321 422-0245", program: "Open floor", message: "" }));
  assert.deepEqual(ok.data, { idempotencyKey: "", name: "Ali", phone: "03214220245", program: "Open floor", message: "" });
  assert.ok(parseEnquiry(form({ name: "A", phone: "+923214220245", program: "Personal training" })).data);
});

test("parseEnquiry: shape errors", () => {
  assert.equal(parseEnquiry(form({ name: "", phone: "123", program: "Yoga" })).errors?.name, "Enter your name.");
  const bad = parseEnquiry(form({ name: "A", phone: "123", program: "" })).errors!;
  assert.equal(bad.phone, "Enter a Pakistani mobile number, like 0321 4220245.");
  assert.equal(bad.program, "Pick what you want to join.");
  assert.equal(
    parseEnquiry(form({ name: "A", phone: "03214220245", program: "X", message: "x".repeat(501) })).errors?.message,
    "Keep your message under 500 characters.",
  );
  assert.equal(
    parseEnquiry(form({ name: "x".repeat(81), phone: "03214220245", program: "X" })).errors?.name,
    "Keep your name under 80 characters.",
  );
});

test("getVisibleProgramTitles: visible only, by position", async () => {
  const { db, close } = await createTestDb();
  await db.delete(programs); // drop migration seed rows
  await seedProgram(db, "B", { position: 2 });
  await seedProgram(db, "A", { position: 1 });
  await seedProgram(db, "Hidden", { visible: false, position: 0 });
  assert.deepEqual(await getVisibleProgramTitles(db), ["A", "B"]);
  await close();
});

test("submitEnquiry stores once, writes a new event; same key is idempotent", async () => {
  const { db, close } = await createTestDb();
  await seedProgram(db, "Personal training");
  const d = data();
  const a = await submitEnquiry(db, d);
  const b = await submitEnquiry(db, d);
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(a.id, b.id);
  assert.equal((await db.select().from(enquiries)).length, 1);
  const ev = await db.select().from(enquiryEvents).where(eq(enquiryEvents.enquiryId, a.id));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].toStatus, "new");
  assert.equal(ev[0].fromStatus, null);
  await close();
});

test("same key with a different message is a conflict", async () => {
  const { db, close } = await createTestDb();
  await seedProgram(db, "Personal training");
  const d = data();
  await submitEnquiry(db, d);
  await rejects(submitEnquiry(db, { ...d, message: "other" }), "idempotency_conflict");
  await close();
});

test("invalid key, hidden or unknown program", async () => {
  const { db, close } = await createTestDb();
  await seedProgram(db, "Hidden", { visible: false });
  await assert.rejects(submitEnquiry(db, data({ idempotencyKey: "nope" })), (e: DomainError) =>
    e.code === "invalid_input" && e.fields?.idempotencyKey === "Invalid request key.");
  await assert.rejects(submitEnquiry(db, data({ program: "Hidden" })), (e: DomainError) =>
    e.code === "invalid_input" && e.fields?.program === "Pick what you want to join.");
  await rejects(submitEnquiry(db, data({ program: "Nope" })), "invalid_input");
  assert.equal((await db.select().from(enquiries)).length, 0);
  await close();
});

test("status moves forward only, with events", async () => {
  const { db, close } = await createTestDb();
  await seedProgram(db, "Personal training");
  const { id } = await submitEnquiry(db, data());
  const staff = randomUUID();
  assert.deepEqual(nextEnquiryStatuses.new, ["contacted", "joined", "not_interested"]);
  await changeEnquiryStatus(db, { enquiryId: id, to: "contacted", staffUserId: staff, note: "called" });
  await rejects(changeEnquiryStatus(db, { enquiryId: id, to: "new", staffUserId: staff }), "invalid_transition");
  await changeEnquiryStatus(db, { enquiryId: id, to: "joined", staffUserId: staff });
  await assert.rejects(changeEnquiryStatus(db, { enquiryId: id, to: "not_interested", staffUserId: staff }),
    (e: DomainError) => e.message === "An enquiry can't move from joined to not_interested.");
  const [row] = await db.select().from(enquiries).where(eq(enquiries.id, id));
  assert.equal(row.status, "joined");
  const ev = await db.select().from(enquiryEvents).where(eq(enquiryEvents.enquiryId, id));
  assert.equal(ev.length, 3);
  assert.ok(ev.some((e) => e.fromStatus === "new" && e.toStatus === "contacted" && e.staffUserId === staff && e.note === "called"));
  await close();
});

test("changeEnquiryStatus: unknown or non-UUID id is not_found", async () => {
  const { db, close } = await createTestDb();
  await rejects(changeEnquiryStatus(db, { enquiryId: randomUUID(), to: "joined", staffUserId: randomUUID() }), "not_found");
  await rejects(changeEnquiryStatus(db, { enquiryId: "x", to: "joined", staffUserId: randomUUID() }), "not_found");
  await close();
});

test("enquiryWhatsAppUrl", () => {
  const u = enquiryWhatsAppUrl("+92 321 4220245", { name: "Ali", phone: "03214220245", program: "Personal training", message: "" });
  assert.ok(u.startsWith("https://wa.me/923214220245?text="));
  assert.ok(u.includes("Interested%20in%3A%20Personal%20training"));
  assert.ok(!u.includes("Message"));
  assert.ok(enquiryWhatsAppUrl("1", { name: "A", phone: "p", program: "q", message: "hi" }).includes("%0AMessage%3A%20hi"));
});

test("enquiryFailure: only field errors and conflicts reach the visitor", () => {
  const D = (c: ConstructorParameters<typeof DomainError>[0], m: string, f?: Record<string, string>) => new DomainError(c, m, f);
  assert.deepEqual(enquiryFailure(D("invalid_input", "x", { program: "p" })), { errors: { program: "p" }, log: false });
  assert.deepEqual(enquiryFailure(D("idempotency_conflict", "dup")), { formError: "dup", log: false });
  assert.deepEqual(enquiryFailure(D("misconfigured", "Shop settings row is missing")), { formError: ENQUIRY_GENERIC_ERROR, log: true });
  assert.deepEqual(enquiryFailure(new Error('relation "enquiries" does not exist')), { formError: ENQUIRY_GENERIC_ERROR, log: true });
});
