import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "../../../../../db/index.ts";
import { getOrderDetail } from "../../../../lib/admin-queries.ts";
import { nextStatuses } from "../../../../lib/orders.ts";
import { formatPrice } from "../../../../lib/plans.ts";
import { formatWhen, orderStatusLabel, whatsappDigits } from "../../../format.ts";
import { requireStaffPage } from "../../../guard.ts";
import { NotesForm } from "../../notes-form";
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
    <div className="grid max-w-2xl gap-8">
      <div>
        <Link href="/admin/orders" className="text-sm text-ash hover:text-bone">
          ← Orders
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold">{o.number}</h1>
        <p className={`mt-1 ${o.status === "new" ? "text-lamp" : "text-bone/75"}`}>
          {orderStatusLabel[o.status]} · placed {formatWhen(o.createdAt)}
        </p>
      </div>

      <section className="grid gap-2">
        <h2 className="font-display text-2xl font-bold">{o.customerName}</h2>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${o.customerPhone}`} className="btn btn-sm btn-outline">
            Call {o.customerPhone}
          </a>
          <a href={`https://wa.me/${whatsappDigits(o.customerPhone)}`} className="btn btn-sm btn-outline">
            WhatsApp
          </a>
        </div>
        <p className="text-bone/80">{o.fulfilment === "pickup" ? "Pickup at the gym" : `Delivery to: ${o.address}`}</p>
      </section>

      <section>
        <table className="w-full text-left">
          <thead className="text-sm text-ash">
            <tr>
              <th className="py-2 font-normal">Item</th>
              <th className="py-2 text-right font-normal">Qty</th>
              <th className="py-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ash/20 border-y border-ash/20">
            {o.items.map((i, n) => (
              <tr key={n}>
                <td className="py-3">
                  {i.productName}
                  {i.variantLabel && <span className="text-ash"> · {i.variantLabel}</span>}
                  <span className="block text-sm text-ash">{formatPrice(i.unitPrice)} each</span>
                </td>
                <td className="py-3 text-right">{i.quantity}</td>
                <td className="py-3 text-right">{formatPrice(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-1 text-right">
          <dt className="text-ash">Subtotal</dt>
          <dd>{formatPrice(o.subtotal)}</dd>
          <dt className="text-ash">Delivery</dt>
          <dd>{formatPrice(o.deliveryFee)}</dd>
          <dt className="font-bold">Total (cash)</dt>
          <dd className="font-display text-2xl font-bold text-brass-light">{formatPrice(o.total)}</dd>
        </dl>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-bold">Update status</h2>
        {options.length ? (
          <StatusButtons action={changeStatus} idName="orderId" id={o.id} options={options} danger={["cancelled"]} />
        ) : (
          <p className="text-bone/70">This order is {orderStatusLabel[o.status].toLowerCase()}. No further changes.</p>
        )}
      </section>

      <NotesForm action={saveNotes} idName="orderId" id={o.id} notes={o.notes} />

      <section>
        <h2 className="font-display text-2xl font-bold">History</h2>
        <ol className="mt-3 grid gap-2">
          {o.events.map((e, n) => (
            <li key={n} className="text-bone/80">
              <span className="text-bone">{orderStatusLabel[e.toStatus as keyof typeof orderStatusLabel]}</span> by {e.staffName} ·{" "}
              {formatWhen(e.createdAt)}
              {e.note && <span className="block text-sm text-ash">“{e.note}”</span>}
            </li>
          ))}
        </ol>
      </section>
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
