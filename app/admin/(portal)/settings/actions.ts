"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "../../../../db/index.ts";
import { DomainError } from "../../../lib/errors.ts";
import { SETTINGS_TAG, updateShopSettings } from "../../../lib/settings-admin.ts";
import { toActionError, type ActionResult } from "../../action-error.ts";
import { requireStaffAction } from "../../guard.ts";

export async function saveShopSettings(_p: ActionResult | null, f: FormData): Promise<ActionResult> {
  try {
    const actor = await requireStaffAction("shop.settings");
    if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
    await updateShopSettings(db, actor, { deliveryFee: String(f.get("deliveryFee") ?? ""), shopOpen: f.get("shopOpen") === "on" });
    updateTag(SETTINGS_TAG);
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return toActionError(e);
  }
}
