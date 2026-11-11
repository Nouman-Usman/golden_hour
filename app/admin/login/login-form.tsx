"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const field =
  "w-full border-b border-ash/60 bg-transparent py-3 text-lg text-bone placeholder:text-ash focus:border-brass-light focus:outline-none";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const error = state && !state.ok ? state.error : notice;

  return (
    <form action={action} className="grid gap-6">
      <label className="block">
        <span className="text-sm text-ash">Email</span>
        <input name="email" type="email" autoComplete="username" required className={field} />
      </label>
      <label className="block">
        <span className="text-sm text-ash">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-lamp">
          {error}
        </p>
      )}
      <button disabled={pending} className="btn btn-brass w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
