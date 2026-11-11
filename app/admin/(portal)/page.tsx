import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../db/index.ts";
import { dashboardCounts } from "../../lib/admin-queries.ts";
import { can } from "../../lib/permissions.ts";
import { AutoRefresh } from "../auto-refresh";
import { requireStaffPage } from "../guard.ts";
import { PushToggle } from "./push-toggle";

function Tile({ href, value, label }: { href?: string; value: number | string; label: string }) {
  const body = (
    <>
      <span className="font-display text-5xl font-black text-brass-light">{value}</span>
      <span className="mt-1 block text-bone/75">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl border border-ash/30 p-5 hover:border-brass">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-ash/30 p-5">{body}</div>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaffPage();
  const { denied } = await searchParams;
  const c = db ? await dashboardCounts(db) : { newOrders: 0, newEnquiries: 0, lowStock: [] };

  return (
    <div className="grid gap-8">
      <AutoRefresh />
      <div>
        <h1 className="font-display text-4xl font-bold uppercase">Hello, {staff.name.split(" ")[0]}</h1>
        {denied && (
          <p role="alert" className="mt-3 text-lamp">
            You don&apos;t have access to that page.
          </p>
        )}
      </div>
      <PushToggle banner />
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          href={can(staff.role, "orders.manage") ? "/admin/orders?status=new" : undefined}
          value={c.newOrders}
          label="New orders"
        />
        <Tile
          href={can(staff.role, "enquiries.manage") ? "/admin/enquiries?status=new" : undefined}
          value={c.newEnquiries}
          label="New enquiries"
        />
        <Tile href="/admin/products" value={c.lowStock.length} label="Items low on stock" />
      </div>
      {c.lowStock.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-bold">Low stock</h2>
          <ul className="mt-3 divide-y divide-ash/20 border-y border-ash/20">
            {c.lowStock.map((r) => (
              <li key={r.variantId}>
                <Link href={`/admin/products/${r.productId}`} className="flex justify-between gap-4 py-3 hover:text-brass-light">
                  <span>
                    {r.productName}
                    {r.label && <span className="text-ash"> · {r.label}</span>}
                  </span>
                  <span className={r.stock === 0 ? "text-lamp" : "text-bone/75"}>{r.stock} left</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
