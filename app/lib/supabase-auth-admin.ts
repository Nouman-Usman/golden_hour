// No `server-only` here so plain-Node scripts can use it; the app imports it via supabase-admin.ts.
import { createClient } from "@supabase/supabase-js";
import { DomainError } from "./errors.ts";
import type { AuthAdmin } from "./staff.ts";

function ok<D>(r: { data: D; error: null } | { data: unknown; error: { message: string } }): D {
  if (r.error) throw new Error(`Supabase Auth: ${r.error.message}`);
  return r.data as D;
}

// Env is read at call time so builds without secrets still work.
export function makeAuthAdmin(): AuthAdmin {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new DomainError("misconfigured", "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const auth = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;
  return {
    async createUser(email, password) {
      return ok(await auth.createUser({ email, password, email_confirm: true })).user.id;
    },
    async deleteUser(userId) {
      ok(await auth.deleteUser(userId));
    },
    async setPassword(userId, password) {
      ok(await auth.updateUserById(userId, { password }));
    },
    async setBanned(userId, banned) {
      ok(await auth.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" }));
    },
    async listUserIds() {
      const perPage = 1000;
      const ids: string[] = [];
      for (let page = 1; ; page++) {
        const { users } = ok(await auth.listUsers({ page, perPage }));
        ids.push(...users.map((u) => u.id));
        if (users.length < perPage) return ids;
      }
    },
  };
}
