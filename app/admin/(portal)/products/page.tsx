import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { LOW_STOCK_THRESHOLD } from "../../../lib/admin-queries.ts";
import { can } from "../../../lib/permissions.ts";
import { formatPrice } from "../../../lib/plans.ts";
import { listProductsAdmin } from "../../../lib/products.ts";
import { requireStaffPage } from "../../guard.ts";
import { Icon } from "../icons";
import { EmptyState, PageHeader, Pill } from "../ui";
import { StockForm } from "./stock-form";

type Search = Promise<{ archived?: string }>;

async function Products({ searchParams }: { searchParams: Search }) {
  const staff = await requireStaffPage();
  const canEdit = can(staff.role, "products.edit");
  const showArchived = canEdit && (await searchParams).archived === "1";
  const list = db ? await listProductsAdmin(db, { includeArchived: showArchived }) : [];

  return (
    <div>
      <PageHeader
        title="Products"
        description="What the shop sells. Update stock here as deliveries arrive."
        actions={
          canEdit && (
            <>
              <Link href={showArchived ? "/admin/products" : "/admin/products?archived=1"} className="btn btn-sm btn-outline">
                {showArchived ? "Hide archived" : "Show archived"}
              </Link>
              <Link href="/admin/products/new" className="btn btn-sm btn-brass gap-1.5">
                <Icon name="plus" width={16} height={16} />
                New product
              </Link>
            </>
          )
        }
      />
      {list.length === 0 ? (
        <EmptyState icon="products" title="No products yet">
          {canEdit ? "Add your first product to start selling in the shop." : "The owner hasn't added any products yet."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {list.map((p) => (
            <li key={p.id} className={`rounded-2xl border border-line bg-matte-2 ${p.archived ? "opacity-60" : ""}`}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-matte-3 md:rounded-t-2xl md:px-5">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a user upload
                  <img src={p.images[0]} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-matte-3 text-ash">
                    <Icon name="products" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-sm text-ash">{p.category}</span>
                </span>
                {p.archived && <Pill tone="muted">Archived</Pill>}
                <Icon name="chevron" className="shrink-0 text-ash" />
              </Link>
              <ul className="divide-y divide-line border-t border-line">
                {p.variants
                  .filter((v) => showArchived || !v.archived)
                  .map((v) => (
                    <li key={v.id} className="flex flex-wrap items-end justify-between gap-3 px-4 py-3 md:px-5">
                      <span className="grid gap-1 text-sm">
                        <span className="font-medium">{v.label || "Standard"}</span>
                        <span className="flex flex-wrap items-center gap-2 text-ash">
                          {formatPrice(v.price)}
                          {v.stock === 0 ? (
                            <Pill tone="danger">Sold out</Pill>
                          ) : (
                            v.stock <= LOW_STOCK_THRESHOLD && <Pill tone="new">Low stock</Pill>
                          )}
                          {v.archived && <Pill tone="muted">Hidden</Pill>}
                        </span>
                      </span>
                      <StockForm productId={p.id} variantId={v.id} stock={v.stock} />
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Products searchParams={searchParams} />
    </Suspense>
  );
}
