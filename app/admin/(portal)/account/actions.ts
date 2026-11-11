"use server";

import { createSupabaseServerClient } from "../../../lib/supabase-server.ts";
import { toActionError, type ActionResult } from "../../action-error.ts";
import { requireStaffAction } from "../../guard.ts";

export async function changePassword(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  try {
    const staff = await requireStaffAction();
    if (next.length < 10) return { ok: false, error: "At least 10 characters.", fields: { next: "At least 10 characters." } };
    if (next === current) return { ok: false, error: "Choose a different password.", fields: { next: "Choose a different password." } };

    const supabase = await createSupabaseServerClient();
    const check = await supabase.auth.signInWithPassword({ email: staff.email, password: current });
    if (check.error) return { ok: false, error: "Current password is incorrect.", fields: { current: "Current password is incorrect." } };

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw error;
    return { ok: true, message: "Password changed." };
  } catch (e) {
    return toActionError(e);
  }
}
