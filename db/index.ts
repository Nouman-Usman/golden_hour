import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

// Reuse one connection pool across dev hot reloads.
const g = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
// prepare: false is required by Supabase's transaction pooler (port 6543).
const client = url ? (g.pg ??= postgres(url, { prepare: false })) : null;

// null until DATABASE_URL is set; callers fall back gracefully.
export const db = client ? drizzle(client, { schema, casing: "snake_case" }) : null;
