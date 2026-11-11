import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { staff } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { authorize, type Permission, type StaffRecord } from "./permissions.ts";
import { authTimeFromClaims, sessionAllowed } from "./session-gate.ts";
import { createSupabaseServerClient } from "./supabase-server.ts";

// Verified token claims (getClaims), then a fresh staff row on every call. Sessions that started
// before the row's sessionsValidAfter (password reset, demotion, deactivation) count as signed out.
export async function getStaff(): Promise<StaffRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  if (!db) throw new DomainError("misconfigured", "DATABASE_URL is not set");
  const [row] = await db
    .select({
      userId: staff.userId,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      active: staff.active,
      sessionsValidAfter: staff.sessionsValidAfter,
    })
    .from(staff)
    .where(eq(staff.userId, claims.sub));
  if (!row) return null;
  if (!sessionAllowed(authTimeFromClaims(claims), row.sessionsValidAfter)) return null;
  const { sessionsValidAfter: _ignored, ...record } = row;
  void _ignored;
  return record;
}

export async function requirePermission(permission: Permission): Promise<StaffRecord> {
  return authorize(await getStaff(), permission);
}
