import { test } from "node:test";
import assert from "node:assert/strict";
import { staffGate } from "../app/admin/gate.ts";
import { toActionError } from "../app/admin/action-error.ts";
import { DomainError } from "../app/lib/errors.ts";
import type { StaffRecord } from "../app/lib/permissions.ts";

const staff = (role: StaffRecord["role"], active = true): StaffRecord => ({
  userId: "u1", name: "A", email: "a@b.c", role, active,
});

test("no session → signin", () => {
  assert.deepEqual(staffGate(null), { kind: "signin" });
  assert.deepEqual(staffGate(null, "orders.manage"), { kind: "signin" });
});

test("inactive owner → deactivated, with or without a permission", () => {
  assert.deepEqual(staffGate(staff("owner", false)), { kind: "deactivated" });
  assert.deepEqual(staffGate(staff("owner", false), "orders.manage"), { kind: "deactivated" });
});

test("front desk without the permission → forbidden", () => {
  assert.deepEqual(staffGate(staff("front_desk"), "products.edit"), { kind: "forbidden" });
});

test("front desk with the permission → ok", () => {
  const s = staff("front_desk");
  assert.deepEqual(staffGate(s, "orders.manage"), { kind: "ok", staff: s });
});

test("owner with any permission → ok", () => {
  const s = staff("owner");
  assert.deepEqual(staffGate(s, "staff.manage"), { kind: "ok", staff: s });
});

test("active staff with no permission required → ok", () => {
  const s = staff("front_desk");
  assert.deepEqual(staffGate(s), { kind: "ok", staff: s });
});

test("toActionError passes DomainError message and fields through", () => {
  const r = toActionError(new DomainError("invalid_input", "Check it.", { price: "Bad." }));
  assert.deepEqual(r, { ok: false, error: "Check it.", fields: { price: "Bad." } });
});

test("toActionError hides unexpected errors behind a generic message", () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const r = toActionError(new Error("relation does not exist"));
    assert.deepEqual(r, { ok: false, error: "Something went wrong. Try again." });
  } finally {
    console.error = orig;
  }
});
