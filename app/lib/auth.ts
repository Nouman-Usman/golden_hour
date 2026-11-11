import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { staff } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { authorize, type Permission, type StaffRecord } from "./permissions.ts";
import { createSupabaseServerClient } from "./supabase-server.ts";

// Verified user from Auth (getUser, not getSession), then a fresh staff row on every call.
export async function getStaff(): Promise<StaffRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  if (!db) throw new DomainError("misconfigured", "DATABASE_URL is not set");
  const [row] = await db
    .select({ userId: staff.userId, name: staff.name, email: staff.email, role: staff.role, active: staff.active })
    .from(staff)
    .where(eq(staff.userId, data.user.id));
  return row ?? null;
}

export async function requirePermission(permission: Permission): Promise<StaffRecord> {
  return authorize(await getStaff(), permission);
}
