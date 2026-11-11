"use server";

import { revalidatePath } from "next/cache";
import { db } from "../../../../db/index.ts";
import type { EnquiryStatus } from "../../../../db/schema.ts";
import { changeEnquiryStatus, setEnquiryNotes } from "../../../lib/enquiries.ts";
import { DomainError } from "../../../lib/errors.ts";
import { toActionError, type ActionResult } from "../../action-error.ts";
import { requireStaffAction } from "../../guard.ts";

function need() {
  if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
  return db;
}

export async function changeStatus(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enquiryId = String(form.get("enquiryId") ?? "");
  try {
    const actor = await requireStaffAction("enquiries.manage");
    await changeEnquiryStatus(need(), actor, {
      enquiryId,
      to: String(form.get("to") ?? "") as EnquiryStatus,
      note: String(form.get("note") ?? "").trim() || undefined,
    });
    revalidatePath("/admin/enquiries");
    revalidatePath(`/admin/enquiries/${enquiryId}`);
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveNotes(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const enquiryId = String(form.get("enquiryId") ?? "");
  try {
    const actor = await requireStaffAction("enquiries.manage");
    await setEnquiryNotes(need(), actor, { enquiryId, notes: String(form.get("notes") ?? "") });
    revalidatePath(`/admin/enquiries/${enquiryId}`);
    return { ok: true, message: "Notes saved." };
  } catch (e) {
    return toActionError(e);
  }
}
