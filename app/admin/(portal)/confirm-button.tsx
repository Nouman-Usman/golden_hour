"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "../action-error";
import { Result } from "./result";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

// Destructive action: first click arms, second click submits (no window.confirm).
export function ConfirmButton({ action, label, fields }: { action: Action; label: string; fields: Record<string, string> }) {
  const [state, run, pending] = useActionState(action, null);
  const [armed, setArmed] = useState(false);
  return (
    <form action={run} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {armed ? (
        <>
          <button disabled={pending} className="btn btn-sm bg-lamp text-matte">
            Yes, {label.toLowerCase()}
          </button>
          <button type="button" onClick={() => setArmed(false)} className="btn btn-sm btn-outline">
            Keep it
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setArmed(true)} className="btn btn-sm btn-outline">
          {label}
        </button>
      )}
      <Result state={state} />
    </form>
  );
}
