import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { enquiryStatus, type EnquiryStatus } from "../../../../db/schema.ts";
import { listEnquiries } from "../../../lib/admin-queries.ts";
import { AutoRefresh } from "../../auto-refresh";
import { enquiryStatusLabel, formatWhen } from "../../format.ts";
import { requireStaffPage } from "../../guard.ts";
import { Chips, EmptyState, PageHeader, Pill, toneFor } from "../ui";

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
    <div>
      <AutoRefresh />
      <PageHeader title="Enquiries" description="People who filled in the join form on the website." />
      <Chips
        items={chips.map((c) => ({
          href: c.value ? `/admin/enquiries?status=${c.value}` : "/admin/enquiries",
          label: c.label,
          active: c.value === status,
        }))}
      />
      {rows.length === 0 ? (
        <EmptyState icon="enquiries" title={status ? `No ${enquiryStatusLabel[status].toLowerCase()} enquiries` : "No enquiries yet"}>
          Join-form submissions from the website appear here automatically.
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {rows.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/enquiries/${e.id}`} className="block rounded-2xl border border-line bg-matte-2 p-4 active:bg-matte-3">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate font-semibold">{e.name}</span>
                    <Pill tone={toneFor(e.status)}>{enquiryStatusLabel[e.status]}</Pill>
                  </span>
                  <span className="mt-1 block text-sm text-ash">
                    {e.program}, {formatWhen(e.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-matte-2 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-ash">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Interested in</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id} className="relative transition-colors hover:bg-matte-3">
                    <td className="px-5 py-3.5 font-semibold">
                      <Link href={`/admin/enquiries/${e.id}`} className="after:absolute after:inset-0">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-bone/75">{e.program}</td>
                    <td className="px-5 py-3.5">
                      <Pill tone={toneFor(e.status)}>{enquiryStatusLabel[e.status]}</Pill>
                    </td>
                    <td className="px-5 py-3.5 text-right text-bone/75">{formatWhen(e.createdAt)}</td>
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

export default function EnquiriesPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Enquiries searchParams={searchParams} />
    </Suspense>
  );
}
