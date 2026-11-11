"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const field =
  "mt-1.5 block w-full rounded-lg border border-line bg-matte px-3 py-3 text-bone placeholder:text-ash transition-colors focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/25";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const error = state && !state.ok ? state.error : notice;

  return (
    <form action={action} className="grid gap-6">
      <label className="block">
        <span className="text-sm font-medium text-bone/80">Email</span>
        <input name="email" type="email" autoComplete="username" required className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-bone/80">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button disabled={pending} className="btn btn-brass w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
