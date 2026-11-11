import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createTestDb } from "./db.ts";
import { seedStaff } from "./fixtures.ts";
import { products, productVariants } from "../db/schema.ts";
import {
  addProductImage,
  createProduct,
  getProductAdmin,
  removeProductImage,
  setProductArchived,
  setStock,
  setVariantArchived,
  sweepOrphanImages,
  updateProduct,
  upsertVariant,
} from "../app/lib/products.ts";
import { detectImageFormat } from "../app/lib/image-format.ts";
import type { ImageStore } from "../app/lib/image-store.ts";
import type { Db } from "../db/types.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const HTML = new Uint8Array(Buffer.from("<html><script>alert(1)</script></html>"));
const SVG = new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

type Fail = Partial<Record<"upload" | "remove" | "list" | "publicUrl", boolean>>;
function fakeStore(fail: Fail = {}, objects: { path: string; createdAt: Date }[] = []) {
  const calls: string[] = [];
  const store: ImageStore = {
    async upload(path) {
      calls.push(`upload ${path}`);
      if (fail.upload) throw new Error("storage down");
      objects.push({ path, createdAt: new Date() });
    },
    async remove(path) {
      calls.push(`remove ${path}`);
      if (fail.remove) throw new Error("storage down");
    },
    async list() {
      if (fail.list) throw new Error("storage down");
      return objects;
    },
    publicUrl(path) {
      if (fail.publicUrl) throw new Error("db write failed");
      return `https://img.test/${path}`;
    },
    pathFromUrl: (url) => (url.startsWith("https://img.test/") ? url.slice("https://img.test/".length) : null),
  };
  return { store, calls };
}

async function setup() {
  const t = await createTestDb();
  const owner = await seedStaff(t.db);
  const desk = await seedStaff(t.db, { role: "front_desk" });
  return { ...t, owner, desk };
}
const imagesOf = async (db: Db, id: string) =>
  (await db.select({ i: products.images }).from(products).where(eq(products.id, id)))[0].i;
const rejectsField = (field: string) => (e: { code?: string; fields?: Record<string, string> }) =>
  e.code === "invalid_input" && !!e.fields?.[field];

test("detectImageFormat reads magic bytes, not names", () => {
  assert.equal(detectImageFormat(PNG), "png");
  assert.equal(detectImageFormat(JPEG), "jpeg");
  assert.equal(detectImageFormat(WEBP), "webp");
  assert.equal(detectImageFormat(HTML), null);
  assert.equal(detectImageFormat(SVG), null);
});

test("createProduct makes a slug, retries collisions, and adds the default variant", async () => {
  const { db, close, owner } = await setup();
  try {
    const a = await createProduct(db, owner, { name: "Whey Protein", description: "", category: "Protein" });
    const b = await createProduct(db, owner, { name: "Whey protein", description: "", category: "Protein" });
    const slugs = await db.select({ id: products.id, slug: products.slug }).from(products);
    assert.equal(slugs.find((s) => s.id === a)?.slug, "whey-protein");
    assert.equal(slugs.find((s) => s.id === b)?.slug, "whey-protein-2");
    const p = await getProductAdmin(db, a);
    assert.deepEqual(p?.variants.map((v) => [v.label, v.price, v.stock]), [["", 0, 0]]);
  } finally {
    await close();
  }
});

test("concurrent creates with the same name get different slugs", async () => {
  const { db, close, owner } = await setup();
  try {
    const ids = await Promise.all(
      [1, 2, 3].map(() => createProduct(db, owner, { name: "Creatine", description: "", category: "Creatine" })),
    );
    const rows = await db.select({ slug: products.slug }).from(products);
    assert.equal(new Set(ids).size, 3);
    assert.equal(new Set(rows.map((r) => r.slug)).size, 3);
  } finally {
    await close();
  }
});

test("product field validation", async () => {
  const { db, close, owner } = await setup();
  try {
    await assert.rejects(createProduct(db, owner, { name: "   ", description: "", category: "X" }), rejectsField("name"));
    await assert.rejects(createProduct(db, owner, { name: "x".repeat(81), description: "", category: "X" }), rejectsField("name"));
    await assert.rejects(createProduct(db, owner, { name: "A", description: "x".repeat(1001), category: "X" }), rejectsField("description"));
    await assert.rejects(createProduct(db, owner, { name: "A", description: "", category: " " }), rejectsField("category"));
  } finally {
    await close();
  }
});

test("variant prices must be whole rupees; labels unique per product", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    await upsertVariant(db, owner, { productId: id, label: "Chocolate", price: 6500 });
    for (const price of [-1, 1.5, "", "abc"]) {
      await assert.rejects(upsertVariant(db, owner, { productId: id, label: "Vanilla", price }), rejectsField("price"));
    }
    await assert.rejects(upsertVariant(db, owner, { productId: id, label: "Chocolate", price: 1 }), rejectsField("label"));
    const p = await getProductAdmin(db, id);
    assert.deepEqual(p?.variants.map((v) => [v.label, v.price]), [["", 0], ["Chocolate", 6500]]);
  } finally {
    await close();
  }
});

test("front desk sets stock; bad values change nothing; works on archived variants", async () => {
  const { db, close, owner, desk } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const [{ id: variantId }] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, id));
    await setStock(db, desk, { variantId, stock: 7 });
    for (const stock of [-1, 2.5, "abc", ""]) {
      await assert.rejects(setStock(db, desk, { variantId, stock }), rejectsField("stock"));
    }
    await setVariantArchived(db, owner, { variantId, archived: true });
    await setStock(db, desk, { variantId, stock: 3 });
    const [v] = await db.select({ s: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId));
    assert.equal(v.s, 3);
  } finally {
    await close();
  }
});

test("front desk is forbidden from owner-only product functions", async () => {
  const { db, close, owner, desk } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const [{ id: variantId }] = await db.select({ id: productVariants.id }).from(productVariants);
    const { store, calls } = fakeStore();
    const forbidden = { code: "forbidden" };
    await assert.rejects(createProduct(db, desk, { name: "A", description: "", category: "X" }), forbidden);
    await assert.rejects(updateProduct(db, desk, { productId: id, name: "B", description: "", category: "X" }), forbidden);
    await assert.rejects(setProductArchived(db, desk, { productId: id, archived: true }), forbidden);
    await assert.rejects(upsertVariant(db, desk, { productId: id, label: "V", price: 1 }), forbidden);
    await assert.rejects(setVariantArchived(db, desk, { variantId, archived: true }), forbidden);
    await assert.rejects(addProductImage(db, store, desk, { productId: id, bytes: PNG }), forbidden);
    await assert.rejects(removeProductImage(db, store, desk, { productId: id, url: "https://img.test/x" }), forbidden);
    assert.deepEqual(calls, []);
  } finally {
    await close();
  }
});

test("archive and restore toggle the flag; unknown ids are null", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    await setProductArchived(db, owner, { productId: id, archived: true });
    assert.equal((await getProductAdmin(db, id))?.archived, true);
    await setProductArchived(db, owner, { productId: id, archived: false });
    assert.equal((await getProductAdmin(db, id))?.archived, false);
    assert.equal(await getProductAdmin(db, "nope"), null);
  } finally {
    await close();
  }
});

test("images: real PNG accepted whatever the browser said; path uses detected extension", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const { store } = fakeStore();
    const url = await addProductImage(db, store, owner, { productId: id, bytes: PNG });
    assert.match(url, new RegExp(`^https://img\\.test/products/${id}/[0-9a-f-]+\\.png$`));
    assert.deepEqual(await imagesOf(db, id), [url]);
  } finally {
    await close();
  }
});

test("images: non-images, SVG, oversize and a 7th image never reach storage", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const { store, calls } = fakeStore();
    await assert.rejects(addProductImage(db, store, owner, { productId: id, bytes: HTML }), { code: "invalid_input" });
    await assert.rejects(addProductImage(db, store, owner, { productId: id, bytes: SVG }), { code: "invalid_input" });
    const big = new Uint8Array(5_242_881);
    big.set(PNG);
    await assert.rejects(addProductImage(db, store, owner, { productId: id, bytes: big }), { code: "invalid_input" });
    assert.deepEqual(calls, []);

    for (let i = 0; i < 6; i++) await addProductImage(db, store, owner, { productId: id, bytes: JPEG });
    const before = calls.length;
    await assert.rejects(addProductImage(db, store, owner, { productId: id, bytes: JPEG }), (e: { message?: string }) =>
      /up to 6 images/.test(e.message ?? ""),
    );
    assert.equal(calls.length, before);
    assert.equal((await imagesOf(db, id)).length, 6);
  } finally {
    await close();
  }
});

test("images: storage failure appends nothing", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const { store } = fakeStore({ upload: true });
    await assert.rejects(addProductImage(db, store, owner, { productId: id, bytes: PNG }), /storage down/);
    assert.deepEqual(await imagesOf(db, id), []);
  } finally {
    await close();
  }
});

test("images: a failure after upload removes the stored file; if that fails too, the original error stands", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const a = fakeStore({ publicUrl: true });
    await assert.rejects(addProductImage(db, a.store, owner, { productId: id, bytes: PNG }), /db write failed/);
    assert.equal(a.calls.filter((c) => c.startsWith("remove ")).length, 1);
    assert.deepEqual(await imagesOf(db, id), []);

    const b = fakeStore({ publicUrl: true, remove: true });
    const orig = console.error;
    console.error = () => {};
    try {
      await assert.rejects(addProductImage(db, b.store, owner, { productId: id, bytes: PNG }), /db write failed/);
    } finally {
      console.error = orig;
    }
  } finally {
    await close();
  }
});

test("images: removal only accepts this product's own images; storage failure is reported", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const other = await createProduct(db, owner, { name: "Creatine", description: "", category: "Creatine" });
    const { store } = fakeStore();
    const mine = await addProductImage(db, store, owner, { productId: id, bytes: PNG });
    const theirs = await addProductImage(db, store, owner, { productId: other, bytes: PNG });

    await assert.rejects(removeProductImage(db, store, owner, { productId: id, url: theirs }), { code: "invalid_input" });
    await assert.rejects(removeProductImage(db, store, owner, { productId: id, url: "https://evil.test/x.png" }), {
      code: "invalid_input",
    });

    const failing = fakeStore({ remove: true });
    const orig = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await removeProductImage(db, failing.store, owner, { productId: id, url: mine }), { storageCleaned: false });
    } finally {
      console.error = orig;
    }
    assert.deepEqual(await imagesOf(db, id), []);
    assert.deepEqual(await imagesOf(db, other), [theirs]);
  } finally {
    await close();
  }
});

test("sweep removes only old, unreferenced objects", async () => {
  const { db, close, owner } = await setup();
  try {
    const id = await createProduct(db, owner, { name: "Whey", description: "", category: "Protein" });
    const old = new Date(Date.now() - 2 * 3600_000);
    const objects = [
      { path: `products/${id}/kept.png`, createdAt: old },
      { path: `products/${id}/orphan.png`, createdAt: old },
      { path: `products/${id}/fresh.png`, createdAt: new Date() },
    ];
    const { store, calls } = fakeStore({}, objects);
    await db.update(products).set({ images: [store.publicUrl(`products/${id}/kept.png`)] }).where(eq(products.id, id));
    const r = await sweepOrphanImages(db, store);
    assert.deepEqual(r, { removed: [`products/${id}/orphan.png`], failed: [] });
    assert.deepEqual(calls, [`remove products/${id}/orphan.png`]);
  } finally {
    await close();
  }
});
