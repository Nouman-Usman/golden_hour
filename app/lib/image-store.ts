// Product image storage. The real one is Supabase Storage (supabase-image-store.ts); tests use a fake.
export interface ImageStore {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(prefix: string): Promise<{ path: string; createdAt: Date }[]>;
  publicUrl(path: string): string;
  pathFromUrl(url: string): string | null;
}

export const MAX_IMAGE_BYTES = 5_242_880;
export const MAX_IMAGES = 6;
