import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "../../../../../db/index.ts";
import { getOrderDetail } from "../../../../lib/admin-queries.ts";
import { nextStatuses } from "../../../../lib/orders.ts";
import { formatPrice } from "../../../../lib/plans.ts";
import { formatWhen, orderStatusLabel, whatsappDigits } from "../../../format.ts";
import { requireStaffPage } from "../../../guard.ts";
import { Icon } from "../../icons";
import { NotesForm } from "../../notes-form";
import { Card, PageHeader, Pill, toneFor } from "../../ui";
import { StatusButtons } from "../../status-buttons";
import { changeStatus, saveNotes } from "../actions";

type Params = Promise<{ id: string }>;

async function Order({ params }: { params: Params }) {
  await requireStaffPage("orders.manage");
  const { id } = await params;
  const o = db ? await getOrderDetail(db, id) : null;
  if (!o) notFound();

  const options = nextStatuses[o.status]
    .filter((s) => !(s === "ready_for_pickup" && o.fulfilment === "delivery"))
    .filter((s) => !(s === "out_for_delivery" && o.fulfilment === "pickup"))
    .map((s) => ({ value: s, label: s === "cancelled" ? "Cancel order" : orderStatusLabel[s] }));

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={o.number}
        description={<>Placed {formatWhen(o.createdAt)}</>}
        actions={<Pill tone={toneFor(o.status)}>{orderStatusLabel[o.status]}</Pill>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid gap-4">
          <Card title="Items">
            <ul className="-mx-4 divide-y divide-line border-y border-line md:-mx-5">
              {o.items.map((i, n) => (
                <li key={n} className="flex items-start justify-between gap-4 px-4 py-3 md:px-5">
                  <span className="min-w-0">
                    <span className="block font-medium">{i.productName}</span>
                    <span className="block text-sm text-ash">
                      {i.variantLabel ? `${i.variantLabel}, ` : ""}
                      {i.quantity} × {formatPrice(i.unitPrice)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatPrice(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
              <dt className="text-ash">Subtotal</dt>
              <dd className="text-right">{formatPrice(o.subtotal)}</dd>
              <dt className="text-ash">Delivery</dt>
              <dd className="text-right">{formatPrice(o.deliveryFee)}</dd>
              <dt className="pt-2 font-semibold">Total to collect in cash</dt>
              <dd className="pt-2 text-right font-display text-2xl font-bold text-brass-light">{formatPrice(o.total)}</dd>
            </dl>
          </Card>

          <Card title="Update status">
            {options.length ? (
              <StatusButtons action={changeStatus} idName="orderId" id={o.id} options={options} danger={["cancelled"]} />
            ) : (
              <p className="text-sm text-bone/70">This order is {orderStatusLabel[o.status].toLowerCase()}. No further changes.</p>
            )}
          </Card>

          <Card title="Notes">
            <NotesForm action={saveNotes} idName="orderId" id={o.id} notes={o.notes} />
          </Card>
        </div>

        <div className="grid gap-4">
          <Card title="Customer">
            <p className="font-semibold">{o.customerName}</p>
            <p className="mt-0.5 text-sm text-bone/75">{o.customerPhone}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${o.customerPhone}`} className="btn btn-sm btn-outline gap-2">
                <Icon name="phone" width={16} height={16} />
                Call
              </a>
              <a href={`https://wa.me/${whatsappDigits(o.customerPhone)}`} className="btn btn-sm btn-outline gap-2">
                <Icon name="chat" width={16} height={16} />
                WhatsApp
              </a>
            </div>
            <div className="mt-4 border-t border-line pt-4 text-sm">
              <p className="text-ash">{o.fulfilment === "pickup" ? "Pickup" : "Delivery"}</p>
              <p className="mt-0.5 whitespace-pre-line">{o.fulfilment === "pickup" ? "Collects at the gym" : o.address}</p>
            </div>
          </Card>

          <Card title="History">
            <ol className="relative grid gap-4 border-l border-line pl-4">
              {o.events.map((e, n) => (
                <li key={n} className="relative text-sm">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-brass" aria-hidden />
                  <span className="block font-medium">{orderStatusLabel[e.toStatus as keyof typeof orderStatusLabel]}</span>
                  <span className="block text-ash">
                    {e.staffName}, {formatWhen(e.createdAt)}
                  </span>
                  {e.note && <span className="mt-1 block text-bone/80">“{e.note}”</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Order params={params} />
    </Suspense>
  );
}
