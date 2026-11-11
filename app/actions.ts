"use server";

import { appendFile, mkdir } from "node:fs/promises";
import { parseEnquiry, type Errors } from "./lib/enquiry";

export type JoinState = { ok?: boolean; errors?: Errors; values?: Record<string, string> };

export async function submitEnquiry(_prev: JoinState, form: FormData): Promise<JoinState> {
  const { data, errors } = parseEnquiry(form);
  if (!data) {
    return { errors, values: Object.fromEntries([...form].map(([k, v]) => [k, String(v)])) };
  }

  // ponytail: JSON-lines file works locally only; swap for a database before deploying to serverless.
  await mkdir("data", { recursive: true });
  await appendFile("data/enquiries.jsonl", JSON.stringify({ ...data, at: new Date().toISOString() }) + "\n");

  return { ok: true };
}
