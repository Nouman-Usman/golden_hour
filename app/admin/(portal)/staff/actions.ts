"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../../../db/index.ts";
import type { Db } from "../../../../db/types.ts";
import type { Role } from "../../../../db/schema.ts";
import { DomainError } from "../../../lib/errors.ts";
import type { StaffRecord } from "../../../lib/permissions.ts";
import { createStaff, resetStaffPassword, setStaffActive, setStaffRole } from "../../../lib/staff.ts";
import { supabaseAuthAdmin } from "../../../lib/supabase-admin.ts";
import { toActionError, type ActionResult } from "../../action-error.ts";
import { requireStaffAction } from "../../guard.ts";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const role = (v: string): Role => (v === "owner" ? "owner" : "front_desk");
const BAN_NOTE = "Saved, but the ban on their login didn't complete. Run the reconcile script.";

async function run(fn: (database: Db, actor: StaffRecord) => Promise<string>): Promise<ActionResult> {
  try {
    const actor = await requireStaffAction("staff.manage");
    if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
    const message = await fn(db, actor);
    revalidatePath("/admin/staff");
    return { ok: true, message };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createStaffAction(_p: ActionResult | null, f: FormData) {
  return run(async (database, actor) => {
    await createStaff(database, supabaseAuthAdmin, actor, {
      name: s(f, "name"),
      email: s(f, "email"),
      role: role(s(f, "role")),
      password: s(f, "password"),
    });
    return "Account created. Share the temporary password in person.";
  });
}

export async function setRoleAction(_p: ActionResult | null, f: FormData) {
  return run(async (database, actor) => {
    await setStaffRole(database, actor, s(f, "userId"), role(s(f, "role")));
    return "Role updated.";
  });
}

export async function setActiveAction(_p: ActionResult | null, f: FormData) {
  return run(async (database, actor) => {
    const active = s(f, "active") === "true";
    const r = await setStaffActive(database, supabaseAuthAdmin, actor, s(f, "userId"), active);
    if (!r.authSynced) return BAN_NOTE;
    return active ? "Account reactivated." : "Account deactivated and signed out everywhere.";
  });
}

export async function resetPasswordAction(_p: ActionResult | null, f: FormData) {
  return run(async (database, actor) => {
    await resetStaffPassword(database, supabaseAuthAdmin, actor, s(f, "userId"), s(f, "password"));
    return "Password reset. They've been signed out everywhere.";
  });
}
