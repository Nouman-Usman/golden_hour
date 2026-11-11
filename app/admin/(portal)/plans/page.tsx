import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { planPeriod, plans, type Plan } from "../../../../db/schema.ts";
import { formatPrice, periodLabel } from "../../../lib/plans.ts";
import { requireStaffPage } from "../../guard.ts";
import { ActionForm } from "../action-form";
import { ConfirmButton } from "../confirm-button";
import { Field, input } from "../products/fields";
import { Icon } from "../icons";
import { Card, EmptyState, PageHeader, Pill } from "../ui";
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
          <select name="period" defaultValue={plan?.period ?? "month"} className={input}>
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
    <div className="max-w-3xl">
      <PageHeader title="Membership plans" description="Changes appear on the website's pricing section straight away." />
      <div className="grid gap-4">
        {list.length === 0 && (
          <EmptyState icon="plans" title="No plans yet">
            Add the first plan below and it shows up on the website.
          </EmptyState>
        )}
        <ol className="grid gap-3">
          {list.map((p, i) => (
            <li key={p.id} className={`rounded-2xl border bg-matte-2 ${p.highlighted ? "border-brass/60" : "border-line"}`}>
              <div className="flex items-center gap-3 p-4 md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    {p.highlighted && <Pill tone="active">Highlighted</Pill>}
                    {!p.visible && <Pill tone="muted">Hidden</Pill>}
                  </p>
                  <p className="mt-0.5 text-sm text-ash">
                    <span className="font-medium text-brass-light">{formatPrice(p.price)}</span> {periodLabel[p.period].toLowerCase()}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <ActionForm action={movePlanAction} submit="Up" variant="btn-outline" className="contents">
                    <input type="hidden" name="planId" value={p.id} />
                    <input type="hidden" name="direction" value="up" />
                  </ActionForm>
                  <ActionForm action={movePlanAction} submit="Down" variant="btn-outline" className="contents">
                    <input type="hidden" name="planId" value={p.id} />
                    <input type="hidden" name="direction" value="down" />
                  </ActionForm>
                </div>
              </div>
              <details className="group border-t border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-bone/80 hover:text-bone md:px-5">
                  Edit plan
                  <Icon name="chevron" width={16} height={16} className="transition-transform group-open:rotate-90" />
                </summary>
                <div className="grid gap-4 border-t border-line p-4 md:p-5">
                  <ActionForm action={savePlanAction} submit="Save plan">
                    <PlanFields plan={p} />
                  </ActionForm>
                  <div className="border-t border-line pt-4">
                    <ConfirmButton action={deletePlanAction} label="Delete plan" fields={{ planId: p.id }} />
                  </div>
                </div>
              </details>
              <span className="sr-only">Position {i + 1}</span>
            </li>
          ))}
        </ol>
        <Card title="Add a plan">
          <ActionForm action={savePlanAction} submit="Add plan">
            <PlanFields />
          </ActionForm>
        </Card>
      </div>
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
