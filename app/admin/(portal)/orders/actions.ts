"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../../../db/index.ts";
import type { OrderStatus } from "../../../../db/schema.ts";
import { changeOrderStatus, setOrderNotes } from "../../../lib/orders.ts";
import { DomainError } from "../../../lib/errors.ts";
import { toActionError, type ActionResult } from "../../action-error.ts";
import { requireStaffAction } from "../../guard.ts";

function need() {
  if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
  return db;
}

export async function changeStatus(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const orderId = String(form.get("orderId") ?? "");
  try {
    const actor = await requireStaffAction("orders.manage");
    await changeOrderStatus(need(), actor, {
      orderId,
      to: String(form.get("to") ?? "") as OrderStatus,
      note: String(form.get("note") ?? "").trim() || undefined,
    });
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveNotes(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const orderId = String(form.get("orderId") ?? "");
  try {
    const actor = await requireStaffAction("orders.manage");
    await setOrderNotes(need(), actor, { orderId, notes: String(form.get("notes") ?? "") });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Notes saved." };
  } catch (e) {
    return toActionError(e);
  }
}
