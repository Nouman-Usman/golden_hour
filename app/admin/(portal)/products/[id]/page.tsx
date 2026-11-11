import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "../../../../../db/index.ts";
import { MAX_IMAGES } from "../../../../lib/image-store.ts";
import { can } from "../../../../lib/permissions.ts";
import { formatPrice } from "../../../../lib/plans.ts";
import { getProductAdmin } from "../../../../lib/products.ts";
import { requireStaffPage } from "../../../guard.ts";
import { ActionForm } from "../../action-form";
import {
  removeImageAction,
  setProductArchivedAction,
  setVariantArchivedAction,
  updateProductAction,
  upsertVariantAction,
} from "../actions";
import { Field, input } from "../fields";
import { ImageUploader } from "../image-uploader";
import { StockForm } from "../stock-form";
import { Card, PageHeader, Pill } from "../../ui";

type Params = Promise<{ id: string }>;

async function Product({ params }: { params: Params }) {
  const staff = await requireStaffPage();
  const canEdit = can(staff.role, "products.edit");
  const { id } = await params;
  const p = db ? await getProductAdmin(db, id) : null;
  if (!p) notFound();

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={p.name}
        description={p.category}
        actions={p.archived && <Pill tone="muted">Archived, hidden from the shop</Pill>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid gap-4">
          <Card title="Options, prices and stock" description="Each flavour or size is an option with its own price and stock.">
            <ul className="grid gap-3">
              {p.variants.map((v) => (
                <li key={v.id} className={`grid gap-4 rounded-xl border border-line bg-matte p-4 ${v.archived ? "opacity-60" : ""}`}>
                  {canEdit ? (
                    <ActionForm action={upsertVariantAction} submit="Save option" variant="btn-outline" className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="variantId" value={v.id} />
                      <Field label="Option (blank = standard)">
                        <input name="label" defaultValue={v.label} maxLength={40} className={input} />
                      </Field>
                      <Field label="Price (Rs)">
                        <input name="price" type="number" inputMode="numeric" min={0} step={1} defaultValue={v.price} className={input} />
                      </Field>
                    </ActionForm>
                  ) : (
                    <p className="font-medium">
                      {v.label || "Standard"}, {formatPrice(v.price)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
                    <StockForm productId={p.id} variantId={v.id} stock={v.stock} />
                    {canEdit && (
                      <ActionForm action={setVariantArchivedAction} submit={v.archived ? "Show option" : "Hide option"} variant="btn-outline" className="flex items-center gap-3">
                        <input type="hidden" name="productId" value={p.id} />
                        <input type="hidden" name="variantId" value={v.id} />
                        <input type="hidden" name="archived" value={String(!v.archived)} />
                      </ActionForm>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {canEdit && (
              <ActionForm action={upsertVariantAction} submit="Add option" className="mt-3 grid gap-3 rounded-xl border border-dashed border-line p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                <input type="hidden" name="productId" value={p.id} />
                <Field label="New option">
                  <input name="label" required maxLength={40} placeholder="Chocolate 2 kg" className={input} />
                </Field>
                <Field label="Price (Rs)">
                  <input name="price" type="number" inputMode="numeric" min={0} step={1} required className={input} />
                </Field>
              </ActionForm>
            )}
          </Card>

          {canEdit && (
            <Card title="Details">
              <ActionForm action={updateProductAction} submit="Save details">
                <input type="hidden" name="productId" value={p.id} />
                <Field label="Name">
                  <input name="name" defaultValue={p.name} required maxLength={80} className={input} />
                </Field>
                <Field label="Category">
                  <input name="category" defaultValue={p.category} required maxLength={40} className={input} />
                </Field>
                <Field label="Description">
                  <textarea name="description" rows={4} defaultValue={p.description} maxLength={1000} className={input} />
                </Field>
              </ActionForm>
            </Card>
          )}
        </div>

        {canEdit && (
          <div className="grid gap-4">
            <Card title="Images" description={`Up to ${MAX_IMAGES} photos.`}>
              {p.images.length > 0 && (
                <ul className="mb-4 grid grid-cols-2 gap-3">
                  {p.images.map((url) => (
                    <li key={url} className="grid gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a user upload */}
                      <img src={url} alt="" className="aspect-square w-full rounded-lg border border-line object-cover" />
                      <ActionForm action={removeImageAction} submit="Remove" variant="btn-outline" className="flex items-center gap-2">
                        <input type="hidden" name="productId" value={p.id} />
                        <input type="hidden" name="url" value={url} />
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
              <ImageUploader productId={p.id} full={p.images.length >= MAX_IMAGES} />
            </Card>

            <Card title={p.archived ? "Restore product" : "Archive product"} description="Archiving hides it from the shop. Past orders keep their details.">
              <ActionForm
                action={setProductArchivedAction}
                submit={p.archived ? "Restore to shop" : "Archive product"}
                variant="btn-outline"
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="productId" value={p.id} />
                <input type="hidden" name="archived" value={String(!p.archived)} />
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Product params={params} />
    </Suspense>
  );
}
