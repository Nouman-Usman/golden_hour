"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../../../../db/index.ts";
import { DomainError } from "../../../lib/errors.ts";
import {
  createProduct,
  PRODUCTS_TAG,
  removeProductImage,
  setProductArchived,
  setStock,
  setVariantArchived,
  updateProduct,
  upsertVariant,
} from "../../../lib/products.ts";
import { supabaseImageStore } from "../../../lib/supabase-image-store.ts";
import { toActionError, type ActionResult } from "../../action-error.ts";
import { requireStaffAction } from "../../guard.ts";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");

function need() {
  if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
  return db;
}

function changed(productId?: string) {
  updateTag(PRODUCTS_TAG);
  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
}

async function run(productId: string | undefined, fn: () => Promise<unknown>, message: string): Promise<ActionResult> {
  try {
    await fn();
    changed(productId);
    return { ok: true, message };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createProductAction(_p: ActionResult | null, f: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const actor = await requireStaffAction("products.edit");
    id = await createProduct(need(), actor, { name: s(f, "name"), description: s(f, "description"), category: s(f, "category") });
    changed();
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/admin/products/${id}`);
}

export async function updateProductAction(_p: ActionResult | null, f: FormData) {
  const productId = s(f, "productId");
  return run(productId, async () => {
    const actor = await requireStaffAction("products.edit");
    await updateProduct(need(), actor, { productId, name: s(f, "name"), description: s(f, "description"), category: s(f, "category") });
  }, "Product saved.");
}

export async function setProductArchivedAction(_p: ActionResult | null, f: FormData) {
  const productId = s(f, "productId");
  const archived = s(f, "archived") === "true";
  return run(productId, async () => {
    const actor = await requireStaffAction("products.edit");
    await setProductArchived(need(), actor, { productId, archived });
  }, archived ? "Archived. It's hidden from the shop." : "Restored.");
}

export async function upsertVariantAction(_p: ActionResult | null, f: FormData) {
  const productId = s(f, "productId");
  return run(productId, async () => {
    const actor = await requireStaffAction("products.edit");
    await upsertVariant(need(), actor, {
      productId,
      variantId: s(f, "variantId") || undefined,
      label: s(f, "label"),
      price: s(f, "price"),
    });
  }, "Option saved.");
}

export async function setVariantArchivedAction(_p: ActionResult | null, f: FormData) {
  const productId = s(f, "productId");
  const archived = s(f, "archived") === "true";
  return run(productId, async () => {
    const actor = await requireStaffAction("products.edit");
    await setVariantArchived(need(), actor, { variantId: s(f, "variantId"), archived });
  }, archived ? "Option hidden." : "Option restored.");
}

export async function setStockAction(_p: ActionResult | null, f: FormData) {
  const productId = s(f, "productId");
  return run(productId, async () => {
    const actor = await requireStaffAction("stock.adjust");
    await setStock(need(), actor, { variantId: s(f, "variantId"), stock: s(f, "stock") });
  }, "Stock saved.");
}

export async function removeImageAction(_p: ActionResult | null, f: FormData): Promise<ActionResult> {
  const productId = s(f, "productId");
  try {
    const actor = await requireStaffAction("products.edit");
    const r = await removeProductImage(need(), supabaseImageStore, actor, { productId, url: s(f, "url") });
    changed(productId);
    return { ok: true, message: r.storageCleaned ? "Image removed." : "Image removed (file cleanup will retry later)." };
  } catch (e) {
    return toActionError(e);
  }
}
