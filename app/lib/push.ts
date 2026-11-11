import { eq, and, inArray } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { pushSubscriptions, staff } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { can, type Permission, type StaffRecord } from "./permissions.ts";
import { formatPrice } from "./money.ts";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export interface PushSender {
  send(sub: PushTarget, payload: string): Promise<"ok" | "gone" | "failed">;
}

export type PushEvent =
  | { kind: "order"; id: string; number: string; total: number; fulfilment: "pickup" | "delivery" }
  | { kind: "enquiry"; id: string; program: string };

// Lock screens are visible to anyone nearby: no customer names or phone numbers here.
export function pushPayload(e: PushEvent): string {
  return JSON.stringify(
    e.kind === "order"
      ? {
          title: `New order ${e.number}`,
          body: `${formatPrice(e.total)} · ${e.fulfilment === "pickup" ? "Pickup" : "Delivery"}`,
          url: `/admin/orders/${e.id}`,
          tag: `order-${e.id}`,
        }
      : { title: "New enquiry", body: e.program, url: `/admin/enquiries/${e.id}`, tag: `enquiry-${e.id}` },
  );
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const bad = (m: string): never => {
  throw new DomainError("invalid_input", m);
};

function activeOnly(actor: StaffRecord) {
  if (!actor.active) throw new DomainError("forbidden", "This account is deactivated.");
}

export async function savePushSubscription(
  db: Db,
  actor: StaffRecord,
  input: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
): Promise<void> {
  activeOnly(actor);
  let url: URL | null = null;
  try {
    url = new URL(input.endpoint);
  } catch {
    // handled below
  }
  if (!url || url.protocol !== "https:" || input.endpoint.length > 1000) bad("That notification address isn't valid.");
  for (const k of [input.p256dh, input.auth]) {
    if (typeof k !== "string" || !k || k.length > 200 || !BASE64URL.test(k)) bad("That notification key isn't valid.");
  }
  const userAgent = (input.userAgent ?? "").slice(0, 300);
  await db
    .insert(pushSubscriptions)
    .values({ staffUserId: actor.userId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { staffUserId: actor.userId, p256dh: input.p256dh, auth: input.auth, userAgent, createdAt: new Date() },
    });
}

export async function deletePushSubscription(db: Db, actor: StaffRecord, input: { endpoint: string }): Promise<void> {
  activeOnly(actor);
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, input.endpoint), eq(pushSubscriptions.staffUserId, actor.userId)));
}

const SEND_TIMEOUT_MS = 5000;

function withTimeout(p: Promise<"ok" | "gone" | "failed">): Promise<"ok" | "gone" | "failed"> {
  return Promise.race([p, new Promise<"failed">((r) => setTimeout(() => r("failed"), SEND_TIMEOUT_MS).unref?.())]);
}

// Never throws: a broken push must not affect the order or enquiry that triggered it.
export async function notifyStaff(
  db: Db,
  sender: PushSender,
  event: PushEvent,
): Promise<{ sent: number; removed: number; failed: number }> {
  const permission: Permission = event.kind === "order" ? "orders.manage" : "enquiries.manage";
  const result = { sent: 0, removed: 0, failed: 0 };
  try {
    const rows = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        createdAt: pushSubscriptions.createdAt,
        role: staff.role,
        validAfter: staff.sessionsValidAfter,
      })
      .from(pushSubscriptions)
      .innerJoin(staff, eq(staff.userId, pushSubscriptions.staffUserId))
      .where(eq(staff.active, true));
    const targets = rows.filter(
      (r) => can(r.role, permission) && (!r.validAfter || r.validAfter.getTime() < r.createdAt.getTime()),
    );
    const payload = pushPayload(event);
    const outcomes = await Promise.all(
      targets.map(async (t) => {
        try {
          return { t, r: await withTimeout(sender.send(t, payload)) };
        } catch (e) {
          console.error("push send failed", e);
          return { t, r: "failed" as const };
        }
      }),
    );
    const gone = outcomes.filter((o) => o.r === "gone").map((o) => o.t.id);
    const ok = outcomes.filter((o) => o.r === "ok").map((o) => o.t.id);
    if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    if (ok.length) await db.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(inArray(pushSubscriptions.id, ok));
    result.sent = ok.length;
    result.removed = gone.length;
    result.failed = outcomes.length - ok.length - gone.length;
    if (result.failed) console.error(`push: ${result.failed} notification(s) failed`);
  } catch (e) {
    console.error("notifyStaff failed", e);
  }
  return result;
}
