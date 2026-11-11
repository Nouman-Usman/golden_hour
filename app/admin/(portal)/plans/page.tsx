import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { planPeriod, plans, type Plan } from "../../../../db/schema.ts";
import { formatPrice, periodLabel } from "../../../lib/plans.ts";
import { requireStaffPage } from "../../guard.ts";
import { ActionForm } from "../action-form";
import { ConfirmButton } from "../confirm-button";
import { Field, input } from "../products/fields";
import { deletePlanAction, movePlanAction, savePlanAction } from "./actions";

function PlanFields({ plan }: { plan?: Plan }) {
  return (
    <>
      {plan && <input type="hidden" name="planId" value={plan.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_10rem]">
        <Field label="Name">
          <input name="name" defaultValue={plan?.name} required maxLength={40} className={input} />
        </Field>
        <Field label="Price (Rs)">
          <input name="price" type="number" inputMode="numeric" min={0} step={1} defaultValue={plan?.price} required className={input} />
        </Field>
        <Field label="Paid">
          <select name="period" defaultValue={plan?.period ?? "month"} className={`${input} bg-matte`}>
            {planPeriod.enumValues.map((p) => (
              <option key={p} value={p}>
                {periodLabel[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Short description (optional)">
        <input name="description" defaultValue={plan?.description ?? ""} maxLength={200} className={input} />
      </Field>
      <Field label="Features (one per line, up to 8)">
        <textarea name="features" rows={3} defaultValue={plan?.features.join("\n")} className={input} />
      </Field>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="highlighted" defaultChecked={plan?.highlighted} className="size-4 accent-brass" />
          Highlight on the website
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="visible" defaultChecked={plan?.visible ?? true} className="size-4 accent-brass" />
          Show on the website
        </label>
      </div>
    </>
  );
}

async function Plans() {
  await requireStaffPage("plans.edit");
  const list = db ? await db.select().from(plans).orderBy(asc(plans.position), asc(plans.name)) : [];

  return (
    <div className="grid max-w-3xl gap-8">
      <div>
        <h1 className="font-display text-4xl font-bold uppercase">Membership plans</h1>
        <p className="mt-2 text-bone/75">Changes appear on the website&apos;s pricing section straight away.</p>
      </div>
      <ol className="grid gap-4">
        {list.map((p, i) => (
          <li key={p.id} className={`grid gap-4 rounded-2xl border p-4 ${p.highlighted ? "border-brass" : "border-ash/30"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-2xl font-bold">
                {p.name} <span className="text-brass-light">{formatPrice(p.price)}</span>
                <span className="ml-2 text-sm font-normal text-ash">
                  {periodLabel[p.period]}
                  {!p.visible && " · Hidden"}
                </span>
              </p>
              <div className="flex gap-2">
                <ActionForm action={movePlanAction} submit="↑" variant="btn-outline" className="contents">
                  <input type="hidden" name="planId" value={p.id} />
                  <input type="hidden" name="direction" value="up" />
                </ActionForm>
                <ActionForm action={movePlanAction} submit="↓" variant="btn-outline" className="contents">
                  <input type="hidden" name="planId" value={p.id} />
                  <input type="hidden" name="direction" value="down" />
                </ActionForm>
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-brass-light">Edit</summary>
              <div className="mt-4 grid gap-4">
                <ActionForm action={savePlanAction} submit="Save plan">
                  <PlanFields plan={p} />
                </ActionForm>
                <ConfirmButton action={deletePlanAction} label="Delete plan" fields={{ planId: p.id }} />
              </div>
            </details>
            <span className="sr-only">Position {i + 1}</span>
          </li>
        ))}
      </ol>
      <section className="grid gap-4 rounded-2xl border border-dashed border-ash/40 p-4">
        <h2 className="font-display text-2xl font-bold">Add a plan</h2>
        <ActionForm action={savePlanAction} submit="Add plan">
          <PlanFields />
        </ActionForm>
      </section>
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Plans />
    </Suspense>
  );
}
