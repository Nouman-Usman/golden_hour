import webpush from "web-push";
import type { PushSender } from "./push.ts";

type Env = Partial<Record<"NEXT_PUBLIC_VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY" | "VAPID_SUBJECT", string>>;

// null (push disabled) when keys are missing or malformed: a bad .env value must never break
// the public enquiry form that imports this.
export function makeWebPushSender(env: Env): PushSender | null {
  const pub = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return null;
  try {
    webpush.setVapidDetails(subject, pub, priv);
  } catch (e) {
    console.error("Push disabled: VAPID settings are invalid", e);
    return null;
  }
  return {
    async send(sub, payload) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
        return "ok";
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        return status === 404 || status === 410 ? "gone" : "failed";
      }
    },
  };
}
