import type { ActionResult } from "../action-error";

// Inline outcome line for any admin form.
export function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-ok" : "text-danger"}`}>
      {state.ok ? state.message : state.error}
    </p>
  );
}
