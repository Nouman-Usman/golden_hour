import { test } from "node:test";
import assert from "node:assert/strict";
import { SIDEBAR_COOKIE, sidebarCollapsed, sidebarCookie } from "../app/admin/sidebar-state.ts";

test("sidebar is expanded unless the cookie says collapsed", () => {
  assert.equal(sidebarCollapsed(undefined), false);
  assert.equal(sidebarCollapsed("expanded"), false);
  assert.equal(sidebarCollapsed("junk"), false);
  assert.equal(sidebarCollapsed("collapsed"), true);
});

test("cookie string is scoped to /admin and long-lived", () => {
  const c = sidebarCookie(true);
  assert.match(c, new RegExp(`^${SIDEBAR_COOKIE}=collapsed;`));
  assert.match(c, /Path=\/admin/);
  assert.match(c, /Max-Age=31536000/);
  assert.match(c, /SameSite=Lax/);
  assert.match(sidebarCookie(false), /=expanded;/);
});
