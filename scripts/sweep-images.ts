// node --env-file=.env scripts/sweep-images.ts
// Deletes product images in storage that no product references (older than 1 hour).
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.ts";
import { sweepOrphanImages } from "../app/lib/products.ts";
import { makeImageStore } from "../app/lib/supabase-storage.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema, casing: "snake_case" });
try {
  console.log(JSON.stringify(await sweepOrphanImages(db, makeImageStore()), null, 2));
} finally {
  await client.end();
}
