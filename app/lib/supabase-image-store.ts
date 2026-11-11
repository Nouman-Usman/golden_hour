import "server-only";
import type { ImageStore } from "./image-store.ts";
import { makeImageStore } from "./supabase-storage.ts";

// Lazy: env is checked on first use, not at import.
let cached: ImageStore | undefined;
const get = () => (cached ??= makeImageStore());

export const supabaseImageStore: ImageStore = {
  upload: (p, b, t) => get().upload(p, b, t),
  remove: (p) => get().remove(p),
  list: (p) => get().list(p),
  publicUrl: (p) => get().publicUrl(p),
  pathFromUrl: (u) => get().pathFromUrl(u),
};
