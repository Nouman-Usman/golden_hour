import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { syncExistingSubscription } from "../app/admin/push-sync.ts";
import { makeWebPushSender } from "../app/lib/web-push-factory.ts";

const manifest = JSON.parse(readFileSync("public/admin.webmanifest", "utf8"));

test("manifest scope covers its start_url (and the dashboard)", () => {
  assert.ok(manifest.start_url.startsWith(manifest.scope), `${manifest.start_url} not in ${manifest.scope}`);
  assert.equal(manifest.scope, "/admin");
});

// Runs public/admin-sw.js with a fake service-worker global and returns its listeners.
function loadWorker(clients: unknown) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { origin: "https://gym.test" },
    clients,
    registration: { showNotification: async () => {} },
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
  };
  vm.runInNewContext(readFileSync("public/admin-sw.js", "utf8"), { self, URL });
  return listeners;
}
async function click(listeners: Record<string, (e: unknown) => void>, url: string) {
  let done: Promise<unknown> = Promise.resolve();
  listeners.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: (p: Promise<unknown>) => (done = p) });
  await done;
}

test("notification click navigates an open admin window", async () => {
  const calls: string[] = [];
  const win = { url: "https://gym.test/admin", focus: async () => calls.push("focus"), navigate: async (u: string) => calls.push(`navigate ${u}`) };
  const l = loadWorker({ matchAll: async () => [win], openWindow: async (u: string) => calls.push(`open ${u}`) });
  await click(l, "/admin/orders/abc");
  assert.deepEqual(calls, ["focus", "navigate https://gym.test/admin/orders/abc"]);
});

test("notification click opens a window when navigate fails (uncontrolled client)", async () => {
  const calls: string[] = [];
  const win = {
    url: "https://gym.test/admin",
    focus: async () => calls.push("focus"),
    navigate: async () => {
      throw new TypeError("not controlled");
    },
  };
  const l = loadWorker({ matchAll: async () => [win], openWindow: async (u: string) => calls.push(`open ${u}`) });
  await click(l, "/admin/enquiries/xyz");
  assert.deepEqual(calls, ["focus", "open https://gym.test/admin/enquiries/xyz"]);
});

test("an existing browser subscription is re-saved on load", async () => {
  const saved: unknown[] = [];
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/x", toJSON: () => ({ keys: { p256dh: "pk", auth: "au" } }) };
  const state = await syncExistingSubscription(sub, async (s) => {
    saved.push(s);
    return { ok: true };
  }, "UA");
  assert.equal(state, "on");
  assert.deepEqual(saved, [{ endpoint: sub.endpoint, p256dh: "pk", auth: "au", userAgent: "UA" }]);
  assert.equal(await syncExistingSubscription(null, async () => ({ ok: true }), "UA"), "off");
  assert.equal(await syncExistingSubscription(sub, async () => ({ ok: false, error: "no" }), "UA"), "off");
});

test("bad VAPID settings disable push instead of throwing", () => {
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(makeWebPushSender({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: "bad", VAPID_PRIVATE_KEY: "bad", VAPID_SUBJECT: "nope" }), null);
  } finally {
    console.error = orig;
  }
  assert.equal(makeWebPushSender({}), null);
});
