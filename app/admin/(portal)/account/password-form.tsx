"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";

const field =
  "mt-1.5 block w-full rounded-lg border border-line bg-matte px-3 py-3 text-bone placeholder:text-ash transition-colors focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/25";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  const fields = state && !state.ok ? state.fields ?? {} : {};

  return (
    <form action={action} className="grid gap-5">
      <label className="block">
        <span className="text-sm font-medium text-bone/80">Current password</span>
        <input name="current" type="password" autoComplete="current-password" required className={field} />
        {fields.current && <span className="mt-1 block text-sm text-danger">{fields.current}</span>}
      </label>
      <label className="block">
        <span className="text-sm font-medium text-bone/80">New password (at least 10 characters)</span>
        <input name="next" type="password" autoComplete="new-password" minLength={10} required className={field} />
        {fields.next && <span className="mt-1 block text-sm text-danger">{fields.next}</span>}
      </label>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-ok" : "text-sm text-danger"}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      <button disabled={pending} className="btn btn-brass justify-self-start">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
