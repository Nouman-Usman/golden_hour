"use client";

import { useEffect, useState } from "react";
import { syncExistingSubscription } from "../push-sync";
import { deletePush, savePush } from "./push-actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "loading" | "unconfigured" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  return navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
}

// Turns browser notifications on/off for this device. Permission is only requested on a click.
export function PushToggle({ banner = false }: { banner?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!VAPID) return setState("unconfigured");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(isIOS() && !standalone() ? "ios-install" : "unsupported");
      }
      if (isIOS() && !standalone()) return setState("ios-install");
      if (Notification.permission === "denied") return setState("denied");
      // Re-save an existing subscription so it follows whoever is signed in now and survives session resets.
      const sub = await (await registration()).pushManager.getSubscription();
      setState(await syncExistingSubscription(sub, savePush, navigator.userAgent));
    })();
  }, []);

  async function turnOn() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) });
      const json = sub.toJSON();
      const r = await savePush({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (!r.ok) {
        await sub.unsubscribe();
        setMsg(r.error);
        return;
      }
      setState("on");
      setMsg(r.message ?? null);
    } catch {
      setMsg("Couldn't turn on notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await deletePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Notifications are off for this device.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || (banner && (state === "on" || state === "unconfigured" || state === "unsupported"))) return null;

  const text: Partial<Record<State, string>> = {
    unconfigured: "Notifications aren't set up yet.",
    unsupported: "This browser can't show notifications.",
    "ios-install":
      "On iPhone: tap Share → Add to Home Screen, then open Golden Hour Admin from your Home Screen to turn on notifications.",
    denied: "Notifications are blocked. Allow them in your browser's site settings.",
    off: "Get a notification on this device for every new order and enquiry.",
    on: "Notifications are on for this device.",
  };

  return (
    <div className={`grid gap-3 ${banner ? "rounded-2xl border border-brass/40 bg-brass/10 p-4 sm:flex sm:items-center sm:justify-between" : ""}`}>
      <p className="text-sm text-bone/85">{text[state]}</p>
      {state === "off" && (
        <button onClick={turnOn} disabled={busy} className="btn btn-sm btn-brass w-fit">
          {busy ? "Turning on…" : "Turn on notifications"}
        </button>
      )}
      {state === "on" && !banner && (
        <button onClick={turnOff} disabled={busy} className="btn btn-sm btn-outline w-fit">
          Turn off
        </button>
      )}
      {msg && <p className="text-sm text-bone/75">{msg}</p>}
    </div>
  );
}
