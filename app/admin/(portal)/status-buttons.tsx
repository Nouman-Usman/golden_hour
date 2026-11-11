"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "../action-error";
import { Result } from "./result";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

// Status buttons for an order or enquiry. Cancel / negative outcomes need a second click.
export function StatusButtons({
  action,
  idName,
  id,
  options,
  danger = [],
}: {
  action: Action;
  idName: "orderId" | "enquiryId";
  id: string;
  options: { value: string; label: string }[];
  danger?: string[];
}) {
  const [state, run, pending] = useActionState(action, null);
  const [arming, setArming] = useState<string | null>(null);
  if (!options.length) return null;

  return (
    <form action={run} className="grid gap-3" onSubmit={() => setArming(null)}>
      <input type="hidden" name={idName} value={id} />
      <label className="block">
        <span className="text-sm text-ash">Note (optional)</span>
        <input name="note" maxLength={500} className="w-full border-b border-ash/60 bg-transparent py-2 text-bone focus:border-brass-light focus:outline-none" />
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const isDanger = danger.includes(o.value);
          if (isDanger && arming !== o.value) {
            return (
              <button key={o.value} type="button" onClick={() => setArming(o.value)} className="btn btn-sm btn-outline">
                {o.label}
              </button>
            );
          }
          return (
            <button
              key={o.value}
              name="to"
              value={o.value}
              disabled={pending}
              className={`btn btn-sm ${isDanger ? "bg-lamp text-matte" : "btn-brass"}`}
            >
              {isDanger ? `Yes, ${o.label.toLowerCase()}` : o.label}
            </button>
          );
        })}
      </div>
      <Result state={state} />
    </form>
  );
}
