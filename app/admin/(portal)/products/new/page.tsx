import { Suspense } from "react";
import { requireStaffPage } from "../../../guard.ts";
import { ActionForm } from "../../action-form";
import { createProductAction } from "../actions";
import { Field, input } from "../fields";
import { Card, PageHeader } from "../../ui";

async function NewProduct() {
  await requireStaffPage("products.edit");
  return (
    <div className="max-w-2xl">
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title="New product"
        description="You'll add prices, flavours or sizes, stock and images on the next screen."
      />
      <Card>
        <ActionForm action={createProductAction} submit="Create product" pendingLabel="Creating…">
          <Field label="Name">
            <input name="name" required maxLength={80} className={input} />
          </Field>
          <Field label="Category">
            <input name="category" required maxLength={40} placeholder="Protein, Creatine, Accessories…" className={input} />
          </Field>
          <Field label="Description (optional)">
            <textarea name="description" rows={4} maxLength={1000} className={input} />
          </Field>
        </ActionForm>
      </Card>
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
