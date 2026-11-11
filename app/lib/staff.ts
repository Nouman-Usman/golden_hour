import { and, count, eq, sql } from "drizzle-orm";
import { staff, type Role } from "../../db/schema.ts";
import type { Db } from "../../db/types.ts";
import { DomainError } from "./errors.ts";
import { authorize, can, type Permission, type StaffRecord } from "./permissions.ts";

export interface AuthAdmin {
  createUser(email: string, password: string): Promise<string>;
  deleteUser(userId: string): Promise<void>;
  setPassword(userId: string, password: string): Promise<void>;
  setBanned(userId: string, banned: boolean): Promise<void>;
  listUserIds(): Promise<string[]>;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkPassword(password: string) {
  if (password.length < 10) {
    throw new DomainError("invalid_input", "Password must be at least 10 characters.", {
      password: "At least 10 characters.",
    });
  }
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// A StaffRecord can be stale (taken at request start). Re-read the actor inside the transaction,
// share-locked so a concurrent demotion either waits for us or is seen by us, before any Auth call.
async function revalidateActor(tx: Tx, actor: StaffRecord, permission: Permission): Promise<void> {
  const [row] = await tx
    .select({ role: staff.role, active: staff.active })
    .from(staff)
    .where(eq(staff.userId, actor.userId))
    .for("share");
  if (!row || !row.active || !can(row.role, permission)) {
    throw new DomainError("forbidden", "Your access changed. Reload and try again.");
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

  let userId: string | undefined;
  try {
    await db.transaction(async (tx) => {
      await revalidateActor(tx, actor, "staff.manage");
      userId = await admin.createUser(email, input.password);
      await tx.insert(staff).values({ userId, name, email, role: input.role });
    });
  } catch (err) {
    if (userId) {
      try {
        await admin.deleteUser(userId);
      } catch {
        // ponytail: reconcile-staff reports orphans; it never auto-deletes.
        throw new Error(`Staff insert failed and Auth user ${userId} could not be deleted; remove it manually.`, {
          cause: err,
        });
      }
    }
    throw err;
  }
  return userId!;
}

// Serializes every owner-affecting change, re-validates the actor after the lock,
// then fails (rolling back) if no active owner would remain.
async function withOwnerGuard(db: Db, actor: StaffRecord, change: (tx: Tx) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('staff_owner_guard'))`);
    await revalidateActor(tx, actor, "staff.manage");
    await change(tx);
    const [{ n }] = await tx
      .select({ n: count() })
      .from(staff)
      .where(and(eq(staff.role, "owner"), eq(staff.active, true)));
    if (n === 0) throw new DomainError("forbidden", "There must be at least one active owner.");
  });
}

const notFound = (): never => {
  throw new DomainError("not_found", "Staff member not found.");
};

export async function setStaffRole(db: Db, actor: StaffRecord, userId: string, role: Role): Promise<void> {
  authorize(actor, "staff.manage");
  if (actor.userId === userId) throw new DomainError("forbidden", "You can't change your own role.");
  await withOwnerGuard(db, actor, async (tx) => {
    const [current] = await tx.select({ role: staff.role }).from(staff).where(eq(staff.userId, userId)).for("update");
    if (!current) notFound();
    const demoted = current.role === "owner" && role !== "owner";
    // A demotion signs them out everywhere: their old sessions carried owner rights.
    await tx
      .update(staff)
      .set(demoted ? { role, sessionsValidAfter: sql`now()` } : { role })
      .where(eq(staff.userId, userId));
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

  if (active) {
    // Unban first, inside the guard: if Auth fails, the transaction rolls back and the row stays inactive.
    await withOwnerGuard(db, actor, async (tx) => {
      const [exists] = await tx.select({ id: staff.userId }).from(staff).where(eq(staff.userId, userId)).for("update");
      if (!exists) notFound();
      await admin.setBanned(userId, false);
      await tx.update(staff).set({ active: true }).where(eq(staff.userId, userId));
    });
    return { authSynced: true };
  }

  await withOwnerGuard(db, actor, async (tx) => {
    const done = await tx
      .update(staff)
      .set({ active: false, sessionsValidAfter: sql`now()` })
      .where(eq(staff.userId, userId))
      .returning({ id: staff.userId });
    if (!done.length) notFound();
  });
  try {
    await admin.setBanned(userId, true); // also blocks refresh tokens
    return { authSynced: true };
  } catch {
    return { authSynced: false }; // DB row is inactive and sessions revoked, so access already stops; reconcile re-bans
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
  await db.transaction(async (tx) => {
    await revalidateActor(tx, actor, "staff.manage");
    const [exists] = await tx.select({ id: staff.userId }).from(staff).where(eq(staff.userId, userId)).for("update");
    if (!exists) notFound();
    await admin.setPassword(userId, password);
    // Every existing session for this account ends on its next request.
    await tx.update(staff).set({ sessionsValidAfter: sql`now()` }).where(eq(staff.userId, userId));
  });
}

export async function reconcileStaff(
  db: Db,
  admin: AuthAdmin,
): Promise<{ orphanAuthUsers: string[]; rebanned: string[]; failed: string[] }> {
  const rows = await db.select({ userId: staff.userId, active: staff.active }).from(staff);
  const known = new Set(rows.map((r) => r.userId));
  const orphanAuthUsers = (await admin.listUserIds()).filter((id) => !known.has(id));
  const rebanned: string[] = [];
  const failed: string[] = [];
  for (const r of rows) {
    if (r.active) continue;
    try {
      await admin.setBanned(r.userId, true);
      rebanned.push(r.userId);
    } catch {
      failed.push(r.userId); // keep going; rerun the script later
    }
  }
  return { orphanAuthUsers, rebanned, failed };
}
