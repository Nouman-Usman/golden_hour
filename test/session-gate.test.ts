import { test } from "node:test";
import assert from "node:assert/strict";
import { authTimeFromClaims, sessionAllowed } from "../app/lib/session-gate.ts";

const at = (iso: string) => new Date(iso);

test("no revocation stamp → allowed", () => {
  assert.equal(sessionAllowed(1_700_000_000, null), true);
  assert.equal(sessionAllowed(null, null), true);
});

test("signed in before the stamp → refused; at or after → allowed", () => {
  const stamp = at("2026-11-12T10:00:00Z");
  assert.equal(sessionAllowed(stamp.getTime() / 1000 - 1, stamp), false);
  assert.equal(sessionAllowed(stamp.getTime() / 1000, stamp), true);
  assert.equal(sessionAllowed(stamp.getTime() / 1000 + 60, stamp), true);
});

test("unknown sign-in time with a stamp → refused (fail closed)", () => {
  assert.equal(sessionAllowed(null, at("2026-11-12T10:00:00Z")), false);
});

test("authTimeFromClaims takes the latest amr timestamp", () => {
  assert.equal(authTimeFromClaims({ amr: [{ method: "password", timestamp: 100 }, { method: "otp", timestamp: 250 }] }), 250);
  assert.equal(authTimeFromClaims({ amr: ["password"] }), null);
  assert.equal(authTimeFromClaims({}), null);
  assert.equal(authTimeFromClaims({ amr: "nonsense" }), null);
});
