import Link from "next/link";
import { Suspense } from "react";
import { requireStaffPage } from "../../../guard.ts";
import { ActionForm } from "../../action-form";
import { createProductAction } from "../actions";
import { Field, input } from "../fields";

async function NewProduct() {
  await requireStaffPage("products.edit");
  return (
    <div className="grid max-w-xl gap-6">
      <Link href="/admin/products" className="text-sm text-ash hover:text-bone">
        ← Products
      </Link>
      <h1 className="font-display text-4xl font-bold uppercase">New product</h1>
      <ActionForm action={createProductAction} submit="Create product" pendingLabel="Creating…">
        <Field label="Name">
          <input name="name" required maxLength={80} className={input} />
        </Field>
        <Field label="Category (e.g. Protein, Creatine, Pre-workout, Accessories)">
          <input name="category" required maxLength={40} className={input} />
        </Field>
        <Field label="Description (optional)">
          <textarea name="description" rows={4} maxLength={1000} className={input} />
        </Field>
        <p className="text-sm text-ash">You&apos;ll add prices, flavours or sizes, stock and images on the next screen.</p>
      </ActionForm>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <NewProduct />
    </Suspense>
  );
}
