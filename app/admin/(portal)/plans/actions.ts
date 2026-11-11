"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "../../../../db/index.ts";
import type { Db } from "../../../../db/types.ts";
import { DomainError } from "../../../lib/errors.ts";
import type { StaffRecord } from "../../../lib/permissions.ts";
import { PLANS_TAG } from "../../../lib/plans.ts";
import { deletePlan, movePlan, savePlan } from "../../../lib/plans-admin.ts";
import { toActionError, type ActionResult } from "../../action-error.ts";
import { requireStaffAction } from "../../guard.ts";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");

async function run(fn: (database: Db, actor: StaffRecord) => Promise<unknown>, message: string): Promise<ActionResult> {
  try {
    const actor = await requireStaffAction("plans.edit");
    if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
    await fn(db, actor);
    updateTag(PLANS_TAG); // public pricing updates immediately
    revalidatePath("/admin/plans");
    return { ok: true, message };
  } catch (e) {
    return toActionError(e);
  }
}

export async function savePlanAction(_p: ActionResult | null, f: FormData) {
  return run(
    (database, actor) =>
      savePlan(database, actor, {
        planId: s(f, "planId") || undefined,
        name: s(f, "name"),
        price: s(f, "price"),
        period: s(f, "period"),
        description: s(f, "description"),
        features: s(f, "features").split("\n"),
        highlighted: f.get("highlighted") === "on",
        visible: f.get("visible") === "on",
      }),
    "Plan saved. The website is updated.",
  );
}

export async function movePlanAction(_p: ActionResult | null, f: FormData) {
  return run(
    (database, actor) => movePlan(database, actor, { planId: s(f, "planId"), direction: s(f, "direction") === "up" ? "up" : "down" }),
    "Order updated.",
  );
}

export async function deletePlanAction(_p: ActionResult | null, f: FormData) {
  return run((database, actor) => deletePlan(database, actor, { planId: s(f, "planId") }), "Plan deleted.");
}
