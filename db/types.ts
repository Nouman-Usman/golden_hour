import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema.ts";

// Spike outcome: PostgresJsDatabase<schema> and PgliteDatabase<schema> are both assignable to
// PgDatabase<PgQueryResultHKT, typeof schema> (checked in test/harness.test.ts), so domain
// functions need no generic D. They take Db and open their own transactions.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
