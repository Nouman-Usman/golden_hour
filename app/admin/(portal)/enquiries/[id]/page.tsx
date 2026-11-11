import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "../../../../../db/index.ts";
import { getEnquiryDetail } from "../../../../lib/admin-queries.ts";
import { nextEnquiryStatuses } from "../../../../lib/enquiries.ts";
import { enquiryStatusLabel, formatWhen, whatsappDigits } from "../../../format.ts";
import { requireStaffPage } from "../../../guard.ts";
import { NotesForm } from "../../notes-form";
import { StatusButtons } from "../../status-buttons";
import { changeStatus, saveNotes } from "../actions";

type Params = Promise<{ id: string }>;

async function Enquiry({ params }: { params: Params }) {
  await requireStaffPage("enquiries.manage");
  const { id } = await params;
  const e = db ? await getEnquiryDetail(db, id) : null;
  if (!e) notFound();
  const options = nextEnquiryStatuses[e.status].map((s) => ({ value: s, label: enquiryStatusLabel[s] }));

  return (
    <div className="grid max-w-2xl gap-8">
      <div>
        <Link href="/admin/enquiries" className="text-sm text-ash hover:text-bone">
          ← Enquiries
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold">{e.name}</h1>
        <p className={`mt-1 ${e.status === "new" ? "text-lamp" : "text-bone/75"}`}>
          {enquiryStatusLabel[e.status]} · sent {formatWhen(e.createdAt)}
        </p>
      </div>

      <section className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${e.phone}`} className="btn btn-sm btn-outline">
            Call {e.phone}
          </a>
          <a href={`https://wa.me/${whatsappDigits(e.phone)}`} className="btn btn-sm btn-outline">
            WhatsApp
          </a>
        </div>
        <p>
          <span className="text-ash">Interested in </span>
          {e.program}
        </p>
        {e.message && <p className="whitespace-pre-line rounded-lg border border-ash/30 p-4 text-bone/85">{e.message}</p>}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-bold">Update status</h2>
        {options.length ? (
          <StatusButtons action={changeStatus} idName="enquiryId" id={e.id} options={options} danger={["not_interested"]} />
        ) : (
          <p className="text-bone/70">Marked {enquiryStatusLabel[e.status].toLowerCase()}. No further changes.</p>
        )}
      </section>

      <NotesForm action={saveNotes} idName="enquiryId" id={e.id} notes={e.notes} />

      <section>
        <h2 className="font-display text-2xl font-bold">History</h2>
        <ol className="mt-3 grid gap-2">
          {e.events.map((ev, n) => (
            <li key={n} className="text-bone/80">
              <span className="text-bone">{enquiryStatusLabel[ev.toStatus as keyof typeof enquiryStatusLabel]}</span> by{" "}
              {ev.staffName} · {formatWhen(ev.createdAt)}
              {ev.note && <span className="block text-sm text-ash">“{ev.note}”</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function EnquiryPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Enquiry params={params} />
    </Suspense>
  );
}
