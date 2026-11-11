// Run: node app/lib/enquiry.check.ts
import assert from "node:assert";
import { parseEnquiry } from "./enquiry.ts";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

const ok = parseEnquiry(form({ name: " Ali ", phone: "0321 422-0245", session: "Open floor", message: "" }));
assert.deepEqual(ok.data, { name: "Ali", phone: "03214220245", session: "Open floor", message: "" });

assert.ok(parseEnquiry(form({ name: "A", phone: "+923214220245", session: "Personal training" })).data);
assert.ok(parseEnquiry(form({ name: "", phone: "123", session: "Yoga" })).errors?.name);
const bad = parseEnquiry(form({ name: "A", phone: "123", session: "Yoga" })).errors!;
assert.ok(bad.phone && bad.session);
assert.ok(parseEnquiry(form({ name: "A", phone: "03214220245", session: "Open floor", message: "x".repeat(501) })).errors?.message);

console.log("enquiry checks passed");
