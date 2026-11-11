"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sidebarCookie } from "../sidebar-state";
import { Icon, type IconName } from "./icons";

export type NavLink = { href: string; label: string; icon: IconName; badge?: number };

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5" aria-label="Golden Hour Admin home">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brass font-display text-lg font-black text-matte">GH</span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-lg font-bold">Golden Hour</span>
          <span className="block text-xs text-ash">Admin</span>
        </span>
      )}
    </Link>
  );
}

function NavItems({ links, path, compact, onNavigate }: { links: NavLink[]; path: string; compact?: boolean; onNavigate?: () => void }) {
  return (
    <ul className="grid gap-1">
      {links.map((l) => {
        const active = isActive(path, l.href);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={compact ? l.label : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                compact ? "justify-center px-0" : ""
              } ${active ? "bg-brass/15 text-brass-light" : "text-bone/75 hover:bg-matte-3 hover:text-bone"}`}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brass" aria-hidden />}
              <Icon name={l.icon} />
              {!compact && <span className="flex-1">{l.label}</span>}
              {!!l.badge &&
                (compact ? (
                  <span className="absolute right-2 top-1.5 size-2 rounded-full bg-lamp" aria-label={`${l.badge} new`} />
                ) : (
                  <span className="rounded-full bg-lamp px-1.5 text-xs font-bold text-matte">{l.badge}</span>
                ))}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserBox({ name, role, compact }: { name: string; role: string; compact?: boolean }) {
  return (
    <div className={`grid gap-1 border-t border-line pt-3 ${compact ? "justify-items-center" : ""}`}>
      {!compact && (
        <div className="px-3 pb-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs text-ash">{role}</p>
        </div>
      )}
      <form method="post" action="/admin/logout">
        <button
          title={compact ? "Sign out" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ash hover:bg-matte-3 hover:text-bone ${compact ? "justify-center px-0" : ""}`}
        >
          <Icon name="logout" />
          {!compact && "Sign out"}
        </button>
      </form>
    </div>
  );
}

export function AdminShell({
  links,
  user,
  initiallyCollapsed,
  children,
}: {
  links: NavLink[];
  user: { name: string; role: string };
  initiallyCollapsed: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [drawer, setDrawer] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const current = links.find((l) => isActive(path, l.href))?.label ?? "Admin";

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookie(next);
  }

  // Close the drawer on Escape; lock page scroll while it's open.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  return (
    <div className="min-h-svh bg-matte md:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-matte/90 px-4 backdrop-blur md:hidden">
        <button
          ref={menuButton}
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          aria-expanded={drawer}
          aria-controls="admin-drawer"
          className="-ml-2 grid size-10 place-items-center rounded-lg text-bone hover:bg-matte-3"
        >
          <Icon name="menu" />
        </button>
        <span className="flex-1 truncate font-semibold">{current}</span>
        <Brand compact />
      </header>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-40 md:hidden ${drawer ? "" : "pointer-events-none"}`} aria-hidden={!drawer}>
        <div onClick={() => setDrawer(false)} className={`absolute inset-0 bg-black/60 transition-opacity ${drawer ? "opacity-100" : "opacity-0"}`} />
        <aside
          id="admin-drawer"
          aria-label="Admin menu"
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 border-r border-line bg-matte-2 p-4 transition-transform motion-reduce:transition-none ${
            drawer ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <Brand />
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-lg hover:bg-matte-3">
              <Icon name="close" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto" aria-label="Admin">
            <NavItems links={links} path={path} onNavigate={() => setDrawer(false)} />
          </nav>
          <UserBox {...user} />
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-svh shrink-0 flex-col gap-6 border-r border-line bg-matte-2 p-3 transition-[width] duration-200 motion-reduce:transition-none md:flex ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-1"}`}>
          <Brand compact={collapsed} />
        </div>
        <nav className="flex-1 overflow-y-auto" aria-label="Admin">
          <NavItems links={links} path={path} compact={collapsed} />
        </nav>
        <UserBox {...user} compact={collapsed} />
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ash hover:bg-matte-3 hover:text-bone ${collapsed ? "justify-center px-0" : ""}`}
        >
          <Icon name={collapsed ? "expand" : "collapse"} />
          {!collapsed && "Collapse"}
        </button>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
