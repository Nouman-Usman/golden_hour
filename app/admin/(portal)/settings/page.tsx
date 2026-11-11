import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { getSettings } from "../../../lib/settings.ts";
import { requireStaffPage } from "../../guard.ts";
import { ActionForm } from "../action-form";
import { Field, input } from "../products/fields";
import { Card, PageHeader } from "../ui";
import { saveShopSettings } from "./actions";

async function Settings() {
  await requireStaffPage("shop.settings");
  const s = db ? await getSettings(db) : null;
  if (!s) return <p className="text-danger">Database isn&apos;t configured.</p>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Shop settings" description="Delivery and ordering for the online shop." />
      <Card>
        <ActionForm action={saveShopSettings} submit="Save settings">
          <Field label="Delivery fee in Lahore (Rs, 0–5,000)">
            <input
              name="deliveryFee"
              type="number"
              inputMode="numeric"
              min={0}
              max={5000}
              step={1}
              defaultValue={s.deliveryFee}
              required
              className={`${input} max-w-48`}
            />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-line bg-matte p-4">
            <input type="checkbox" name="shopOpen" defaultChecked={s.shopOpen} className="mt-0.5 size-5 accent-brass" />
            <span>
              <span className="block font-medium">Shop is open</span>
              <span className="mt-0.5 block text-sm text-ash">
                Closing the shop keeps products visible but stops new orders. Pickup at the gym is always free.
              </span>
            </span>
          </label>
        </ActionForm>
      </Card>
      <p className="mt-4 text-sm text-ash">Contact details and website text are edited in a later update.</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Settings />
    </Suspense>
  );
}
