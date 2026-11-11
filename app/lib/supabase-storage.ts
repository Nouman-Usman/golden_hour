// No `server-only` here so plain-Node scripts can use it; the app imports it via supabase-image-store.ts.
import { createClient } from "@supabase/supabase-js";
import { DomainError } from "./errors.ts";
import type { ImageStore } from "./image-store.ts";

export const IMAGE_BUCKET = "product-images";

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new DomainError("misconfigured", "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return { url, client: createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export function makeImageStore(): ImageStore {
  const { url, client } = serviceClient();
  const bucket = client.storage.from(IMAGE_BUCKET);
  const prefix = `${url}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  return {
    async upload(path, bytes, contentType) {
      const { error } = await bucket.upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
      if (error) throw new Error(`Storage upload: ${error.message}`);
    },
    async remove(path) {
      const { error } = await bucket.remove([path]);
      if (error) throw new Error(`Storage remove: ${error.message}`);
    },
    // Storage lists one folder level at a time: products/ → products/<id>/ → files.
    async list(root) {
      const dir = root.replace(/\/$/, "");
      const out: { path: string; createdAt: Date }[] = [];
      const { data: folders, error } = await bucket.list(dir, { limit: 1000 });
      if (error) throw new Error(`Storage list: ${error.message}`);
      for (const f of folders ?? []) {
        if (f.id) continue; // a file at the top level; products/ only holds folders
        const { data: files, error: e2 } = await bucket.list(`${dir}/${f.name}`, { limit: 1000 });
        if (e2) throw new Error(`Storage list: ${e2.message}`);
        for (const file of files ?? []) {
          if (file.id) out.push({ path: `${dir}/${f.name}/${file.name}`, createdAt: new Date(file.created_at ?? Date.now()) }); // unknown age = fresh, never swept
        }
      }
      return out;
    },
    publicUrl: (path) => prefix + path,
    pathFromUrl: (u) => (u.startsWith(prefix) ? u.slice(prefix.length) : null),
  };
}
