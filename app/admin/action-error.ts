import { DomainError } from "../lib/errors.ts";

// The one result shape every admin action and route returns.
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fields?: Record<string, string> };

export const GENERIC_ERROR = "Something went wrong. Try again.";

export function toActionError(e: unknown): { ok: false; error: string; fields?: Record<string, string> } {
  if (e instanceof DomainError) {
    return e.fields ? { ok: false, error: e.message, fields: e.fields } : { ok: false, error: e.message };
  }
  console.error("admin action failed", e);
  return { ok: false, error: GENERIC_ERROR };
}
