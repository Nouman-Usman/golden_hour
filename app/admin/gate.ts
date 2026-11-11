import { can, type Permission, type StaffRecord } from "../lib/permissions.ts";

export type Gate =
  | { kind: "ok"; staff: StaffRecord }
  | { kind: "signin" }
  | { kind: "deactivated" }
  | { kind: "forbidden" };

// Pure decision used by every admin page, action and route guard.
export function staffGate(staff: StaffRecord | null, permission?: Permission): Gate {
  if (!staff) return { kind: "signin" };
  if (!staff.active) return { kind: "deactivated" };
  if (permission && !can(staff.role, permission)) return { kind: "forbidden" };
  return { kind: "ok", staff };
}
