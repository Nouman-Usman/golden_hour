"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { db } from "@/db";
import { ENQUIRY_GENERIC_ERROR, enquiryFailure, parseEnquiry, type EnquiryErrors } from "./lib/enquiry";
import { enquiryWhatsAppUrl, submitEnquiry as saveEnquiry } from "./lib/enquiries";
import { notifyStaff } from "./lib/push";
import { getSettings } from "./lib/settings";
import { webPushSender } from "./lib/web-push-sender";

export type JoinState = {
  ok?: boolean;
  errors?: EnquiryErrors;
  values?: Record<string, string>;
  whatsappUrl?: string;
  formError?: string;
};

export async function submitEnquiry(_prev: JoinState, form: FormData): Promise<JoinState> {
  const values = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
  const { data, errors } = parseEnquiry(form);
  if (!data) return { errors, values };
  if (!db) return { formError: ENQUIRY_GENERIC_ERROR, values };

  try {
    const saved = await saveEnquiry(db, { ...data, idempotencyKey: data.idempotencyKey || randomUUID() });
    // Staff push goes out after the response, so a slow push service never delays the visitor.
    const database = db;
    if (saved.created && webPushSender) {
      const sender = webPushSender;
      after(() => notifyStaff(database, sender, { kind: "enquiry", id: saved.id, program: data.program }));
    }
  } catch (e) {
    const f = enquiryFailure(e);
    if (f.log) console.error("submitEnquiry failed", e);
    return { errors: f.errors, formError: f.formError, values };
  }

  // The enquiry is saved; a settings problem only costs the WhatsApp link.
  try {
    const settings = await getSettings(db);
    return { ok: true, whatsappUrl: enquiryWhatsAppUrl(settings.whatsapp, data) };
  } catch (e) {
    console.error("submitEnquiry: settings unavailable after save", e);
    return { ok: true };
  }
}
