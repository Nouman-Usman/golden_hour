import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { enquiryStatus, type EnquiryStatus } from "../../../../db/schema.ts";
import { listEnquiries } from "../../../lib/admin-queries.ts";
import { AutoRefresh } from "../../auto-refresh";
import { enquiryStatusLabel, formatWhen } from "../../format.ts";
import { requireStaffPage } from "../../guard.ts";

type Search = Promise<{ status?: string }>;

async function Enquiries({ searchParams }: { searchParams: Search }) {
  await requireStaffPage("enquiries.manage");
  const { status: raw } = await searchParams;
  const status = (enquiryStatus.enumValues as readonly string[]).includes(raw ?? "") ? (raw as EnquiryStatus) : undefined;
  const rows = db ? await listEnquiries(db, { status }) : [];
  const chips: { value?: EnquiryStatus; label: string }[] = [
    { label: "All" },
    ...enquiryStatus.enumValues.map((v) => ({ value: v, label: enquiryStatusLabel[v] })),
  ];

  return (
    <div className="grid gap-6">
      <AutoRefresh />
      <h1 className="font-display text-4xl font-bold uppercase">Enquiries</h1>
      <nav aria-label="Filter by status" className="flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.value ? `/admin/enquiries?status=${c.value}` : "/admin/enquiries"}
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
        <p className="text-bone/70">No enquiries here yet. Join-form submissions from the website appear here automatically.</p>
      ) : (
        <ul className="divide-y divide-ash/20 border-y border-ash/20">
          {rows.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/enquiries/${e.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-4 hover:text-brass-light">
                <span className="font-display text-xl font-bold">{e.name}</span>
                <span className={`text-right text-sm ${e.status === "new" ? "text-lamp" : "text-ash"}`}>
                  {enquiryStatusLabel[e.status]}
                </span>
                <span className="text-sm text-bone/75">{e.program}</span>
                <span className="text-right text-sm text-ash">{formatWhen(e.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function EnquiriesPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Enquiries searchParams={searchParams} />
    </Suspense>
  );
}
