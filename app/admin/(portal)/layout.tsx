import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { db } from "../../../db/index.ts";
import { adminTitle, dashboardCounts } from "../../lib/admin-queries.ts";
import { can } from "../../lib/permissions.ts";
import { requireStaffPage } from "../guard.ts";
import { Nav, type NavLink } from "./nav";

const counts = async () => (db ? dashboardCounts(db) : { newOrders: 0, newEnquiries: 0, lowStock: [] });

// Authorize before any count query; the title never leaks counts to unauthorized visitors.
export async function generateMetadata(): Promise<Metadata> {
  await requireStaffPage();
  return {
    title: adminTitle(await counts()),
    robots: { index: false, follow: false },
  };
}

async function Shell({ children }: { children: ReactNode }) {
  const staff = await requireStaffPage();
  const c = await counts();
  const links: NavLink[] = [
    { href: "/admin", label: "Home" },
    ...(can(staff.role, "orders.manage") ? [{ href: "/admin/orders", label: "Orders", badge: c.newOrders }] : []),
    ...(can(staff.role, "enquiries.manage") ? [{ href: "/admin/enquiries", label: "Enquiries", badge: c.newEnquiries }] : []),
    { href: "/admin/products", label: "Products" },
    ...(can(staff.role, "plans.edit") ? [{ href: "/admin/plans", label: "Plans" }] : []),
    ...(can(staff.role, "shop.settings") ? [{ href: "/admin/settings", label: "Settings" }] : []),
    ...(can(staff.role, "staff.manage") ? [{ href: "/admin/staff", label: "Staff" }] : []),
    { href: "/admin/account", label: "Account" },
  ];
  return (
    <div className="min-h-svh md:flex">
      <Nav links={links} />
      <main className="flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-10">{children}</main>
    </div>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-ash">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
