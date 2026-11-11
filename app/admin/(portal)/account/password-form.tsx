"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";

const field =
  "w-full border-b border-ash/60 bg-transparent py-3 text-lg text-bone focus:border-brass-light focus:outline-none";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  const fields = state && !state.ok ? state.fields ?? {} : {};

  return (
    <form action={action} className="grid gap-5">
      <label className="block">
        <span className="text-sm text-ash">Current password</span>
        <input name="current" type="password" autoComplete="current-password" required className={field} />
        {fields.current && <span className="mt-1 block text-sm text-lamp">{fields.current}</span>}
      </label>
      <label className="block">
        <span className="text-sm text-ash">New password (at least 10 characters)</span>
        <input name="next" type="password" autoComplete="new-password" minLength={10} required className={field} />
        {fields.next && <span className="mt-1 block text-sm text-lamp">{fields.next}</span>}
      </label>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-brass-light" : "text-sm text-lamp"}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      <button disabled={pending} className="btn btn-brass justify-self-start">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
