"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "../action-error";
import { Result } from "./result";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

// A form bound to an admin action, with a submit button and the result line.
export function ActionForm({
  action,
  children,
  submit,
  pendingLabel = "Saving…",
  variant = "btn-brass",
  className = "grid gap-4",
}: {
  action: Action;
  children?: ReactNode;
  submit: string;
  pendingLabel?: string;
  variant?: "btn-brass" | "btn-outline";
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={`btn btn-sm ${variant}`}>
          {pending ? pendingLabel : submit}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}
