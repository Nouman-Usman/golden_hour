import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const planPeriod = pgEnum("plan_period", ["one_time", "month", "quarter", "year"]);

// Membership plans shown in the pricing section; the admin portal edits these.
// RLS on with no policies: Supabase's public Data API can't touch it, only our server connection can.
export const plans = pgTable(
  "plans",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    price: integer().notNull(), // PKR, whole rupees
    period: planPeriod().notNull().default("month"),
    description: text(),
    features: text().array().notNull().default(sql`'{}'::text[]`),
    highlighted: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    visible: boolean().notNull().default(true),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [check("plans_price_non_negative", sql`${t.price} >= 0`)],
).enableRLS();

export type Plan = typeof plans.$inferSelect;
