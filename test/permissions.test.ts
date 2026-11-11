import { test } from "node:test";
import assert from "node:assert/strict";
import { authorize, can, permissions, type Permission, type StaffRecord } from "../app/lib/permissions.ts";

const all = Object.keys(permissions) as Permission[];
const staff = (role: StaffRecord["role"], active = true): StaffRecord => ({
  userId: "u1", name: "A", email: "a@b.c", role, active,
});

test("has 8 permissions", () => assert.equal(all.length, 8));

test("front_desk only orders, enquiries, stock", () => {
  const allowed = ["orders.manage", "enquiries.manage", "stock.adjust"];
  for (const p of all) assert.equal(can("front_desk", p), allowed.includes(p), p);
});

test("owner has all", () => {
  for (const p of all) assert.equal(can("owner", p), true, p);
});

test("inactive owner is forbidden", () => {
  assert.throws(() => authorize(staff("owner", false), "orders.manage"), { code: "forbidden" });
});

test("null is unauthenticated", () => {
  assert.throws(() => authorize(null, "orders.manage"), { code: "unauthenticated" });
});

test("front_desk forbidden for staff.manage, allowed for orders.manage", () => {
  assert.throws(() => authorize(staff("front_desk"), "staff.manage"), { code: "forbidden" });
  const s = staff("front_desk");
  assert.equal(authorize(s, "orders.manage"), s);
});
