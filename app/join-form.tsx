"use client";

import { useActionState, useEffect, useState } from "react";
import { submitEnquiry, type JoinState } from "./actions";
import { Arrow } from "./arrow";

const field =
  "w-full border-b border-ash/60 bg-transparent py-3 text-lg text-bone placeholder:text-ash focus:border-brass-light focus:outline-none";

export function JoinForm({ programs }: { programs: string[] }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(submitEnquiry, {});
  // Set after mount: the page is cached, so a render-time key would be shared by every visitor.
  const [key, setKey] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only, once per mount
  useEffect(() => setKey(crypto.randomUUID()), []);

  if (state.ok) {
    return (
      <div className="grid justify-items-start gap-6">
        <p role="status" className="text-2xl leading-snug">
          Enquiry sent. We&apos;ll call or WhatsApp you within a day to book your first visit.
        </p>
        {state.whatsappUrl && (
          <a href={state.whatsappUrl} className="btn btn-outline">
            Also message us on WhatsApp
          </a>
        )}
      </div>
    );
  }

  const v = state.values ?? {};
  const err = state.errors ?? {};
  const error = (k: keyof typeof err) =>
    err[k] && (
      <p id={`${k}-error`} className="mt-2 text-sm text-lamp">
        {err[k]}
      </p>
    );

  return (
    <form action={action} noValidate className="grid gap-8">
      <input type="hidden" name="idempotencyKey" value={key} />
      <label className="block">
        <span className="text-sm text-ash">Your name</span>
        <input name="name" autoComplete="name" defaultValue={v.name} aria-invalid={!!err.name} aria-describedby="name-error" className={field} />
        {error("name")}
      </label>
      <label className="block">
        <span className="text-sm text-ash">Mobile number</span>
        <input name="phone" type="tel" autoComplete="tel" placeholder="0321 4220245" defaultValue={v.phone} aria-invalid={!!err.phone} aria-describedby="phone-error" className={field} />
        {error("phone")}
      </label>
      <fieldset>
        <legend className="text-sm text-ash">I want to join</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {programs.map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="program" value={s} defaultChecked={v.program === s} className="peer sr-only" />
              <span className="block rounded-full border border-ash/60 px-4 py-2 peer-checked:border-brass peer-checked:bg-brass peer-checked:text-matte peer-focus-visible:outline-2 peer-focus-visible:outline-brass-light">
                {s}
              </span>
            </label>
          ))}
        </div>
        {error("program")}
      </fieldset>
      <label className="block">
        <span className="text-sm text-ash">Anything we should know (optional)</span>
        <textarea name="message" rows={3} defaultValue={v.message} className={field} />
        {error("message")}
      </label>
      {state.formError && (
        <p role="alert" className="text-sm text-lamp">
          {state.formError}
        </p>
      )}
      <button disabled={pending} className="btn btn-brass btn-action justify-self-start">
        {pending ? "Sending…" : "Send enquiry"}
        <span className="btn-icon">
          <Arrow />
        </span>
      </button>
    </form>
  );
}
