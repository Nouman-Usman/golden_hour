import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaffPage } from "../../guard.ts";
import { PushToggle } from "../push-toggle";
import { Card, PageHeader } from "../ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function AccountContent() {
  const staff = await requireStaffPage();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Account" />
      <div className="grid gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brass font-display text-xl font-bold text-matte" aria-hidden>
              {staff.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{staff.name}</p>
              <p className="truncate text-sm text-ash">{staff.email}</p>
              <p className="text-sm text-bone/75">{staff.role === "owner" ? "Owner" : "Front desk"}</p>
            </div>
          </div>
        </Card>
        <Card title="Notifications on this device">
          <PushToggle />
        </Card>
        <Card title="Change password">
          <PasswordForm />
        </Card>
      </div>
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
