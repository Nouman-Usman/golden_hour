import Link from "next/link";
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

type Params = Promise<{ id: string }>;

async function Product({ params }: { params: Params }) {
  const staff = await requireStaffPage();
  const canEdit = can(staff.role, "products.edit");
  const { id } = await params;
  const p = db ? await getProductAdmin(db, id) : null;
  if (!p) notFound();

  return (
    <div className="grid max-w-2xl gap-10">
      <div>
        <Link href="/admin/products" className="text-sm text-ash hover:text-bone">
          ← Products
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold">{p.name}</h1>
        <p className="mt-1 text-bone/75">
          {p.category}
          {p.archived && " · Archived (hidden from the shop)"}
        </p>
      </div>

      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-bold">Options, prices and stock</h2>
        <ul className="grid gap-4">
          {p.variants.map((v) => (
            <li key={v.id} className={`grid gap-3 rounded-xl border border-ash/30 p-4 ${v.archived ? "opacity-60" : ""}`}>
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
                <p>
                  {v.label || "Standard"} · {formatPrice(v.price)}
                </p>
              )}
              <div className="flex flex-wrap items-end justify-between gap-3">
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
          <ActionForm action={upsertVariantAction} submit="Add option" className="grid gap-3 rounded-xl border border-dashed border-ash/40 p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <input type="hidden" name="productId" value={p.id} />
            <Field label="New option (e.g. Chocolate 2 kg)">
              <input name="label" required maxLength={40} className={input} />
            </Field>
            <Field label="Price (Rs)">
              <input name="price" type="number" inputMode="numeric" min={0} step={1} required className={input} />
            </Field>
          </ActionForm>
        )}
      </section>

      {canEdit && (
        <>
          <section className="grid gap-4">
            <h2 className="font-display text-2xl font-bold">Images</h2>
            {p.images.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {p.images.map((url) => (
                  <li key={url} className="grid gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a user upload */}
                    <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    <ActionForm action={removeImageAction} submit="Remove" variant="btn-outline" className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="url" value={url} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <ImageUploader productId={p.id} full={p.images.length >= MAX_IMAGES} />
          </section>

          <section className="grid gap-4">
            <h2 className="font-display text-2xl font-bold">Details</h2>
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
          </section>

          <ActionForm
            action={setProductArchivedAction}
            submit={p.archived ? "Restore to shop" : "Archive product"}
            variant="btn-outline"
            className="flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="productId" value={p.id} />
            <input type="hidden" name="archived" value={String(!p.archived)} />
            <p className="w-full text-sm text-ash">Archiving hides it from the shop. Past orders keep their details.</p>
          </ActionForm>
        </>
      )}
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
