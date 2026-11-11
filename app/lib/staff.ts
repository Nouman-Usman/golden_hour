import { and, count, eq, sql } from "drizzle-orm";
import { staff, type Role } from "../../db/schema.ts";
import type { Db } from "../../db/types.ts";
import { DomainError } from "./errors.ts";
import { authorize, type StaffRecord } from "./permissions.ts";

export interface AuthAdmin {
  createUser(email: string, password: string): Promise<string>;
  deleteUser(userId: string): Promise<void>;
  setPassword(userId: string, password: string): Promise<void>;
  setBanned(userId: string, banned: boolean): Promise<void>;
  listUserIds(): Promise<string[]>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkPassword(password: string) {
  if (password.length < 10) {
    throw new DomainError("invalid_input", "Password must be at least 10 characters.", {
      password: "At least 10 characters.",
    });
  }
}

export async function createStaff(
  db: Db,
  admin: AuthAdmin,
  actor: StaffRecord,
  input: { name: string; email: string; role: Role; password: string },
): Promise<string> {
  authorize(actor, "staff.manage");
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL.test(email)) throw new DomainError("invalid_input", "Enter a valid email.", { email: "Invalid email." });
  if (!name) throw new DomainError("invalid_input", "Name is required.", { name: "Required." });
  checkPassword(input.password);

  const userId = await admin.createUser(email, input.password);
  try {
    await db.insert(staff).values({ userId, name, email, role: input.role });
  } catch (err) {
    try {
      await admin.deleteUser(userId);
    } catch {
      // ponytail: reconcile-staff reports orphans; it never auto-deletes.
      throw new Error(`Staff insert failed and Auth user ${userId} could not be deleted; remove it manually.`, {
        cause: err,
      });
    }
    throw err;
  }
  return userId;
}

// Serializes every owner-affecting change, then fails (rolling back) if no active owner would remain.
async function withOwnerGuard(db: Db, change: (tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('staff_owner_guard'))`);
    await change(tx);
    const [{ n }] = await tx
      .select({ n: count() })
      .from(staff)
      .where(and(eq(staff.role, "owner"), eq(staff.active, true)));
    if (n === 0) throw new DomainError("forbidden", "There must be at least one active owner.");
  });
}

export async function setStaffRole(db: Db, actor: StaffRecord, userId: string, role: Role): Promise<void> {
  authorize(actor, "staff.manage");
  if (actor.userId === userId) throw new DomainError("forbidden", "You can't change your own role.");
  await withOwnerGuard(db, async (tx) => {
    const updated = await tx.update(staff).set({ role }).where(eq(staff.userId, userId)).returning({ id: staff.userId });
    if (!updated.length) throw new DomainError("not_found", "Staff member not found.");
  });
}

export async function setStaffActive(
  db: Db,
  admin: AuthAdmin,
  actor: StaffRecord,
  userId: string,
  active: boolean,
): Promise<{ authSynced: boolean }> {
  authorize(actor, "staff.manage");
  if (!active && actor.userId === userId) throw new DomainError("forbidden", "You can't deactivate yourself.");
  const apply = (tx: Pick<Db, "update">) =>
    tx.update(staff).set({ active }).where(eq(staff.userId, userId)).returning({ id: staff.userId });

  if (active) {
    const [exists] = await db.select({ id: staff.userId }).from(staff).where(eq(staff.userId, userId));
    if (!exists) throw new DomainError("not_found", "Staff member not found.");
    await admin.setBanned(userId, false); // failure throws; row stays inactive
    await withOwnerGuard(db, async (tx) => void (await apply(tx)));
    return { authSynced: true };
  }

  await withOwnerGuard(db, async (tx) => {
    if (!(await apply(tx)).length) throw new DomainError("not_found", "Staff member not found.");
  });
  try {
    await admin.setBanned(userId, true);
    return { authSynced: true };
  } catch {
    return { authSynced: false }; // DB row is inactive, so access already stops; reconcile re-bans
  }
}

export async function resetStaffPassword(
  db: Db,
  admin: AuthAdmin,
  actor: StaffRecord,
  userId: string,
  password: string,
): Promise<void> {
  authorize(actor, "staff.manage");
  checkPassword(password);
  const [exists] = await db.select({ id: staff.userId }).from(staff).where(eq(staff.userId, userId));
  if (!exists) throw new DomainError("not_found", "Staff member not found.");
  await admin.setPassword(userId, password);
}

export async function reconcileStaff(
  db: Db,
  admin: AuthAdmin,
): Promise<{ orphanAuthUsers: string[]; rebanned: string[] }> {
  const rows = await db.select({ userId: staff.userId, active: staff.active }).from(staff);
  const known = new Set(rows.map((r) => r.userId));
  const orphanAuthUsers = (await admin.listUserIds()).filter((id) => !known.has(id));
  const rebanned: string[] = [];
  for (const r of rows) {
    if (r.active) continue;
    await admin.setBanned(r.userId, true);
    rebanned.push(r.userId);
  }
  return { orphanAuthUsers, rebanned };
}
