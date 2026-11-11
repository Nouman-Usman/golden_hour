import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { plans, type Plan } from "@/db/schema";

// Admin portal: call updateTag(PLANS_TAG) after saving a plan so the site shows it immediately.
export const PLANS_TAG = "plans";

export async function getPlans() {
  "use cache";
  cacheTag(PLANS_TAG);
  cacheLife("hours"); // also picks up edits made straight in the Supabase dashboard

  if (!db) return []; // DATABASE_URL not set yet: pricing section shows its fallback

  return db
    .select({
      id: plans.id,
      name: plans.name,
      price: plans.price,
      period: plans.period,
      description: plans.description,
      features: plans.features,
      highlighted: plans.highlighted,
    })
    .from(plans)
    .where(eq(plans.visible, true))
    .orderBy(asc(plans.position));
}

export { formatPrice } from "./money.ts";

export const periodLabel: Record<Plan["period"], string> = {
  one_time: "one time",
  month: "per month",
  quarter: "per 3 months",
  year: "per year",
};
