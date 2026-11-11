import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { orderStatus, type OrderStatus } from "../../../../db/schema.ts";
import { listOrders } from "../../../lib/admin-queries.ts";
import { formatPrice } from "../../../lib/plans.ts";
import { AutoRefresh } from "../../auto-refresh";
import { formatWhen, orderStatusLabel } from "../../format.ts";
import { requireStaffPage } from "../../guard.ts";
import { Chips, EmptyState, PageHeader, Pill, toneFor } from "../ui";

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
    <div>
      <AutoRefresh />
      <PageHeader title="Orders" description="Shop orders, newest first. Customers pay cash on pickup or delivery." />
      <Chips
        items={chips.map((c) => ({
          href: c.value ? `/admin/orders?status=${c.value}` : "/admin/orders",
          label: c.label,
          active: c.value === status,
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState icon="orders" title={status ? `No ${orderStatusLabel[status].toLowerCase()} orders` : "No orders yet"}>
          New orders from the shop appear here automatically.
        </EmptyState>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="grid gap-3 md:hidden">
            {rows.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="block rounded-2xl border border-line bg-matte-2 p-4 active:bg-matte-3">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-xl font-bold">{o.number}</span>
                    <Pill tone={toneFor(o.status)}>{orderStatusLabel[o.status]}</Pill>
                  </span>
                  <span className="mt-2 flex items-end justify-between gap-3">
                    <span className="min-w-0 text-sm">
                      <span className="block truncate text-bone">{o.customerName}</span>
                      <span className="block text-ash">
                        {o.fulfilment === "pickup" ? "Pickup" : "Delivery"}, {formatWhen(o.createdAt)}
                      </span>
                    </span>
                    <span className="font-semibold text-brass-light">{formatPrice(o.total)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Tablet and up: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-matte-2 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-ash">
                <tr>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Fulfilment</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Placed</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((o) => (
                  <tr key={o.id} className="relative transition-colors hover:bg-matte-3">
                    <td className="px-5 py-3.5 font-semibold">
                      <Link href={`/admin/orders/${o.id}`} className="after:absolute after:inset-0">
                        {o.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">{o.customerName}</td>
                    <td className="px-5 py-3.5 text-bone/75">{o.fulfilment === "pickup" ? "Pickup" : "Delivery"}</td>
                    <td className="px-5 py-3.5">
                      <Pill tone={toneFor(o.status)}>{orderStatusLabel[o.status]}</Pill>
                    </td>
                    <td className="px-5 py-3.5 text-bone/75">{formatWhen(o.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold">{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
