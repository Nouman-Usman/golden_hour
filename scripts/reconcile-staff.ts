// node --env-file=.env scripts/reconcile-staff.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.ts";
import { makeAuthAdmin } from "../app/lib/supabase-auth-admin.ts";
import { reconcileStaff } from "../app/lib/staff.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema, casing: "snake_case" });
try {
  console.log(JSON.stringify(await reconcileStaff(db, makeAuthAdmin()), null, 2));
} finally {
  await client.end();
}
