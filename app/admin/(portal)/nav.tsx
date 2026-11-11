"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; badge?: number };

export function Nav({ links }: { links: NavLink[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ash/30 bg-matte/95 backdrop-blur md:static md:w-56 md:shrink-0 md:border-r md:border-t-0 md:bg-transparent"
    >
      <ul className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:gap-0.5 md:overflow-visible md:px-3 md:py-6">
        {links.map((l) => (
          <li key={l.href} className="shrink-0">
            <Link
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm md:rounded-lg md:text-base ${
                active(l.href) ? "bg-brass text-matte" : "text-bone/80 hover:text-bone"
              }`}
            >
              {l.label}
              {!!l.badge && (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-xs font-bold ${
                    active(l.href) ? "bg-matte text-brass-light" : "bg-lamp text-matte"
                  }`}
                >
                  {l.badge}
                </span>
              )}
            </Link>
          </li>
        ))}
        <li className="shrink-0 md:mt-4">
          <form method="post" action="/admin/logout">
            <button className="rounded-full px-3 py-2 text-sm text-ash hover:text-bone md:text-base">Sign out</button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
