import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getStaff } from "../lib/auth.ts";
import { DomainError } from "../lib/errors.ts";
import type { Permission, StaffRecord } from "../lib/permissions.ts";
import { staffGate } from "./gate.ts";

// Every admin page and generateMetadata calls this before reading protected data.
export async function requireStaffPage(permission?: Permission): Promise<StaffRecord> {
  await connection(); // auth is per request: never prerender past this point
  const gate = staffGate(await getStaff(), permission);
  if (gate.kind === "signin") redirect("/admin/login");
  // Pages can't set cookies while rendering, so sign-out happens in the logout route.
  if (gate.kind === "deactivated") redirect("/admin/logout?reason=deactivated");
  if (gate.kind === "forbidden") redirect("/admin?denied=1");
  return gate.staff;
}

// Every admin server action and route handler calls this first. No permission = active staff only.
export async function requireStaffAction(permission?: Permission): Promise<StaffRecord> {
  await connection();
  const gate = staffGate(await getStaff(), permission);
  if (gate.kind === "signin") throw new DomainError("unauthenticated", "Sign in to continue.");
  if (gate.kind === "deactivated") throw new DomainError("forbidden", "This account is deactivated.");
  if (gate.kind === "forbidden") throw new DomainError("forbidden", "You don't have permission to do this.");
  return gate.staff;
}
