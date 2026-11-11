import { eq } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { settings, type Settings } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";

export type { Settings };

export async function getSettings(db: Db): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!row) throw new DomainError("misconfigured", "Shop settings row is missing");
  return row;
}
