import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { staff } from "../db/schema.ts";
import { DomainError } from "../app/lib/errors.ts";
import { authorize, type StaffRecord } from "../app/lib/permissions.ts";
import {
  createStaff, setStaffActive, setStaffRole, resetStaffPassword, reconcileStaff, type AuthAdmin,
} from "../app/lib/staff.ts";

function fakeAdmin(failing: Partial<Record<keyof AuthAdmin, boolean>> = {}, users: string[] = []) {
  const calls: [string, ...unknown[]][] = [];
  let n = 0;
  const step = (m: keyof AuthAdmin, ...a: unknown[]) => {
    calls.push([m, ...a]);
    if (failing[m]) throw new Error(`${m} failed`);
  };
  const admin: AuthAdmin = {
    async createUser(e, p) { step("createUser", e, p); return `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`; },
    async deleteUser(id) { step("deleteUser", id); },
    async setPassword(id, p) { step("setPassword", id, p); },
    async setBanned(id, b) { step("setBanned", id, b); },
    async listUserIds() { step("listUserIds"); return users; },
  };
  return { admin, calls, failing };
}

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const owner: StaffRecord = { userId: OWNER_ID, name: "Owner", email: "o@x.pk", role: "owner", active: true };

async function setup() {
  const t = await createTestDb();
  await t.db.insert(staff).values({ userId: OWNER_ID, name: "Owner", email: "o@x.pk", role: "owner" });
  return t;
}
const row = async (db: Awaited<ReturnType<typeof setup>>["db"], id: string) =>
  (await db.select().from(staff).where(eq(staff.userId, id)))[0];
const input = { name: "Desk", email: "  Desk@X.pk ", role: "front_desk" as const, password: "longenough1" };

test("owner creates front desk, email lowercased", async () => {
  const { db, close } = await setup();
  const { admin, calls } = fakeAdmin();
  const id = await createStaff(db, admin, owner, input);
  const r = await row(db, id);
  assert.equal(r.email, "desk@x.pk");
  assert.equal(r.role, "front_desk");
  assert.deepEqual(calls[0], ["createUser", "desk@x.pk", "longenough1"]);
  await close();
});

test("front desk cannot create staff; no Auth calls", async () => {
  const { db, close } = await setup();
  const { admin, calls } = fakeAdmin();
  const desk: StaffRecord = { ...owner, userId: "22222222-2222-4222-8222-222222222222", role: "front_desk" };
  await assert.rejects(createStaff(db, admin, desk, input), { code: "forbidden" });
  assert.equal(calls.length, 0);
  await close();
});

test("short password and bad email rejected before Auth", async () => {
  const { db, close } = await setup();
  const { admin, calls } = fakeAdmin();
  await assert.rejects(createStaff(db, admin, owner, { ...input, password: "short" }),
    (e: DomainError) => e.code === "invalid_input" && "password" in (e.fields ?? {}));
  await assert.rejects(createStaff(db, admin, owner, { ...input, email: "nope" }),
    (e: DomainError) => e.code === "invalid_input" && "email" in (e.fields ?? {}));
  await assert.rejects(resetStaffPassword(db, admin, owner, OWNER_ID, "short"), { code: "invalid_input" });
  assert.equal(calls.length, 0);
  await close();
});

test("staff insert failure deletes the Auth user", async () => {
  const { db, close } = await setup();
  const { admin, calls } = fakeAdmin();
  await assert.rejects(createStaff(db, admin, owner, { ...input, email: "O@x.pk" }));
  assert.deepEqual(calls.map((c) => c[0]), ["createUser", "deleteUser"]);
  assert.equal(calls[1][1], "00000000-0000-4000-8000-000000000001");
  await close();
});

test("compensation failure reports the orphan id", async () => {
  const { db, close } = await setup();
  const { admin } = fakeAdmin({ deleteUser: true });
  await assert.rejects(createStaff(db, admin, owner, { ...input, email: "o@x.pk" }),
    /00000000-0000-4000-8000-000000000001/);
  await close();
});

async function withDesk(db: Awaited<ReturnType<typeof setup>>["db"]) {
  const id = "33333333-3333-4333-8333-333333333333";
  await db.insert(staff).values({ userId: id, name: "D", email: "d@x.pk", role: "front_desk" });
  return id;
}

test("deactivate bans; ban failure returns authSynced false and staff is forbidden", async () => {
  const { db, close } = await setup();
  const id = await withDesk(db);
  const ok = fakeAdmin();
  assert.deepEqual(await setStaffActive(db, ok.admin, owner, id, false), { authSynced: true });
  assert.deepEqual(ok.calls[0], ["setBanned", id, true]);
  await setStaffActive(db, ok.admin, owner, id, true);
  const bad = fakeAdmin({ setBanned: true });
  assert.deepEqual(await setStaffActive(db, bad.admin, owner, id, false), { authSynced: false });
  const r = await row(db, id);
  assert.equal(r.active, false);
  assert.throws(() => authorize(r, "orders.manage"), { code: "forbidden" });
  await close();
});

test("reactivate unbans first; unban failure leaves staff inactive", async () => {
  const { db, close } = await setup();
  const id = await withDesk(db);
  await db.update(staff).set({ active: false }).where(eq(staff.userId, id));
  const bad = fakeAdmin({ setBanned: true });
  await assert.rejects(setStaffActive(db, bad.admin, owner, id, true));
  assert.equal((await row(db, id)).active, false);
  const ok = fakeAdmin();
  await setStaffActive(db, ok.admin, owner, id, true);
  assert.deepEqual(ok.calls[0], ["setBanned", id, false]);
  assert.equal((await row(db, id)).active, true);
  await close();
});

test("last active owner cannot be demoted or deactivated", async () => {
  const { db, close } = await setup();
  const { admin, calls } = fakeAdmin();
  const other = "44444444-4444-4444-8444-444444444444";
  await db.insert(staff).values({ userId: other, name: "O2", email: "o2@x.pk", role: "owner", active: false });
  // acting as the (active) other owner record is not possible; actor is a second actor object
  const actor: StaffRecord = { ...owner, userId: other };
  await assert.rejects(setStaffRole(db, actor, OWNER_ID, "front_desk"), { code: "forbidden" });
  await assert.rejects(setStaffActive(db, admin, actor, OWNER_ID, false), { code: "forbidden" });
  assert.equal(calls.length, 0);
  assert.equal((await row(db, OWNER_ID)).role, "owner");
  assert.equal((await row(db, OWNER_ID)).active, true);
  // with a second active owner the demotion is allowed
  await db.update(staff).set({ active: true }).where(eq(staff.userId, other));
  await setStaffRole(db, actor, OWNER_ID, "front_desk");
  assert.equal((await row(db, OWNER_ID)).role, "front_desk");
  await close();
});

test("cannot change own role or deactivate self, even as owner", async () => {
  const { db, admin } = { ...(await setup()), ...fakeAdmin() };
  await assert.rejects(setStaffRole(db, owner, OWNER_ID, "front_desk"), { code: "forbidden" });
  await assert.rejects(setStaffActive(db, admin, owner, OWNER_ID, false), { code: "forbidden" });
});

test("reset password calls Auth; unknown user is not_found", async () => {
  const { db, close } = await setup();
  const { admin, calls } = fakeAdmin();
  await resetStaffPassword(db, admin, owner, OWNER_ID, "longenough1");
  assert.deepEqual(calls[0], ["setPassword", OWNER_ID, "longenough1"]);
  await assert.rejects(resetStaffPassword(db, admin, owner, "99999999-9999-4999-8999-999999999999", "longenough1"),
    { code: "not_found" });
  await close();
});

test("reconcile finds orphans and rebans inactive staff", async () => {
  const { db, close } = await setup();
  const id = await withDesk(db);
  await db.update(staff).set({ active: false }).where(eq(staff.userId, id));
  const orphan = "55555555-5555-4555-8555-555555555555";
  const { admin, calls } = fakeAdmin({}, [OWNER_ID, id, orphan]);
  const res = await reconcileStaff(db, admin);
  assert.deepEqual(res, { orphanAuthUsers: [orphan], rebanned: [id] });
  assert.deepEqual(calls.filter((c) => c[0] === "setBanned"), [["setBanned", id, true]]);
  await close();
});
