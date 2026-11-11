import "server-only";
import type { AuthAdmin } from "./staff.ts";
import { makeAuthAdmin } from "./supabase-auth-admin.ts";

// Lazy: env is checked on first use, not at import.
let cached: AuthAdmin | undefined;
const get = () => (cached ??= makeAuthAdmin());

export const supabaseAuthAdmin: AuthAdmin = {
  createUser: (e, p) => get().createUser(e, p),
  deleteUser: (id) => get().deleteUser(id),
  setPassword: (id, p) => get().setPassword(id, p),
  setBanned: (id, b) => get().setBanned(id, b),
  listUserIds: () => get().listUserIds(),
};
