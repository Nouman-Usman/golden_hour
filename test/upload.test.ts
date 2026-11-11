import { test } from "node:test";
import assert from "node:assert/strict";
import { readImageUpload } from "../app/lib/upload.ts";

const MAX = 5_242_880;

function request(bytes: number | null, headers: Record<string, string> = {}) {
  const fd = new FormData();
  if (bytes !== null) fd.set("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "a.png");
  return new Request("http://x/admin/products/1/images", { method: "POST", body: fd, headers });
}

test("exactly 5 MB is accepted", async () => {
  const r = await readImageUpload(request(MAX), MAX);
  assert.ok("bytes" in r);
  assert.equal(r.bytes.length, MAX);
});

test("one byte over is rejected with 413", async () => {
  const r = await readImageUpload(request(MAX + 1), MAX);
  assert.deepEqual(r, { error: "Images must be 5 MB or smaller.", status: 413 });
});

test("a huge Content-Length is rejected before parsing", async () => {
  const req = new Request("http://x", {
    method: "POST",
    body: "tiny",
    headers: { "content-length": String(50 * 1024 * 1024), "content-type": "multipart/form-data; boundary=x" },
  });
  const r = await readImageUpload(req, MAX);
  assert.deepEqual(r, { error: "Images must be 5 MB or smaller.", status: 413 });
});

test("missing file is a 400", async () => {
  const r = await readImageUpload(request(null), MAX);
  assert.deepEqual(r, { error: "Choose an image.", status: 400 });
});
