"use server";

import { redirect } from "next/navigation";
import { getStaff } from "../../lib/auth.ts";
import { createSupabaseServerClient } from "../../lib/supabase-server.ts";
import { toActionError, type ActionResult } from "../action-error.ts";

export async function signIn(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { ok: false, error: "Enter your email and password." };

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: "Email or password is incorrect." };

    const staff = await getStaff();
    if (!staff || !staff.active) {
      await supabase.auth.signOut();
      return { ok: false, error: "This account can't use the admin portal." };
    }
  } catch (e) {
    return toActionError(e);
  }
  redirect("/admin");
}
