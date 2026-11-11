import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db/types.ts";
import type { StaffRecord } from "../app/lib/permissions.ts";
import { products, productVariants, settings, staff, type Role } from "../db/schema.ts";

export async function seedProduct(
  db: Db,
  o: { name: string; price: number; stock: number; label?: string; archived?: boolean; variantArchived?: boolean },
): Promise<{ productId: string; variantId: string }> {
  const [p] = await db
    .insert(products)
    .values({ slug: `p-${randomUUID()}`, name: o.name, category: "test", archived: o.archived ?? false })
    .returning({ id: products.id });
  const [v] = await db
    .insert(productVariants)
    .values({
      productId: p.id,
      label: o.label ?? "",
      price: o.price,
      stock: o.stock,
      archived: o.variantArchived ?? false,
    })
    .returning({ id: productVariants.id });
  return { productId: p.id, variantId: v.id };
}

export async function setShopOpen(db: Db, open: boolean): Promise<void> {
  await db.update(settings).set({ shopOpen: open }).where(eq(settings.id, 1));
}

export const newKey = (): string => randomUUID();

export async function seedStaff(db: Db, o: { role?: Role; active?: boolean } = {}): Promise<StaffRecord> {
  const userId = randomUUID();
  const rec: StaffRecord = {
    userId,
    name: "Test Staff",
    email: `s-${userId}@example.com`.toLowerCase(),
    role: o.role ?? "owner",
    active: o.active ?? true,
  };
  await db.insert(staff).values(rec);
  return rec;
}
