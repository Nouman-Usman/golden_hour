import { and, asc, count, desc, eq, lte } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import {
  enquiries,
  enquiryEvents,
  orderEvents,
  orderItems,
  orders,
  products,
  productVariants,
  staff,
  type EnquiryStatus,
  type OrderStatus,
} from "../../db/schema.ts";
import { isUuid } from "./idempotency.ts";

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

export type OrderRow = {
  id: string;
  number: string;
  status: OrderStatus;
  fulfilment: "pickup" | "delivery";
  customerName: string;
  total: number;
  createdAt: Date;
};

export async function listOrders(db: Db, o: { status?: OrderStatus; limit?: number }): Promise<OrderRow[]> {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      fulfilment: orders.fulfilment,
      customerName: orders.customerName,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(o.status ? eq(orders.status, o.status) : undefined)
    .orderBy(desc(orders.createdAt), desc(orders.number))
    .limit(o.limit ?? 50);
}

export type HistoryEvent = {
  fromStatus: string | null;
  toStatus: string;
  staffName: string;
  note: string | null;
  createdAt: Date;
};

export async function getOrderDetail(db: Db, id: string) {
  if (!isUuid(id)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;
  const [items, events] = await Promise.all([
    db
      .select({
        productName: orderItems.productName,
        variantLabel: orderItems.variantLabel,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, id)),
    db
      .select({
        fromStatus: orderEvents.fromStatus,
        toStatus: orderEvents.toStatus,
        staffName: staff.name,
        note: orderEvents.note,
        createdAt: orderEvents.createdAt,
      })
      .from(orderEvents)
      .leftJoin(staff, eq(staff.userId, orderEvents.staffUserId))
      .where(eq(orderEvents.orderId, id))
      .orderBy(asc(orderEvents.createdAt), asc(orderEvents.id)),
  ]);
  return {
    ...order,
    items,
    events: events.map((e): HistoryEvent => ({ ...e, staffName: e.staffName ?? "Customer" })),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

export type EnquiryRow = { id: string; name: string; program: string; status: EnquiryStatus; createdAt: Date };

export async function listEnquiries(db: Db, o: { status?: EnquiryStatus; limit?: number }): Promise<EnquiryRow[]> {
  return db
    .select({
      id: enquiries.id,
      name: enquiries.name,
      program: enquiries.program,
      status: enquiries.status,
      createdAt: enquiries.createdAt,
    })
    .from(enquiries)
    .where(o.status ? eq(enquiries.status, o.status) : undefined)
    .orderBy(desc(enquiries.createdAt), desc(enquiries.id))
    .limit(o.limit ?? 50);
}

export async function getEnquiryDetail(db: Db, id: string) {
  if (!isUuid(id)) return null;
  const [enquiry] = await db.select().from(enquiries).where(eq(enquiries.id, id));
  if (!enquiry) return null;
  const events = await db
    .select({
      fromStatus: enquiryEvents.fromStatus,
      toStatus: enquiryEvents.toStatus,
      staffName: staff.name,
      note: enquiryEvents.note,
      createdAt: enquiryEvents.createdAt,
    })
    .from(enquiryEvents)
    .leftJoin(staff, eq(staff.userId, enquiryEvents.staffUserId))
    .where(eq(enquiryEvents.enquiryId, id))
    .orderBy(asc(enquiryEvents.createdAt), asc(enquiryEvents.id));
  return { ...enquiry, events: events.map((e): HistoryEvent => ({ ...e, staffName: e.staffName ?? "Customer" })) };
}

export type EnquiryDetail = NonNullable<Awaited<ReturnType<typeof getEnquiryDetail>>>;
