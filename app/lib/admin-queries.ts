import { and, asc, count, eq, lte } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { enquiries, orders, products, productVariants } from "../../db/schema.ts";

export const LOW_STOCK_THRESHOLD = 3;

export type LowStockRow = { variantId: string; productId: string; productName: string; label: string; stock: number };

export async function dashboardCounts(
  db: Db,
): Promise<{ newOrders: number; newEnquiries: number; lowStock: LowStockRow[] }> {
  const [[o], [e], lowStock] = await Promise.all([
    db.select({ n: count() }).from(orders).where(eq(orders.status, "new")),
    db.select({ n: count() }).from(enquiries).where(eq(enquiries.status, "new")),
    db
      .select({
        variantId: productVariants.id,
        productId: products.id,
        productName: products.name,
        label: productVariants.label,
        stock: productVariants.stock,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(
        and(
          eq(products.archived, false),
          eq(productVariants.archived, false),
          lte(productVariants.stock, LOW_STOCK_THRESHOLD),
        ),
      )
      .orderBy(asc(productVariants.stock), asc(products.name))
      .limit(10),
  ]);
  return { newOrders: o.n, newEnquiries: e.n, lowStock };
}

export function adminTitle(c: { newOrders: number; newEnquiries: number }): string {
  const n = c.newOrders + c.newEnquiries;
  return n > 0 ? `(${n}) Golden Hour Admin` : "Golden Hour Admin";
}
