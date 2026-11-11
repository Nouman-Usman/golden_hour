import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "../../../../db/index.ts";
import { staff } from "../../../../db/schema.ts";
import { requireStaffPage } from "../../guard.ts";
import { ActionForm } from "../action-form";
import { ConfirmButton } from "../confirm-button";
import { Field, input } from "../products/fields";
import { createStaffAction, resetPasswordAction, setActiveAction, setRoleAction } from "./actions";

function RoleSelect({ value }: { value?: string }) {
  return (
    <select name="role" defaultValue={value ?? "front_desk"} className={`${input} bg-matte`}>
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
    <div className="grid max-w-3xl gap-8">
      <h1 className="font-display text-4xl font-bold uppercase">Staff</h1>
      <ul className="grid gap-4">
        {list.map((p) => {
          const self = p.userId === me.userId;
          return (
            <li key={p.userId} className={`grid gap-3 rounded-2xl border border-ash/30 p-4 ${p.active ? "" : "opacity-60"}`}>
              <p>
                <span className="font-display text-2xl font-bold">{p.name}</span>
                <span className="ml-2 text-sm text-ash">
                  {p.email} · {p.role === "owner" ? "Owner" : "Front desk"}
                  {!p.active && " · Deactivated"}
                  {self && " · You"}
                </span>
              </p>
              {!self && (
                <details>
                  <summary className="cursor-pointer text-sm text-brass-light">Manage</summary>
                  <div className="mt-4 grid gap-5">
                    <ActionForm action={setRoleAction} submit="Change role" variant="btn-outline" className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="userId" value={p.userId} />
                      <div className="w-44">
                        <RoleSelect value={p.role} />
                      </div>
                    </ActionForm>
                    <ActionForm action={resetPasswordAction} submit="Reset password" variant="btn-outline" className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="userId" value={p.userId} />
                      <div className="w-56">
                        <Field label="New temporary password (10+ characters)">
                          <input name="password" type="text" autoComplete="off" minLength={10} required className={input} />
                        </Field>
                      </div>
                    </ActionForm>
                    {p.active ? (
                      <ConfirmButton action={setActiveAction} label="Deactivate" fields={{ userId: p.userId, active: "false" }} />
                    ) : (
                      <ActionForm action={setActiveAction} submit="Reactivate" variant="btn-outline" className="flex items-center gap-3">
                        <input type="hidden" name="userId" value={p.userId} />
                        <input type="hidden" name="active" value="true" />
                      </ActionForm>
                    )}
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <section className="grid gap-4 rounded-2xl border border-dashed border-ash/40 p-4">
        <h2 className="font-display text-2xl font-bold">Add a staff member</h2>
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
          <p className="text-sm text-ash">Share this password in person. They can change it under Account.</p>
        </ActionForm>
      </section>
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
