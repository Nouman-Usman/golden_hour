import type { EnquiryStatus, OrderStatus } from "../../db/schema.ts";

export const orderStatusLabel: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const enquiryStatusLabel: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  joined: "Joined",
  not_interested: "Not interested",
};

// wa.me wants international digits: 03xx… → 923xx…
export function whatsappDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("0") ? `92${d.slice(1)}` : d;
}

const when = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

// "12 Nov, 3:14 pm" in Lahore time.
export function formatWhen(d: Date): string {
  const p = Object.fromEntries(when.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${String(p.dayPeriod).toLowerCase()}`;
}
