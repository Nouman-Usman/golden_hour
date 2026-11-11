import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, like, max, ne, or, sql } from "drizzle-orm";
import type { Db } from "../../db/types.ts";
import { products, productVariants } from "../../db/schema.ts";
import { DomainError } from "./errors.ts";
import { isUuid } from "./idempotency.ts";
import { detectImageFormat, imageExt, imageMime } from "./image-format.ts";
import { MAX_IMAGE_BYTES, MAX_IMAGES, type ImageStore } from "./image-store.ts";
import { parseWholeNumber } from "./numbers.ts";
import { authorize, type StaffRecord } from "./permissions.ts";

export const PRODUCTS_TAG = "products";

const bad = (field: string, message: string): never => {
  throw new DomainError("invalid_input", message, { [field]: message });
};
const notFound = (): never => {
  throw new DomainError("not_found", "Product not found.");
};

function text(v: unknown, field: string, min: number, max: number, message: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min || s.length > max) bad(field, message);
  return s;
}

function productFields(input: { name: unknown; description: unknown; category: unknown }) {
  return {
    name: text(input.name, "name", 1, 80, "Enter a product name (up to 80 characters)."),
    description: text(input.description ?? "", "description", 0, 1000, "Keep the description under 1000 characters."),
    category: text(input.category, "category", 1, 40, "Enter a category (up to 40 characters)."),
  };
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

const SLUG_ATTEMPTS = 5;

export async function createProduct(
  db: Db,
  actor: StaffRecord,
  input: { name: unknown; description: unknown; category: unknown },
): Promise<string> {
  authorize(actor, "products.edit");
  const f = productFields(input);
  const base = slugify(f.name);

  // Start at the first free suffix, then retry only on a slug conflict (bounded).
  const taken = new Set(
    (
      await db
        .select({ slug: products.slug })
        .from(products)
        .where(or(eq(products.slug, base), like(products.slug, `${base}-%`)))
    ).map((r) => r.slug),
  );
  let n = 1;
  while (taken.has(n === 1 ? base : `${base}-${n}`)) n++;

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++, n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(products)
        .values({ slug, ...f })
        .onConflictDoNothing({ target: products.slug })
        .returning({ id: products.id });
      if (!row) return null;
      await tx.insert(productVariants).values({ productId: row.id, label: "", price: 0, stock: 0, position: 0 });
      return row.id;
    });
    if (id) return id;
  }
  return bad("name", "Choose a more distinctive name.");
}

export async function updateProduct(
  db: Db,
  actor: StaffRecord,
  input: { productId: string; name: unknown; description: unknown; category: unknown },
): Promise<void> {
  authorize(actor, "products.edit");
  if (!isUuid(input.productId)) notFound();
  const f = productFields(input);
  const done = await db
    .update(products)
    .set({ ...f, updatedAt: new Date() })
    .where(eq(products.id, input.productId))
    .returning({ id: products.id });
  if (!done.length) notFound();
}

export async function setProductArchived(
  db: Db,
  actor: StaffRecord,
  input: { productId: string; archived: boolean },
): Promise<void> {
  authorize(actor, "products.edit");
  if (!isUuid(input.productId)) notFound();
  const done = await db
    .update(products)
    .set({ archived: input.archived, updatedAt: new Date() })
    .where(eq(products.id, input.productId))
    .returning({ id: products.id });
  if (!done.length) notFound();
}

export async function upsertVariant(
  db: Db,
  actor: StaffRecord,
  input: { productId: string; variantId?: string; label: unknown; price: unknown },
): Promise<string> {
  authorize(actor, "products.edit");
  if (!isUuid(input.productId)) notFound();
  if (input.variantId !== undefined && !isUuid(input.variantId)) notFound();
  const label = text(input.label ?? "", "label", 0, 40, "Keep the option name under 40 characters.");
  const price = parseWholeNumber(input.price);
  if (price === null) return bad("price", "Enter a price in whole rupees.");

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, input.productId));
  if (!product) notFound();
  const clash = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, input.productId),
        eq(productVariants.label, label),
        input.variantId ? ne(productVariants.id, input.variantId) : undefined,
      ),
    );
  if (clash.length) bad("label", "That option already exists.");

  if (input.variantId) {
    const done = await db
      .update(productVariants)
      .set({ label, price, updatedAt: new Date() })
      .where(and(eq(productVariants.id, input.variantId), eq(productVariants.productId, input.productId)))
      .returning({ id: productVariants.id });
    if (!done.length) notFound();
    return input.variantId;
  }
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(${max(productVariants.position)}, -1) + 1` })
    .from(productVariants)
    .where(eq(productVariants.productId, input.productId));
  const [row] = await db
    .insert(productVariants)
    .values({ productId: input.productId, label, price, stock: 0, position: Number(next) })
    .returning({ id: productVariants.id });
  return row.id;
}

export async function setVariantArchived(
  db: Db,
  actor: StaffRecord,
  input: { variantId: string; archived: boolean },
): Promise<void> {
  authorize(actor, "products.edit");
  if (!isUuid(input.variantId)) notFound();
  const done = await db
    .update(productVariants)
    .set({ archived: input.archived, updatedAt: new Date() })
    .where(eq(productVariants.id, input.variantId))
    .returning({ id: productVariants.id });
  if (!done.length) notFound();
}

// Stock may be corrected on archived items too. Row-locked like every other stock change.
export async function setStock(db: Db, actor: StaffRecord, input: { variantId: string; stock: unknown }): Promise<void> {
  authorize(actor, "stock.adjust");
  if (!isUuid(input.variantId)) notFound();
  const stock = parseWholeNumber(input.stock);
  if (stock === null) bad("stock", "Enter a whole number, 0 or more.");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.id, input.variantId))
      .for("update");
    if (!row) notFound();
    await tx.update(productVariants).set({ stock: stock!, updatedAt: new Date() }).where(eq(productVariants.id, input.variantId));
  });
}

// Upload under a product-row lock (serializes concurrent uploads and enforces the 6-image limit),
// and remove the stored object if anything after the upload attempt fails.
export async function addProductImage(
  db: Db,
  store: ImageStore,
  actor: StaffRecord,
  input: { productId: string; bytes: Uint8Array },
): Promise<string> {
  authorize(actor, "products.edit");
  if (!isUuid(input.productId)) notFound();
  const format = detectImageFormat(input.bytes);
  if (!format) bad("file", "Use a JPEG, PNG or WebP image.");
  if (input.bytes.length > MAX_IMAGE_BYTES) bad("file", "Images must be 5 MB or smaller.");

  const path = `products/${input.productId}/${randomUUID()}.${imageExt[format!]}`;
  let attempted = false;
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ images: products.images })
        .from(products)
        .where(eq(products.id, input.productId))
        .for("update");
      if (!row) notFound();
      if (row.images.length >= MAX_IMAGES) bad("file", "A product can have up to 6 images.");
      attempted = true;
      await store.upload(path, input.bytes, imageMime[format!]);
      const url = store.publicUrl(path);
      await tx
        .update(products)
        .set({ images: sql`array_append(${products.images}, ${url})`, updatedAt: new Date() })
        .where(eq(products.id, input.productId));
      return url;
    });
  } catch (e) {
    if (attempted) {
      try {
        await store.remove(path);
      } catch (removeError) {
        console.error("orphan image", path, removeError);
      }
    }
    throw e;
  }
}

export async function removeProductImage(
  db: Db,
  store: ImageStore,
  actor: StaffRecord,
  input: { productId: string; url: string },
): Promise<{ storageCleaned: boolean }> {
  authorize(actor, "products.edit");
  if (!isUuid(input.productId)) notFound();
  const path = store.pathFromUrl(input.url);
  const notMine = () => bad("url", "That image doesn't belong to this product.");
  if (!path || !path.startsWith(`products/${input.productId}/`)) notMine();

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ images: products.images })
      .from(products)
      .where(eq(products.id, input.productId))
      .for("update");
    if (!row) notFound();
    if (!row.images.includes(input.url)) notMine();
    await tx
      .update(products)
      .set({ images: sql`array_remove(${products.images}, ${input.url})`, updatedAt: new Date() })
      .where(eq(products.id, input.productId));
  });

  try {
    await store.remove(path!);
    return { storageCleaned: true };
  } catch (e) {
    console.error("image delete failed; sweep will retry", path, e);
    return { storageCleaned: false };
  }
}

const SWEEP_MIN_AGE_MS = 60 * 60 * 1000;

// Deletes stored objects no product references, skipping anything under an hour old (uploads in flight).
export async function sweepOrphanImages(db: Db, store: ImageStore): Promise<{ removed: string[]; failed: string[] }> {
  const referenced = new Set((await db.select({ images: products.images }).from(products)).flatMap((r) => r.images));
  const cutoff = Date.now() - SWEEP_MIN_AGE_MS;
  const removed: string[] = [];
  const failed: string[] = [];
  for (const o of await store.list("products/")) {
    if (o.createdAt.getTime() > cutoff || referenced.has(store.publicUrl(o.path))) continue;
    try {
      await store.remove(o.path);
      removed.push(o.path);
    } catch {
      failed.push(o.path);
    }
  }
  return { removed, failed };
}

const variantCols = {
  id: productVariants.id,
  productId: productVariants.productId,
  label: productVariants.label,
  price: productVariants.price,
  stock: productVariants.stock,
  archived: productVariants.archived,
  position: productVariants.position,
};

export async function listProductsAdmin(db: Db, o: { includeArchived?: boolean } = {}) {
  const rows = await db
    .select()
    .from(products)
    .where(o.includeArchived ? undefined : eq(products.archived, false))
    .orderBy(asc(products.archived), asc(products.position), asc(products.name));
  const variants = rows.length
    ? await db
        .select(variantCols)
        .from(productVariants)
        .where(inArray(productVariants.productId, rows.map((r) => r.id)))
        .orderBy(asc(productVariants.position), asc(productVariants.createdAt))
    : [];
  return rows.map((p) => ({ ...p, variants: variants.filter((v) => v.productId === p.id) }));
}

export async function getProductAdmin(db: Db, id: string) {
  if (!isUuid(id)) return null;
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) return null;
  const variants = await db
    .select(variantCols)
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(asc(productVariants.position), asc(productVariants.createdAt));
  return { ...p, variants };
}

export type ProductAdmin = NonNullable<Awaited<ReturnType<typeof getProductAdmin>>>;
