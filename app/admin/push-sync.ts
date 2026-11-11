import type { ActionResult } from "./action-error.ts";

type BrowserSub = { endpoint: string; toJSON(): { keys?: Record<string, string> } } | null;
type Save = (s: { endpoint: string; p256dh: string; auth: string; userAgent: string }) => Promise<ActionResult>;

// On load, a subscription the browser already holds is saved again for the current staff member,
// so notifications resume after a password reset, demotion or a different person signing in.
export async function syncExistingSubscription(sub: BrowserSub, save: Save, userAgent: string): Promise<"on" | "off"> {
  if (!sub) return "off";
  const keys = sub.toJSON().keys ?? {};
  const r = await save({ endpoint: sub.endpoint, p256dh: keys.p256dh ?? "", auth: keys.auth ?? "", userAgent });
  return r.ok ? "on" : "off";
}
