// node --env-file=.env scripts/create-owner.ts <email> <name>   (password from OWNER_PASSWORD)
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.ts";
import { makeAuthAdmin } from "../app/lib/supabase-auth-admin.ts";

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
const password = process.env.OWNER_PASSWORD ?? "";
if (!email || !name) throw new Error("Usage: create-owner.ts <email> <name>");
if (password.length < 10) throw new Error("OWNER_PASSWORD must be set (at least 10 characters)");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema, casing: "snake_case" });
const admin = makeAuthAdmin();
const lower = email.trim().toLowerCase();

const userId = await admin.createUser(lower, password);
try {
  await db.insert(schema.staff).values({ userId, name, email: lower, role: "owner" });
} catch (err) {
  await admin.deleteUser(userId).catch(() => console.error(`Orphan Auth user ${userId}: delete it manually`));
  throw err;
} finally {
  await client.end();
}
console.log(`Owner created: ${lower} (${userId})`);
