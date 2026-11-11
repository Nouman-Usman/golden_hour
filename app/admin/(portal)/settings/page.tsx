import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { getSettings } from "../../../lib/settings.ts";
import { requireStaffPage } from "../../guard.ts";
import { ActionForm } from "../action-form";
import { Field, input } from "../products/fields";
import { saveShopSettings } from "./actions";

async function Settings() {
  await requireStaffPage("shop.settings");
  const s = db ? await getSettings(db) : null;
  if (!s) return <p className="text-lamp">Database isn&apos;t configured.</p>;

  return (
    <div className="grid max-w-md gap-8">
      <h1 className="font-display text-4xl font-bold uppercase">Shop settings</h1>
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
            className={input}
          />
        </Field>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="shopOpen" defaultChecked={s.shopOpen} className="size-5 accent-brass" />
          <span>Shop is open</span>
        </label>
        <p className="text-sm text-ash">
          Closing the shop keeps products visible but stops new orders. Pickup at the gym is always free.
        </p>
      </ActionForm>
      <p className="text-sm text-ash">Contact details and website text are edited in a later update.</p>
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
