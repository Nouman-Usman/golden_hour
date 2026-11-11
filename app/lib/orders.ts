import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { orders, orderItems, orderEvents, products, productVariants, type OrderStatus } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { normalizePkMobile } from "./enquiry.ts";
import { isUuid, requestHash } from "./idempotency.ts";
import { authorize, type StaffRecord } from "./permissions.ts";
import { getSettings } from "./settings.ts";

export type PlaceOrderInput = {
  idempotencyKey: string;
  customerName: string;
  customerPhone: string;
  fulfilment: "pickup" | "delivery";
  address?: string;
  items: { variantId: string; quantity: number }[];
};

type Placed = { id: string; number: string; created: boolean };

const invalid = (fields: Record<string, string>) =>
  new DomainError("invalid_input", "Check the highlighted fields.", fields);

async function findExisting(db: Db, key: string, hash: string): Promise<Placed | null> {
  const [row] = await db
    .select({ id: orders.id, number: orders.number, requestHash: orders.requestHash })
    .from(orders)
    .where(eq(orders.idempotencyKey, key));
  if (!row) return null;
  if (row.requestHash !== hash) {
    throw new DomainError(
      "idempotency_conflict",
      "This checkout was already submitted with different details. Refresh and try again.",
    );
  }
  return { id: row.id, number: row.number, created: false };
}

export async function placeOrder(db: Db, input: PlaceOrderInput): Promise<Placed> {
  if (typeof input.idempotencyKey !== "string" || !isUuid(input.idempotencyKey)) {
    throw invalid({ idempotencyKey: "Invalid request key." });
  }

  const name = String(input.customerName ?? "").trim();
  const phone = normalizePkMobile(String(input.customerPhone ?? "").trim());
  const delivery = input.fulfilment === "delivery";
  const address = delivery ? String(input.address ?? "").trim() : undefined;
  const rawItems = Array.isArray(input.items) ? input.items : [];

  const merged = new Map<string, number>();
  let badQty = false;
  let badVariant = false;
  for (const it of rawItems) {
    if (typeof it?.variantId !== "string" || !isUuid(it.variantId)) { badVariant = true; continue; }
    if (!Number.isInteger(it?.quantity) || it.quantity < 1) { badQty = true; continue; }
    merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.quantity);
  }
  const items = [...merged].map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((a, b) => (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));

  const hash = requestHash({
    customerName: name,
    customerPhone: phone,
    fulfilment: input.fulfilment,
    address,
    items,
  });

  const existing = await findExisting(db, input.idempotencyKey, hash);
  if (existing) return existing;

  const fields: Record<string, string> = {};
  if (!name) fields.customerName = "Enter your name.";
  else if (name.length > 80) fields.customerName = "Keep your name under 80 characters.";
  if (!phone) fields.customerPhone = "Enter a Pakistani mobile number, like 0321 4220245.";
  if (input.fulfilment !== "pickup" && !delivery) fields.items = "Invalid fulfilment.";
  if (delivery && !address) fields.address = "Enter a delivery address in Lahore.";
  if (rawItems.length === 0) fields.items = "Add at least one item.";
  else if (badVariant) fields.items = "One of the items isn't valid.";
  else if (badQty) fields.items = "Quantities must be whole numbers of 1 or more.";
  else if (items.length > 20) fields.items = "Too many different items in one order (max 20).";
  if (Object.keys(fields).length) throw invalid(fields);

  const result = await db.transaction(async (tx) => {
    const s = await getSettings(tx);
    if (!s.shopOpen) throw new DomainError("shop_closed", "The shop isn't taking orders right now.");

    const rows = await tx
      .select({
        variantId: productVariants.id,
        productId: products.id,
        productName: products.name,
        label: productVariants.label,
        price: productVariants.price,
        stock: productVariants.stock,
        variantArchived: productVariants.archived,
        productArchived: products.archived,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, items.map((i) => i.variantId)));
    const byId = new Map(rows.map((r) => [r.variantId, r]));

    const lines = items.map((it) => {
      const r = byId.get(it.variantId);
      if (!r || r.variantArchived || r.productArchived) {
        throw new DomainError("unavailable", `${r?.productName ?? "One of the items"} is no longer available.`);
      }
      if (it.quantity > r.stock) {
        throw new DomainError(
          "insufficient_stock",
          `Only ${r.stock} left of ${r.productName}${r.label ? ` (${r.label})` : ""}.`,
        );
      }
      return { ...it, r, lineTotal: r.price * it.quantity };
    });

    const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);
    const deliveryFee = delivery ? s.deliveryFee : 0;

    const [row] = await tx
      .insert(orders)
      .values({
        number: sql<string>`'GH-' || nextval('order_number_seq')`,
        idempotencyKey: input.idempotencyKey,
        requestHash: hash,
        fulfilment: input.fulfilment,
        customerName: name,
        customerPhone: phone!,
        address: address ?? null,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
      })
      .onConflictDoNothing({ target: orders.idempotencyKey })
      .returning({ id: orders.id, number: orders.number });
    if (!row) return null; // lost a race; caller re-reads outside the transaction

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: row.id,
        productId: l.r.productId,
        variantId: l.variantId,
        productName: l.r.productName,
        variantLabel: l.r.label,
        unitPrice: l.r.price,
        quantity: l.quantity,
        lineTotal: l.lineTotal,
      })),
    );
    await tx.insert(orderEvents).values({ orderId: row.id, fromStatus: null, toStatus: "new", staffUserId: null });
    return row;
  });

  if (result) return { ...result, created: true };
  const winner = await findExisting(db, input.idempotencyKey, hash);
  if (!winner) throw new DomainError("misconfigured", "Order insert conflicted but no order was found");
  return winner;
}

export const nextStatuses: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["ready_for_pickup", "out_for_delivery", "cancelled"],
  ready_for_pickup: ["completed", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export type OrderStatusInput = { orderId: string; to: OrderStatus; note?: string };

// Lock order: order row, then its variant rows by ascending id (same as any stock-touching tx).
export async function changeOrderStatus(db: Db, actor: StaffRecord, input: OrderStatusInput): Promise<void> {
  authorize(actor, "orders.manage");
  const { orderId, to, note } = input;
  if (typeof orderId !== "string" || !isUuid(orderId)) throw new DomainError("not_found", "Order not found.");
  const staffUserId = actor.userId;
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select({ status: orders.status, fulfilment: orders.fulfilment })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) throw new DomainError("not_found", "Order not found.");
    const from = order.status;

    const wrongFulfilment =
      (to === "ready_for_pickup" && order.fulfilment === "delivery") ||
      (to === "out_for_delivery" && order.fulfilment === "pickup");
    if (!nextStatuses[from].includes(to) || wrongFulfilment) {
      throw new DomainError("invalid_transition", `An order can't move from ${from} to ${to}.`);
    }

    const confirm = to === "confirmed";
    const restore = to === "cancelled" && from !== "new";
    if (confirm || restore) {
      // One statement, ORDER BY id: every writer acquires variant locks in the same order.
      const stockRows = await tx
        .select({ id: productVariants.id, stock: productVariants.stock })
        .from(productVariants)
        .where(inArray(productVariants.id, tx.select({ v: orderItems.variantId }).from(orderItems).where(eq(orderItems.orderId, orderId))))
        .orderBy(productVariants.id)
        .for("update");
      const stock = new Map(stockRows.map((r) => [r.id, r.stock]));

      const items = await tx
        .select({
          variantId: orderItems.variantId,
          productName: orderItems.productName,
          variantLabel: orderItems.variantLabel,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));
      const need = new Map<string, { qty: number; name: string; label: string }>();
      for (const it of items) {
        const cur = need.get(it.variantId);
        need.set(it.variantId, { qty: (cur?.qty ?? 0) + it.quantity, name: it.productName, label: it.variantLabel });
      }
      const lines = [...need].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

      if (confirm) {
        for (const [vid, n] of lines) {
          const have = stock.get(vid) ?? 0;
          if (have < n.qty) {
            throw new DomainError("insufficient_stock", `Only ${have} left of ${n.name}${n.label ? ` (${n.label})` : ""}.`);
          }
        }
      }
      for (const [vid, n] of lines) {
        await tx
          .update(productVariants)
          .set({ stock: confirm ? sql`${productVariants.stock} - ${n.qty}` : sql`${productVariants.stock} + ${n.qty}` })
          .where(eq(productVariants.id, vid));
      }
    }

    await tx.update(orders).set({ status: to, updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, fromStatus: from, toStatus: to, staffUserId, note: note ?? null });
  });
}
