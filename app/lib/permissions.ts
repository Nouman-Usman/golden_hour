import type { Role } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";

export type Permission =
  | "orders.manage"
  | "enquiries.manage"
  | "stock.adjust"
  | "products.edit"
  | "plans.edit"
  | "content.edit"
  | "shop.settings"
  | "staff.manage";

const desk: readonly Role[] = ["owner", "front_desk"];
const owner: readonly Role[] = ["owner"];

export const permissions: Record<Permission, readonly Role[]> = {
  "orders.manage": desk,
  "enquiries.manage": desk,
  "stock.adjust": desk,
  "products.edit": owner,
  "plans.edit": owner,
  "content.edit": owner,
  "shop.settings": owner,
  "staff.manage": owner,
};

export function can(role: Role, permission: Permission): boolean {
  return permissions[permission].includes(role);
}

export type StaffRecord = { userId: string; name: string; email: string; role: Role; active: boolean };

export function authorize(staff: StaffRecord | null, permission: Permission): StaffRecord {
  if (!staff) throw new DomainError("unauthenticated", "Sign in to continue.");
  if (!staff.active) throw new DomainError("forbidden", "This account is deactivated.");
  if (!can(staff.role, permission)) throw new DomainError("forbidden", "You don't have permission to do this.");
  return staff;
}
