import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { staff } from "../../../../db/schema.ts";
import { requireStaffPage } from "../../guard.ts";
import { ActionForm } from "../action-form";
import { ConfirmButton } from "../confirm-button";
import { Field, input } from "../products/fields";
import { Icon } from "../icons";
import { Card, PageHeader, Pill } from "../ui";
import { createStaffAction, resetPasswordAction, setActiveAction, setRoleAction } from "./actions";

function RoleSelect({ value }: { value?: string }) {
  return (
    <select name="role" defaultValue={value ?? "front_desk"} className={input}>
      <option value="front_desk">Front desk</option>
      <option value="owner">Owner</option>
    </select>
  );
}

async function Staff() {
  const me = await requireStaffPage("staff.manage");
  const list = db
    ? await db
        .select({ userId: staff.userId, name: staff.name, email: staff.email, role: staff.role, active: staff.active })
        .from(staff)
        .orderBy(asc(staff.active), asc(staff.name))
    : [];

  return (
    <div className="max-w-3xl">
      <PageHeader title="Staff" description="Who can sign in to the admin, and what they can do." />
      <div className="grid gap-4">
        <ul className="grid gap-3">
          {list.map((p) => {
            const self = p.userId === me.userId;
            return (
              <li key={p.userId} className={`rounded-2xl border border-line bg-matte-2 ${p.active ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-3 p-4 md:px-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-matte-3 font-semibold text-brass-light" aria-hidden>
                    {p.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.name}</span>
                      {self && <Pill tone="active">You</Pill>}
                      {!p.active && <Pill tone="muted">Deactivated</Pill>}
                    </p>
                    <p className="truncate text-sm text-ash">{p.email}</p>
                  </div>
                  <span className="hidden text-sm text-bone/75 sm:block">{p.role === "owner" ? "Owner" : "Front desk"}</span>
                </div>
                {!self && (
                  <details className="group border-t border-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm text-bone/80 hover:text-bone md:px-5">
                      Manage
                      <Icon name="chevron" width={16} height={16} className="transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="grid gap-5 border-t border-line p-4 md:p-5">
                      <ActionForm action={setRoleAction} submit="Change role" variant="btn-outline" className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="userId" value={p.userId} />
                        <div className="w-48">
                          <Field label="Role">
                            <RoleSelect value={p.role} />
                          </Field>
                        </div>
                      </ActionForm>
                      <ActionForm action={resetPasswordAction} submit="Reset password" variant="btn-outline" className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="userId" value={p.userId} />
                        <div className="w-full sm:w-72">
                          <Field label="New temporary password (10+ characters)">
                            <input name="password" type="text" autoComplete="off" minLength={10} required className={input} />
                          </Field>
                        </div>
                      </ActionForm>
                      <div className="border-t border-line pt-4">
                        {p.active ? (
                          <ConfirmButton action={setActiveAction} label="Deactivate" fields={{ userId: p.userId, active: "false" }} />
                        ) : (
                          <ActionForm action={setActiveAction} submit="Reactivate" variant="btn-outline" className="flex items-center gap-3">
                            <input type="hidden" name="userId" value={p.userId} />
                            <input type="hidden" name="active" value="true" />
                          </ActionForm>
                        )}
                      </div>
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>

        <Card title="Add a staff member" description="Share the password in person. They can change it under Account.">
          <ActionForm action={createStaffAction} submit="Create account">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input name="name" required maxLength={80} className={input} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required className={input} />
              </Field>
              <Field label="Role">
                <RoleSelect />
              </Field>
              <Field label="Temporary password (10+ characters)">
                <input name="password" type="text" autoComplete="off" minLength={10} required className={input} />
              </Field>
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<p className="text-ash">Loading…</p>}>
      <Staff />
    </Suspense>
  );
}
