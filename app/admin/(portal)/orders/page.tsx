import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { orderStatus, type OrderStatus } from "../../../../db/schema.ts";
import { listOrders } from "../../../lib/admin-queries.ts";
import { formatPrice } from "../../../lib/plans.ts";
import { AutoRefresh } from "../../auto-refresh";
import { formatWhen, orderStatusLabel } from "../../format.ts";
import { requireStaffPage } from "../../guard.ts";

type Search = Promise<{ status?: string }>;

async function Orders({ searchParams }: { searchParams: Search }) {
  await requireStaffPage("orders.manage");
  const { status: raw } = await searchParams;
  const status = (orderStatus.enumValues as readonly string[]).includes(raw ?? "") ? (raw as OrderStatus) : undefined;
  const rows = db ? await listOrders(db, { status }) : [];
  const chips: { value?: OrderStatus; label: string }[] = [
    { label: "All" },
    ...orderStatus.enumValues.map((v) => ({ value: v, label: orderStatusLabel[v] })),
  ];

  return (
    <div className="grid gap-6">
      <AutoRefresh />
      <h1 className="font-display text-4xl font-bold uppercase">Orders</h1>
      <nav aria-label="Filter by status" className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.value ? `/admin/orders?status=${c.value}` : "/admin/orders"}
            aria-current={c.value === status ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              c.value === status ? "border-brass bg-brass text-matte" : "border-ash/40 text-bone/80"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="text-bone/70">No orders here yet. New orders from the shop appear here automatically.</p>
      ) : (
        <ul className="divide-y divide-ash/20 border-y border-ash/20">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-4 hover:text-brass-light">
                <span className="font-display text-xl font-bold">{o.number}</span>
                <span className="text-right font-display text-xl">{formatPrice(o.total)}</span>
                <span className="text-sm text-bone/75">
                  {o.customerName} · {o.fulfilment === "pickup" ? "Pickup" : "Delivery"}
                </span>
                <span className="text-right text-sm">
                  <span className={o.status === "new" ? "text-lamp" : "text-ash"}>{orderStatusLabel[o.status]}</span>
                  <span className="text-ash"> · {formatWhen(o.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OrdersPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}
