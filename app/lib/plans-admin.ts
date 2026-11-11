import { asc, eq, max, sql } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { planPeriod, plans } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { isUuid } from "./idempotency.ts";
import { parseWholeNumber } from "./numbers.ts";
import { authorize, type StaffRecord } from "./permissions.ts";

type Period = (typeof planPeriod.enumValues)[number];

const bad = (field: string, message: string): never => {
  throw new DomainError("invalid_input", message, { [field]: message });
};
const notFound = (): never => {
  throw new DomainError("not_found", "Plan not found.");
};

export type PlanInput = {
  planId?: string;
  name: unknown;
  price: unknown;
  period: unknown;
  description: unknown;
  features: unknown[];
  highlighted: boolean;
  visible: boolean;
};

export async function savePlan(db: Db, actor: StaffRecord, input: PlanInput): Promise<string> {
  authorize(actor, "plans.edit");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 1 || name.length > 40) bad("name", "Enter a plan name (up to 40 characters).");
  const price = parseWholeNumber(input.price);
  if (price === null) bad("price", "Enter a price in whole rupees.");
  const period = input.period as Period;
  if (!planPeriod.enumValues.includes(period)) bad("period", "Choose how often it's paid.");
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > 200) bad("description", "Keep the description under 200 characters.");
  const features = input.features.map((f) => (typeof f === "string" ? f.trim() : "")).filter(Boolean);
  if (features.length > 8) bad("features", "Up to 8 features.");
  if (features.some((f) => f.length > 60)) bad("features", "Keep each feature under 60 characters.");

  const values = {
    name,
    price: price!,
    period,
    description: description || null,
    features,
    highlighted: input.highlighted,
    visible: input.visible,
  };
  if (input.planId) {
    if (!isUuid(input.planId)) notFound();
    const done = await db.update(plans).set(values).where(eq(plans.id, input.planId)).returning({ id: plans.id });
    if (!done.length) notFound();
    return input.planId;
  }
  const [{ next }] = await db.select({ next: sql<number>`coalesce(${max(plans.position)}, -1) + 1` }).from(plans);
  const [row] = await db.insert(plans).values({ ...values, position: Number(next) }).returning({ id: plans.id });
  return row.id;
}

// Lock all plan rows (id order) so concurrent moves serialize, then swap with the neighbour in display order.
export async function movePlan(
  db: Db,
  actor: StaffRecord,
  input: { planId: string; direction: "up" | "down" },
): Promise<void> {
  authorize(actor, "plans.edit");
  if (!isUuid(input.planId)) notFound();
  await db.transaction(async (tx) => {
    await tx.select({ id: plans.id }).from(plans).orderBy(asc(plans.id)).for("update");
    const list = await tx
      .select({ id: plans.id, position: plans.position })
      .from(plans)
      .orderBy(asc(plans.position), asc(plans.name), asc(plans.id));
    const i = list.findIndex((p) => p.id === input.planId);
    if (i < 0) notFound();
    const j = input.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    // Renumber densely so equal positions can't make a swap a no-op.
    const order = list.map((p) => p.id);
    [order[i], order[j]] = [order[j], order[i]];
    for (const [pos, id] of order.entries()) await tx.update(plans).set({ position: pos }).where(eq(plans.id, id));
  });
}

export async function deletePlan(db: Db, actor: StaffRecord, input: { planId: string }): Promise<void> {
  authorize(actor, "plans.edit");
  if (!isUuid(input.planId)) notFound();
  const done = await db.delete(plans).where(eq(plans.id, input.planId)).returning({ id: plans.id });
  if (!done.length) notFound();
}
