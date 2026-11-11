import { eq } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { settings } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { parseWholeNumber } from "./numbers.ts";
import { authorize, type StaffRecord } from "./permissions.ts";

export const SETTINGS_TAG = "settings";
const FEE_MAX = 5000;

export async function updateShopSettings(
  db: Db,
  actor: StaffRecord,
  input: { deliveryFee: unknown; shopOpen: boolean },
): Promise<void> {
  authorize(actor, "shop.settings");
  const fee = parseWholeNumber(input.deliveryFee);
  if (fee === null || fee > FEE_MAX) {
    const m = "Enter a delivery fee from Rs 0 to Rs 5,000.";
    throw new DomainError("invalid_input", m, { deliveryFee: m });
  }
  const done = await db
    .update(settings)
    .set({ deliveryFee: fee, shopOpen: input.shopOpen })
    .where(eq(settings.id, 1))
    .returning({ id: settings.id });
  if (!done.length) throw new DomainError("misconfigured", "Shop settings row is missing");
}
