import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaffPage } from "../../guard.ts";
import { PushToggle } from "../push-toggle";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function AccountContent() {
  const staff = await requireStaffPage();
  return (
    <div className="grid max-w-md gap-8">
      <div>
        <h1 className="font-display text-4xl font-bold uppercase">Account</h1>
        <p className="mt-2 text-bone/75">
          {staff.name} · {staff.email} · {staff.role === "owner" ? "Owner" : "Front desk"}
        </p>
      </div>
      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-bold">Notifications on this device</h2>
        <PushToggle />
      </section>
      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-bold">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <AccountContent />
    </Suspense>
  );
}
