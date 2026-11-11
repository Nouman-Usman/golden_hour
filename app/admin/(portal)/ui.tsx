// Shared admin building blocks: page header, cards, status pills, empty states.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 grid gap-3 md:mb-8">
      {back && (
        <Link href={back.href} className="inline-flex w-fit items-center gap-1.5 text-sm text-ash hover:text-bone">
          <Icon name="back" width={16} height={16} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-bone/70 md:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({ title, description, children, className = "" }: { title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-matte-2 p-4 md:p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-base font-semibold text-bone">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ash">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

const tones = {
  new: "bg-lamp/15 text-lamp ring-lamp/30",
  active: "bg-brass/15 text-brass-light ring-brass/30",
  done: "bg-ok/15 text-ok ring-ok/30",
  muted: "bg-ash/15 text-bone/60 ring-ash/30",
  danger: "bg-danger/15 text-danger ring-danger/30",
} as const;
export type Tone = keyof typeof tones;

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  new: "new",
  confirmed: "active",
  ready_for_pickup: "active",
  out_for_delivery: "active",
  contacted: "active",
  completed: "done",
  joined: "done",
  cancelled: "muted",
  not_interested: "muted",
};
export const toneFor = (status: string): Tone => statusTone[status] ?? "muted";

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-matte-3 text-brass-light">
        <Icon name={icon} />
      </span>
      <p className="font-semibold text-bone">{title}</p>
      {children && <p className="max-w-sm text-sm text-ash">{children}</p>}
    </div>
  );
}

// Filter chips that scroll sideways on phones.
export function Chips({ items }: { items: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label="Filter" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          aria-current={c.active ? "page" : undefined}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
            c.active ? "border-brass bg-brass text-matte" : "border-line text-bone/80 hover:border-ash hover:text-bone"
          }`}
        >
          {c.label}
          {!!c.count && <span className={`text-xs ${c.active ? "text-matte/70" : "text-ash"}`}>{c.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
