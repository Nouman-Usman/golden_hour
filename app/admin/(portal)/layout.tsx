import type { Metadata } from "next";
import { adminPwaMetadata, adminViewport } from "../pwa-metadata.ts";
import { Suspense, type ReactNode } from "react";
import { db } from "../../../db/index.ts";
import { adminTitle, dashboardCounts } from "../../lib/admin-queries.ts";
import { can } from "../../lib/permissions.ts";
import { requireStaffPage } from "../guard.ts";
import { cookies } from "next/headers";
import { SIDEBAR_COOKIE, sidebarCollapsed } from "../sidebar-state.ts";
import { AdminShell, type NavLink } from "./shell";

const counts = async () => (db ? dashboardCounts(db) : { newOrders: 0, newEnquiries: 0, lowStock: [] });

// Authorize before any count query; the title never leaks counts to unauthorized visitors.
export async function generateMetadata(): Promise<Metadata> {
  await requireStaffPage();
  return {
    ...adminPwaMetadata,
    title: adminTitle(await counts()),
    robots: { index: false, follow: false },
  };
}

export const viewport = adminViewport;

async function Shell({ children }: { children: ReactNode }) {
  const staff = await requireStaffPage();
  const c = await counts();
  const links: NavLink[] = [
    { href: "/admin", label: "Home", icon: "home" },
    ...(can(staff.role, "orders.manage") ? [{ href: "/admin/orders", label: "Orders", icon: "orders", badge: c.newOrders } as const] : []),
    ...(can(staff.role, "enquiries.manage") ? [{ href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", badge: c.newEnquiries } as const] : []),
    { href: "/admin/products", label: "Products", icon: "products" },
    ...(can(staff.role, "plans.edit") ? [{ href: "/admin/plans", label: "Plans", icon: "plans" } as const] : []),
    ...(can(staff.role, "shop.settings") ? [{ href: "/admin/settings", label: "Settings", icon: "settings" } as const] : []),
    ...(can(staff.role, "staff.manage") ? [{ href: "/admin/staff", label: "Staff", icon: "staff" } as const] : []),
    { href: "/admin/account", label: "Account", icon: "account" },
  ];
  const collapsed = sidebarCollapsed((await cookies()).get(SIDEBAR_COOKIE)?.value);
  return (
    <AdminShell
      links={links}
      user={{ name: staff.name, role: staff.role === "owner" ? "Owner" : "Front desk" }}
      initiallyCollapsed={collapsed}
    >
      {children}
    </AdminShell>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="grid min-h-svh place-items-center text-ash">Loading…</p>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
