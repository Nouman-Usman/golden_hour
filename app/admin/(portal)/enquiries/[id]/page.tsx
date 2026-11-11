import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "../../../../../db/index.ts";
import { getEnquiryDetail } from "../../../../lib/admin-queries.ts";
import { nextEnquiryStatuses } from "../../../../lib/enquiries.ts";
import { enquiryStatusLabel, formatWhen, whatsappDigits } from "../../../format.ts";
import { requireStaffPage } from "../../../guard.ts";
import { Icon } from "../../icons";
import { NotesForm } from "../../notes-form";
import { Card, PageHeader, Pill, toneFor } from "../../ui";
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
    <div>
      <PageHeader
        back={{ href: "/admin/enquiries", label: "Enquiries" }}
        title={e.name}
        description={<>Sent {formatWhen(e.createdAt)}</>}
        actions={<Pill tone={toneFor(e.status)}>{enquiryStatusLabel[e.status]}</Pill>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid gap-4">
          <Card title="Enquiry">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-ash">Interested in</dt>
                <dd className="mt-0.5 font-medium">{e.program}</dd>
              </div>
              {e.message && (
                <div>
                  <dt className="text-ash">Message</dt>
                  <dd className="mt-1 whitespace-pre-line rounded-lg bg-matte p-3 text-bone/90">{e.message}</dd>
                </div>
              )}
            </dl>
          </Card>
          <Card title="Update status">
            {options.length ? (
              <StatusButtons action={changeStatus} idName="enquiryId" id={e.id} options={options} danger={["not_interested"]} />
            ) : (
              <p className="text-sm text-bone/70">Marked {enquiryStatusLabel[e.status].toLowerCase()}. No further changes.</p>
            )}
          </Card>
          <Card title="Notes">
            <NotesForm action={saveNotes} idName="enquiryId" id={e.id} notes={e.notes} />
          </Card>
        </div>
        <div className="grid gap-4">
          <Card title="Contact">
            <p className="text-sm text-bone/75">{e.phone}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${e.phone}`} className="btn btn-sm btn-outline gap-2">
                <Icon name="phone" width={16} height={16} />
                Call
              </a>
              <a href={`https://wa.me/${whatsappDigits(e.phone)}`} className="btn btn-sm btn-outline gap-2">
                <Icon name="chat" width={16} height={16} />
                WhatsApp
              </a>
            </div>
          </Card>
          <Card title="History">
            <ol className="relative grid gap-4 border-l border-line pl-4">
              {e.events.map((ev, n) => (
                <li key={n} className="relative text-sm">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-brass" aria-hidden />
                  <span className="block font-medium">{enquiryStatusLabel[ev.toStatus as keyof typeof enquiryStatusLabel]}</span>
                  <span className="block text-ash">
                    {ev.staffName}, {formatWhen(ev.createdAt)}
                  </span>
                  {ev.note && <span className="mt-1 block text-bone/80">“{ev.note}”</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
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
