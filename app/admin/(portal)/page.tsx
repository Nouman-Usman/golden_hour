import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../db/index.ts";
import { dashboardCounts, LOW_STOCK_THRESHOLD } from "../../lib/admin-queries.ts";
import { can } from "../../lib/permissions.ts";
import { AutoRefresh } from "../auto-refresh";
import { requireStaffPage } from "../guard.ts";
import { Icon, type IconName } from "./icons";
import { PushToggle } from "./push-toggle";
import { Card, PageHeader, Pill } from "./ui";

function Tile({ href, value, label, icon, hot }: { href?: string; value: number; label: string; icon: IconName; hot?: boolean }) {
  const body = (
    <>
      <span className="flex items-center justify-between text-sm text-bone/70">
        {label}
        <span className={`grid size-9 place-items-center rounded-lg ${hot ? "bg-lamp/15 text-lamp" : "bg-matte-3 text-ash"}`}>
          <Icon name={icon} width={18} height={18} />
        </span>
      </span>
      <span className={`mt-3 block font-display text-4xl font-bold md:text-5xl ${hot ? "text-lamp" : "text-bone"}`}>{value}</span>
    </>
  );
  const cls = "block rounded-2xl border border-line bg-matte-2 p-4 md:p-5";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-brass/60`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Karachi" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaffPage();
  const { denied } = await searchParams;
  const c = db ? await dashboardCounts(db) : { newOrders: 0, newEnquiries: 0, lowStock: [] };
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Karachi" }).format(new Date());

  return (
    <div className="grid gap-6">
      <AutoRefresh />
      <PageHeader title={`${greeting()}, ${staff.name.split(" ")[0]}`} description={today} />
      {denied && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <Icon name="alert" width={18} height={18} />
          You don&apos;t have access to that page.
        </p>
      )}
      <PushToggle banner />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Tile
          href={can(staff.role, "orders.manage") ? "/admin/orders?status=new" : undefined}
          value={c.newOrders}
          label="New orders"
          icon="orders"
          hot={c.newOrders > 0}
        />
        <Tile
          href={can(staff.role, "enquiries.manage") ? "/admin/enquiries?status=new" : undefined}
          value={c.newEnquiries}
          label="New enquiries"
          icon="enquiries"
          hot={c.newEnquiries > 0}
        />
        <div className="col-span-2 md:col-span-1">
          <Tile href="/admin/products" value={c.lowStock.length} label="Low on stock" icon="products" />
        </div>
      </div>
      <Card title="Low stock" description={`Options with ${LOW_STOCK_THRESHOLD} or fewer left.`}>
        {c.lowStock.length === 0 ? (
<p className="text-sm text-bone/70">Nothing is running low right now.</p>
        ) : (
          <ul className="-mx-4 divide-y divide-line md:-mx-5">
            {c.lowStock.map((r) => (
              <li key={r.variantId}>
                <Link
                  href={`/admin/products/${r.productId}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-matte-3 md:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.productName}</span>
                    {r.label && <span className="block text-sm text-ash">{r.label}</span>}
                  </span>
                  <Pill tone={r.stock === 0 ? "danger" : "new"}>{r.stock === 0 ? "Sold out" : `${r.stock} left`}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
