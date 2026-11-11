"use server";

import { db } from "../../../db/index.ts";
import { DomainError } from "../../lib/errors.ts";
import { deletePushSubscription, savePushSubscription } from "../../lib/push.ts";
import { toActionError, type ActionResult } from "../action-error.ts";
import { requireStaffAction } from "../guard.ts";

type Sub = { endpoint: string; p256dh: string; auth: string; userAgent?: string };

export async function savePush(sub: Sub): Promise<ActionResult> {
  try {
    const actor = await requireStaffAction();
    if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
    await savePushSubscription(db, actor, sub);
    return { ok: true, message: "Notifications are on for this device." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deletePush(endpoint: string): Promise<ActionResult> {
  try {
    const actor = await requireStaffAction();
    if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
    await deletePushSubscription(db, actor, { endpoint });
    return { ok: true, message: "Notifications are off for this device." };
  } catch (e) {
    return toActionError(e);
  }
}
