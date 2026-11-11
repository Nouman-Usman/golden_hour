"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { parseEnquiry, type EnquiryErrors } from "./lib/enquiry";
import { enquiryWhatsAppUrl, submitEnquiry as saveEnquiry } from "./lib/enquiries";
import { DomainError } from "./lib/errors";
import { getSettings } from "./lib/settings";

export type JoinState = {
  ok?: boolean;
  errors?: EnquiryErrors;
  values?: Record<string, string>;
  whatsappUrl?: string;
  formError?: string;
};

const generic = "We couldn't send your enquiry right now. Call or WhatsApp us instead.";

export async function submitEnquiry(_prev: JoinState, form: FormData): Promise<JoinState> {
  const values = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
  const { data, errors } = parseEnquiry(form);
  if (!data) return { errors, values };
  if (!db) return { formError: generic, values };

  try {
    const settings = await getSettings(db);
    await saveEnquiry(db, { ...data, idempotencyKey: data.idempotencyKey || randomUUID() });
    return { ok: true, whatsappUrl: enquiryWhatsAppUrl(settings.whatsapp, data) };
  } catch (e) {
    if (e instanceof DomainError) {
      if (e.code === "invalid_input") return { errors: e.fields as EnquiryErrors, values };
      return { formError: e.message, values };
    }
    console.error("submitEnquiry failed", e);
    return { formError: generic, values };
  }
}
