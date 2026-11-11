import Link from "next/link";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { LOW_STOCK_THRESHOLD } from "../../../lib/admin-queries.ts";
import { can } from "../../../lib/permissions.ts";
import { formatPrice } from "../../../lib/plans.ts";
import { listProductsAdmin } from "../../../lib/products.ts";
import { requireStaffPage } from "../../guard.ts";
import { StockForm } from "./stock-form";

type Search = Promise<{ archived?: string }>;

async function Products({ searchParams }: { searchParams: Search }) {
  const staff = await requireStaffPage();
  const canEdit = can(staff.role, "products.edit");
  const showArchived = canEdit && (await searchParams).archived === "1";
  const list = db ? await listProductsAdmin(db, { includeArchived: showArchived }) : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-bold uppercase">Products</h1>
        {canEdit && (
          <div className="flex gap-2">
            <Link href={showArchived ? "/admin/products" : "/admin/products?archived=1"} className="btn btn-sm btn-outline">
              {showArchived ? "Hide archived" : "Show archived"}
            </Link>
            <Link href="/admin/products/new" className="btn btn-sm btn-brass">
              New product
            </Link>
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-bone/70">{canEdit ? "No products yet. Add your first one with New product." : "No products yet."}</p>
      ) : (
        <ul className="grid gap-4">
          {list.map((p) => (
            <li key={p.id} className={`rounded-2xl border border-ash/30 p-4 ${p.archived ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/admin/products/${p.id}`} className="font-display text-2xl font-bold hover:text-brass-light">
                  {p.name}
                </Link>
                <span className="text-sm text-ash">
                  {p.category}
                  {p.archived && " · Archived"}
                </span>
              </div>
              <ul className="mt-3 grid gap-3">
                {p.variants
                  .filter((v) => showArchived || !v.archived)
                  .map((v) => (
                    <li key={v.id} className="flex flex-wrap items-end justify-between gap-3 border-t border-ash/20 pt-3">
                      <span>
                        {v.label || "Standard"} · {formatPrice(v.price)}
                        {v.stock <= LOW_STOCK_THRESHOLD && <span className="ml-2 text-sm text-lamp">Low stock</span>}
                        {v.archived && <span className="ml-2 text-sm text-ash">Hidden</span>}
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
