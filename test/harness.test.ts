import assert from "node:assert/strict";
import test from "node:test";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "../db/types.ts";
import * as schema from "../db/schema.ts";
import { createTestDb } from "./db.ts";

test("createTestDb applies migrations and closes", async () => {
  const { db, close } = await createTestDb();
  const rows = await db.select().from(schema.plans);
  assert.equal(rows.length, 4);
  await close();
});

// Type-level only: never called, so never connects.
async function _typeCheck() {
  const pgClient = drizzlePg(postgres("postgres://x"), { schema, casing: "snake_case" });
  const _a: Db = pgClient;
  const { db: _b } = await createTestDb();
  const _c: Db = _b;
  return [_a, _c];
}
void _typeCheck;
