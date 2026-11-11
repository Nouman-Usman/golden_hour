"use client";

import { useActionState } from "react";
import type { ActionResult } from "../action-error";
import { input } from "./products/fields";
import { Result } from "./result";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

export function NotesForm({ action, idName, id, notes }: { action: Action; idName: string; id: string; notes: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-2">
      <input type="hidden" name={idName} value={id} />
      <label className="block">
        <span className="text-sm font-medium text-bone/80">Only staff can see these notes</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={notes}
          className={input}
        />
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-sm btn-outline">
          {pending ? "Saving…" : "Save notes"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}
